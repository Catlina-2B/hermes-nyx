import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import { VRMHumanBoneName } from "@pixiv/three-vrm";
import { VRMRenderer } from "./vrm/renderer";
import { applyParamsToVRM, updateVRMFromTargets } from "./vrm/expression-map";
import { applyPosePreset, getPoseTargets } from "./vrm/poses";
import { HoloCoding } from "./vrm/holo-coding";

export type ExpressionCallback = (params: Record<string, unknown>) => void;

interface MotionBeat {
  t: number;
  pose?: string;
  expr?: Record<string, unknown>;
}

interface Props {
  expressionCallbackRef: MutableRefObject<ExpressionCallback | null>;
  modelPath?: string;
  /** Hide room background decorations (for transparent desktop companion) */
  showRoom?: boolean;
}

const DEFAULT_POSE = "hands_behind";
const PLUGIN_VERSION = "vrm-digital-human-2026-04-26-coding-low-typing-v2";
const POSE_HOLD_MS = 2600;
const CODING_HOLD_MS = 9000;
const POSE_BONE_TARGET_KEYS = new Set([
  "head_x", "head_y", "head_z",
  "neck_x", "neck_y", "neck_z",
  "body_x", "body_y", "body_z",
  "bow", "upper_body_turn",
  "left_upper_arm_z", "right_upper_arm_z",
  "left_lower_arm_z", "right_lower_arm_z",
  "left_hand_z", "right_hand_z",
  "left_arm", "right_arm",
  "left_arm_forward", "right_arm_forward",
]);

export default function DigitalHumanPanel({
  expressionCallbackRef,
  modelPath = "/models/yueyue.vrm",
  showRoom = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<VRMRenderer | null>(null);
  const holoCodingRef = useRef<HoloCoding | null>(null);
  const aiTargetsRef = useRef<Map<string, number>>(new Map());
  const aiCurrentRef = useRef<Map<string, number>>(new Map());
  const poseTargetsRef = useRef<Map<string, { x: number; y: number; z: number }>>(new Map());
  const activePoseRef = useRef<string | null>(null);
  const motionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkTimerRef = useRef(0);
  const nextBlinkRef = useRef(3);
  const elapsedRef = useRef(0);
  const codingTimerRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastExpr, setLastExpr] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const renderer = new VRMRenderer(canvas);
    rendererRef.current = renderer;
    let cancelled = false;
    renderer.resize(container.clientWidth, container.clientHeight);

    renderer.onFrame((delta) => {
      const vrm = renderer.getVRM();
      if (!vrm) return;

      elapsedRef.current += delta;
      blinkTimerRef.current += delta;
      updateBlink(vrm);
      if (activePoseRef.current) clearPoseBoneTargets();
      updateVRMFromTargets(vrm, aiTargetsRef.current, aiCurrentRef.current, delta, 0.08);
      updatePose(vrm, delta);
      if (holoCodingRef.current?.visible) {
        codingTimerRef.current += delta;
        updateCoding(vrm, delta);
      } else {
        updateIdle(vrm);
      }
    });

    setLoading(true);
    setError(null);
    renderer.loadModel(modelPath)
      .then((vrm) => {
        if (cancelled || rendererRef.current !== renderer) {
          return;
        }
        stabilizeFaceTransparentMaterials(vrm);
        holoCodingRef.current = new HoloCoding(renderer.getScene());
        applyPosePreset(vrm, DEFAULT_POSE);
        poseTargetsRef.current = getPoseTargets(DEFAULT_POSE);
        activePoseRef.current = DEFAULT_POSE;
        registerDebugApi();
        setLoading(false);
        renderer.start();
      })
      .catch((err) => {
        if (cancelled || rendererRef.current !== renderer) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load VRM");
        setLoading(false);
      });

    const ro = new ResizeObserver(() => {
      renderer.resize(container.clientWidth, container.clientHeight);
    });
    ro.observe(container);

    return () => {
      cancelled = true;
      ro.disconnect();
      clearMotionTimers();
      clearRestoreTimer();
      holoCodingRef.current?.dispose();
      holoCodingRef.current = null;
      unregisterDebugApi();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [modelPath]);

  useEffect(() => {
    expressionCallbackRef.current = (params) => {
      applySkillParams(params);
    };
    return () => {
      expressionCallbackRef.current = null;
    };
    // The callback intentionally reads mutable renderer refs instead of React state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expressionCallbackRef]);

  function applySkillParams(params: Record<string, unknown>): void {
    const motion = params.motion ?? params.choreo ?? params.choreography;
    if (motion) runMotionSequence(motion);

    const directParams = { ...params };
    delete directParams.motion;
    delete directParams.choreo;
    delete directParams.choreography;
    if (Object.keys(directParams).length > 0) applyImmediateParams(directParams);

    setLastExpr(JSON.stringify(params).slice(0, 120));
  }

  function applyImmediateParams(params: Record<string, unknown>): void {
    const vrm = rendererRef.current?.getVRM();
    if (!vrm) return;

    const poseName = applyParamsToVRM(vrm, params, aiTargetsRef.current);
    if (!poseName) return;

    const targets = getPoseTargets(poseName);
    if (targets.size > 0) {
      poseTargetsRef.current = targets;
      activePoseRef.current = poseName;
      clearPoseBoneTargets();
      if (poseName === "coding") {
        codingTimerRef.current = 0;
        holoCodingRef.current?.setVisible(true);
        scheduleDefaultPoseRestore(CODING_HOLD_MS);
      } else {
        holoCodingRef.current?.setVisible(false);
        scheduleDefaultPoseRestore();
      }
    }
  }

  function registerDebugApi(): void {
    if (typeof window === "undefined") return;
    window.hermesVrmDebug = {
      info: () => ({
        version: PLUGIN_VERSION,
        activePose: activePoseRef.current,
        modelPath,
        lastExpr,
        bones: readDebugBones(),
      }),
      pose: (pose: string) => {
        applyImmediateParams({ pose });
        return window.hermesVrmDebug?.info();
      },
      faceMeshes: () => readFaceMeshes(),
    };
  }

  function readDebugBones(): Record<string, { x: number; y: number; z: number } | null> {
    const vrm = rendererRef.current?.getVRM();
    if (!vrm) return {};
    const names = [
      VRMHumanBoneName.LeftUpperArm,
      VRMHumanBoneName.RightUpperArm,
      VRMHumanBoneName.LeftLowerArm,
      VRMHumanBoneName.RightLowerArm,
      VRMHumanBoneName.LeftHand,
      VRMHumanBoneName.RightHand,
    ];
    return Object.fromEntries(names.map((name) => {
      const node = vrm.humanoid.getNormalizedBoneNode(name);
      return [name, node ? {
        x: Math.round(THREE.MathUtils.radToDeg(node.rotation.x)),
        y: Math.round(THREE.MathUtils.radToDeg(node.rotation.y)),
        z: Math.round(THREE.MathUtils.radToDeg(node.rotation.z)),
      } : null];
    }));
  }

  function readFaceMeshes(): Array<Record<string, unknown>> {
    const vrm = rendererRef.current?.getVRM();
    if (!vrm) return [];
    const rows: Array<Record<string, unknown>> = [];
    vrm.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const lowerName = obj.name.toLowerCase();
      if (!/(eye|iris|pupil|highlight|brow|face|mouth)/.test(lowerName)) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      rows.push({
        name: obj.name,
        renderOrder: obj.renderOrder,
        materials: materials.map((material) => ({
          name: material?.name,
          transparent: material?.transparent,
          depthTest: material?.depthTest,
          depthWrite: material?.depthWrite,
          alphaTest: material?.alphaTest,
        })),
      });
    });
    return rows;
  }

  function unregisterDebugApi(): void {
    if (typeof window === "undefined") return;
    if (window.hermesVrmDebug?.info().version === PLUGIN_VERSION) {
      delete window.hermesVrmDebug;
    }
  }

  function runMotionSequence(rawMotion: unknown): void {
    const beats = normalizeMotionBeats(rawMotion);
    if (beats.length === 0) return;

    clearMotionTimers();
    clearRestoreTimer();
    for (const beat of beats) {
      const timer = setTimeout(() => {
        const params: Record<string, unknown> = { ...(beat.expr ?? {}) };
        if (beat.pose) params.pose = beat.pose;
        applyImmediateParams(params);
      }, Math.round(beat.t * 1000));
      motionTimersRef.current.push(timer);
    }

    const lastBeat = beats[beats.length - 1];
    if (lastBeat) {
      const timer = setTimeout(
        restoreDefaultPose,
        Math.round(lastBeat.t * 1000) + POSE_HOLD_MS,
      );
      restoreTimerRef.current = timer;
    }
  }

  function normalizeMotionBeats(rawMotion: unknown): MotionBeat[] {
    const source = Array.isArray(rawMotion)
      ? rawMotion
      : isRecord(rawMotion)
        ? rawMotion.beats ?? rawMotion.sequence ?? rawMotion.steps
        : null;

    if (!Array.isArray(source)) return [];

    return source
      .map((beat): MotionBeat | null => {
        if (!isRecord(beat)) return null;
        const t = Number(beat.t ?? beat.time ?? beat.at ?? 0);
        if (!Number.isFinite(t) || t < 0 || t > 5) return null;
        const pose = typeof beat.pose === "string" ? beat.pose : undefined;
        const expr = isRecord(beat.expr)
          ? beat.expr
          : isRecord(beat.params)
            ? beat.params
            : undefined;
        if (!pose && !expr) return null;
        return { t, pose, expr };
      })
      .filter((beat): beat is MotionBeat => beat !== null)
      .sort((a, b) => a.t - b.t)
      .slice(0, 8);
  }

  function clearMotionTimers(): void {
    for (const timer of motionTimersRef.current) clearTimeout(timer);
    motionTimersRef.current = [];
  }

  function clearRestoreTimer(): void {
    if (restoreTimerRef.current) {
      clearTimeout(restoreTimerRef.current);
      restoreTimerRef.current = null;
    }
  }

  function scheduleDefaultPoseRestore(delayMs = POSE_HOLD_MS): void {
    clearRestoreTimer();
    restoreTimerRef.current = setTimeout(restoreDefaultPose, delayMs);
  }

  function restoreDefaultPose(): void {
    restoreTimerRef.current = null;
    aiTargetsRef.current.clear();
    aiCurrentRef.current.clear();
    holoCodingRef.current?.setVisible(false);
    poseTargetsRef.current = getPoseTargets(DEFAULT_POSE);
    activePoseRef.current = DEFAULT_POSE;

    const vrm = rendererRef.current?.getVRM();
    if (!vrm) return;
    const presets = [
      "happy", "angry", "sad", "surprised", "relaxed",
      "aa", "ih", "ou", "ee", "oh",
      "lookUp", "lookDown", "lookLeft", "lookRight",
    ];
    for (const name of presets) {
      vrm.expressionManager?.setValue(name, 0);
    }
  }

  function updatePose(vrm: VRM, delta: number): void {
    const factor = 1 - Math.exp(-3 * delta);
    const targets = poseTargetsRef.current;

    for (const boneName of Object.values(VRMHumanBoneName)) {
      const node = vrm.humanoid.getNormalizedBoneNode(boneName);
      if (!node) continue;
      const target = targets.get(boneName) ?? { x: 0, y: 0, z: 0 };
      node.rotation.x += (target.x - node.rotation.x) * factor;
      node.rotation.y += (target.y - node.rotation.y) * factor;
      node.rotation.z += (target.z - node.rotation.z) * factor;
    }
  }

  function clearPoseBoneTargets(): void {
    for (const key of POSE_BONE_TARGET_KEYS) {
      aiTargetsRef.current.delete(key);
      aiCurrentRef.current.delete(key);
    }
  }

  function updateIdle(vrm: VRM): void {
    const t = elapsedRef.current;
    const head = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head);
    if (head && !aiTargetsRef.current.has("head_y")) {
      head.rotation.y += Math.sin(t * 0.5) * 0.006;
      head.rotation.z += Math.sin(t * 0.23) * 0.004;
    }

    const spine = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Spine);
    if (spine && !aiTargetsRef.current.has("body_y")) {
      spine.rotation.y += Math.sin(t * 0.35) * 0.006;
    }
  }

  function updateCoding(vrm: VRM, delta: number): void {
    const holo = holoCodingRef.current;
    if (!holo) return;

    holo.update(delta);

    const t = codingTimerRef.current;
    const deg = THREE.MathUtils.degToRad;
    const h = vrm.humanoid;
    const activeHand = holo.getActiveHand();

    const leftCurl = activeHand === "left" ? -45 : -15;
    const rightCurl = activeHand === "right" ? 45 : 15;

    const lip = h.getNormalizedBoneNode(VRMHumanBoneName.LeftIndexProximal);
    const lii = h.getNormalizedBoneNode(VRMHumanBoneName.LeftIndexIntermediate);
    const lmp = h.getNormalizedBoneNode(VRMHumanBoneName.LeftMiddleProximal);
    if (lip) lip.rotation.z = THREE.MathUtils.lerp(lip.rotation.z, deg(leftCurl), 0.35);
    if (lii) lii.rotation.z = THREE.MathUtils.lerp(lii.rotation.z, deg(leftCurl * 0.5), 0.35);
    if (lmp) lmp.rotation.z = THREE.MathUtils.lerp(lmp.rotation.z, deg(leftCurl * 0.7), 0.35);

    const rip = h.getNormalizedBoneNode(VRMHumanBoneName.RightIndexProximal);
    const rii = h.getNormalizedBoneNode(VRMHumanBoneName.RightIndexIntermediate);
    const rmp = h.getNormalizedBoneNode(VRMHumanBoneName.RightMiddleProximal);
    if (rip) rip.rotation.z = THREE.MathUtils.lerp(rip.rotation.z, deg(rightCurl), 0.35);
    if (rii) rii.rotation.z = THREE.MathUtils.lerp(rii.rotation.z, deg(rightCurl * 0.5), 0.35);
    if (rmp) rmp.rotation.z = THREE.MathUtils.lerp(rmp.rotation.z, deg(rightCurl * 0.7), 0.35);

    const head = h.getNormalizedBoneNode(VRMHumanBoneName.Head);
    if (head) {
      head.rotation.x = Math.sin(t * 0.8) * 0.01;
      head.rotation.y = Math.sin(t * 0.35) * 0.015;
    }
  }

  function updateBlink(vrm: VRM): void {
    if (blinkTimerRef.current < nextBlinkRef.current) return;
    const t = blinkTimerRef.current - nextBlinkRef.current;
    if (t < 0.12) {
      vrm.expressionManager?.setValue("blink", Math.sin((t / 0.12) * Math.PI));
      return;
    }
    vrm.expressionManager?.setValue("blink", 0);
    blinkTimerRef.current = 0;
    nextBlinkRef.current = 3 + Math.random() * 3;
  }

  function stabilizeFaceTransparentMaterials(vrm: VRM): void {
    const targetNames = ["eyeiris", "eyehighlight", "facebrow", "faceeyeline"];
    vrm.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        const materialName = material?.name.toLowerCase() ?? "";
        if (!targetNames.some((target) => materialName.includes(target))) continue;
        material.depthTest = true;
        material.depthWrite = true;
        material.needsUpdate = true;
      }
    });
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  return (
    <section
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden select-none ${showRoom ? "bg-[#101623]/88" : "bg-transparent"}`}
    >
      {showRoom && (
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.20),transparent_62%)]" />
          <div className="absolute left-5 right-5 top-14 h-32 rounded-xl border border-cyan-200/12 bg-[#172033]/70 shadow-[inset_0_0_28px_rgba(34,211,238,0.08)]" />
          <div className="absolute left-9 right-9 top-[74px] grid h-20 grid-cols-3 gap-2 opacity-70">
            <span className="rounded-md bg-cyan-200/10" />
            <span className="rounded-md bg-cyan-200/16" />
            <span className="rounded-md bg-cyan-200/10" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,transparent,rgba(10,14,23,0.62)_34%,rgba(15,23,42,0.94))]" />
          <div className="absolute left-8 right-8 bottom-11 h-20 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(103,232,249,0.42)_0%,rgba(34,211,238,0.22)_40%,transparent_72%)] blur-sm" />
          <div className="absolute left-14 right-14 bottom-[58px] h-8 rounded-[50%] bg-cyan-100/28 blur-md" />
          <div className="absolute left-10 right-10 bottom-[54px] h-10 rounded-[50%] bg-cyan-100/10 blur-xl" />
          <div className="absolute left-6 right-6 bottom-6 h-px bg-cyan-200/28" />
        </div>
      )}
      <canvas ref={canvasRef} className="absolute inset-0 z-10 block h-full w-full bg-transparent" />
      {showRoom && (
        <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 flex h-7 items-center justify-between rounded-full border border-white/10 bg-black/20 px-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
            <span className="h-1.5 w-1.5 rounded-full bg-amber-200/70" />
          </div>
          <div className="h-px w-14 bg-cyan-200/25" />
        </div>
      )}
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center text-xs font-mono text-cyber-muted">
          loading vrm...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center px-4 text-xs font-mono text-cyber-error text-center">
          {error}
        </div>
      )}
      {lastExpr && !loading && !error && (
        <div className="pointer-events-none absolute left-2 top-2 z-30 max-w-[92%] truncate rounded bg-black/30 px-2 py-1 text-[10px] font-mono text-cyber-accent opacity-0">
          expr: {lastExpr}
        </div>
      )}
    </section>
  );
}
