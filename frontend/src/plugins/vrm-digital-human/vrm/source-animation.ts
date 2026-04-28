import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";

const MIXAMO_VRM_RIG_MAP: Record<string, VRMHumanBoneName> = {
  Hips: "hips",
  Spine: "spine",
  Spine1: "chest",
  Spine2: "upperChest",
  Neck: "neck",
  Head: "head",
  LeftShoulder: "leftShoulder",
  LeftArm: "leftUpperArm",
  LeftForeArm: "leftLowerArm",
  LeftHand: "leftHand",
  LeftHandThumb1: "leftThumbMetacarpal",
  LeftHandThumb2: "leftThumbProximal",
  LeftHandThumb3: "leftThumbDistal",
  LeftHandIndex1: "leftIndexProximal",
  LeftHandIndex2: "leftIndexIntermediate",
  LeftHandIndex3: "leftIndexDistal",
  LeftHandMiddle1: "leftMiddleProximal",
  LeftHandMiddle2: "leftMiddleIntermediate",
  LeftHandMiddle3: "leftMiddleDistal",
  LeftHandRing1: "leftRingProximal",
  LeftHandRing2: "leftRingIntermediate",
  LeftHandRing3: "leftRingDistal",
  LeftHandPinky1: "leftLittleProximal",
  LeftHandPinky2: "leftLittleIntermediate",
  LeftHandPinky3: "leftLittleDistal",
  RightShoulder: "rightShoulder",
  RightArm: "rightUpperArm",
  RightForeArm: "rightLowerArm",
  RightHand: "rightHand",
  RightHandThumb1: "rightThumbMetacarpal",
  RightHandThumb2: "rightThumbProximal",
  RightHandThumb3: "rightThumbDistal",
  RightHandIndex1: "rightIndexProximal",
  RightHandIndex2: "rightIndexIntermediate",
  RightHandIndex3: "rightIndexDistal",
  RightHandMiddle1: "rightMiddleProximal",
  RightHandMiddle2: "rightMiddleIntermediate",
  RightHandMiddle3: "rightMiddleDistal",
  RightHandRing1: "rightRingProximal",
  RightHandRing2: "rightRingIntermediate",
  RightHandRing3: "rightRingDistal",
  RightHandPinky1: "rightLittleProximal",
  RightHandPinky2: "rightLittleIntermediate",
  RightHandPinky3: "rightLittleDistal",
  LeftUpLeg: "leftUpperLeg",
  LeftLeg: "leftLowerLeg",
  LeftFoot: "leftFoot",
  LeftToeBase: "leftToes",
  RightUpLeg: "rightUpperLeg",
  RightLeg: "rightLowerLeg",
  RightFoot: "rightFoot",
  RightToeBase: "rightToes",
};

function normalizeMixamoBoneName(name: string): string {
  const withoutNamespace = name.includes(":") ? name.slice(name.lastIndexOf(":") + 1) : name;
  return withoutNamespace.replace(/^mixamorig/i, "");
}

function resolveMixamoBoneName(sourceBoneName: string): VRMHumanBoneName | undefined {
  return MIXAMO_VRM_RIG_MAP[normalizeMixamoBoneName(sourceBoneName)];
}

function findSourceNode(root: THREE.Object3D, sourceBoneName: string): THREE.Object3D | null {
  const normalizedTarget = normalizeMixamoBoneName(sourceBoneName);
  let found: THREE.Object3D | null = root.getObjectByName(sourceBoneName) ?? null;
  if (found) return found;

  root.traverse((object) => {
    if (found) return;
    if (normalizeMixamoBoneName(object.name) === normalizedTarget) {
      found = object;
    }
  });

  return found;
}

function getCurrentVRMHipsHeight(vrm: VRM): number {
  const hips = vrm.humanoid.getNormalizedBoneNode("hips");
  const hipsPos = new THREE.Vector3();
  const rootPos = new THREE.Vector3();
  hips?.getWorldPosition(hipsPos);
  vrm.scene.getWorldPosition(rootPos);
  return Math.max(0.001, Math.abs(hipsPos.y - rootPos.y));
}

function convertSourceClipToVRMClip(
  vrm: VRM,
  sourceRoot: THREE.Object3D,
  sourceClip: THREE.AnimationClip,
  label: string,
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const quat = new THREE.Quaternion();
  const currentVRMHipsHeight = getCurrentVRMHipsHeight(vrm);
  const hipsSourceNode = findSourceNode(sourceRoot, "Hips") ?? findSourceNode(sourceRoot, "mixamorigHips");
  const motionHipsHeight = Math.max(0.001, Math.abs(hipsSourceNode?.position?.y || currentVRMHipsHeight));
  const hipsPositionScale = currentVRMHipsHeight / motionHipsHeight;

  for (const track of sourceClip.tracks) {
    const [sourceBoneName, propertyName] = track.name.split(".");
    if (!sourceBoneName || !propertyName) continue;

    const vrmBoneName = resolveMixamoBoneName(sourceBoneName);
    if (!vrmBoneName) continue;

    const vrmNodeName = vrm.humanoid.getNormalizedBoneNode(vrmBoneName)?.name;
    const sourceNode = findSourceNode(sourceRoot, sourceBoneName);
    if (!vrmNodeName || !sourceNode) continue;

    sourceNode.getWorldQuaternion(restRotationInverse).invert();
    if (sourceNode.parent) {
      sourceNode.parent.getWorldQuaternion(parentRestWorldRotation);
    } else {
      parentRestWorldRotation.identity();
    }

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      const values = new Float32Array(track.values.length);
      for (let i = 0; i < track.values.length; i += 4) {
        quat.fromArray(track.values, i);
        quat.premultiply(parentRestWorldRotation).multiply(restRotationInverse);
        quat.normalize();
        quat.toArray(values, i);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${vrmNodeName}.${propertyName}`, track.times, values));
    } else if (track instanceof THREE.VectorKeyframeTrack && vrmBoneName === "hips") {
      const values = new Float32Array(track.values.length);
      for (let i = 0; i < track.values.length; i++) {
        values[i] = (track.values[i] ?? 0) * hipsPositionScale;
      }
      tracks.push(new THREE.VectorKeyframeTrack(`${vrmNodeName}.${propertyName}`, track.times, values));
    }
  }

  return new THREE.AnimationClip(label, sourceClip.duration, tracks);
}

export async function loadFBXAnimationClipForVRM(vrm: VRM, url: string): Promise<THREE.AnimationClip> {
  const asset = await new FBXLoader().loadAsync(url);
  const sourceClip = THREE.AnimationClip.findByName(asset.animations, "mixamo.com") ?? asset.animations[0];
  if (!sourceClip) {
    throw new Error("FBX 中没有 AnimationClip");
  }

  const clip = convertSourceClipToVRMClip(vrm, asset, sourceClip, "vrmAnimationFBX");
  if (clip.tracks.length === 0) {
    throw new Error("FBX 动画没有可映射到 VRM 的骨骼轨道");
  }
  return clip;
}
