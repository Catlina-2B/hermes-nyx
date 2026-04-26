import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import * as THREE from 'three';

/**
 * AI 表情/肢体参数 → VRM 表情 + 骨骼 的映射
 *
 * AI 发送的参数名 → { type: 'expression' | 'bone', ... }
 */
interface ExpressionMapping {
  type: 'expression';
  vrmName: string; // VRM 表情名
}

interface BoneMapping {
  type: 'bone';
  boneName: string; // VRM 骨骼名
  axis: 'x' | 'y' | 'z';
  scale: number; // 值的缩放（角度）
  offset?: number; // 基础偏移角度（自然姿势）
}

type ParamMapping = ExpressionMapping | BoneMapping;

// AI 参数名 → VRM 映射
const PARAM_MAP: Record<string, ParamMapping[]> = {
  // ===== 表情 =====
  happy: [{ type: 'expression', vrmName: 'happy' }],
  angry: [{ type: 'expression', vrmName: 'angry' }],
  sad: [{ type: 'expression', vrmName: 'sad' }],
  relaxed: [{ type: 'expression', vrmName: 'relaxed' }],
  surprised: [{ type: 'expression', vrmName: 'surprised' }],

  // 口型
  mouth_aaa: [{ type: 'expression', vrmName: 'aa' }],
  mouth_iii: [{ type: 'expression', vrmName: 'ih' }],
  mouth_uuu: [{ type: 'expression', vrmName: 'ou' }],
  mouth_eee: [{ type: 'expression', vrmName: 'ee' }],
  mouth_ooo: [{ type: 'expression', vrmName: 'oh' }],

  // 眨眼
  blink: [{ type: 'expression', vrmName: 'blink' }],
  blink_left: [{ type: 'expression', vrmName: 'blinkLeft' }],
  blink_right: [{ type: 'expression', vrmName: 'blinkRight' }],

  // 视线（表情方式）
  look_up: [{ type: 'expression', vrmName: 'lookUp' }],
  look_down: [{ type: 'expression', vrmName: 'lookDown' }],
  look_left: [{ type: 'expression', vrmName: 'lookLeft' }],
  look_right: [{ type: 'expression', vrmName: 'lookRight' }],

  // ===== 骨骼 - 头部 =====
  head_x: [{ type: 'bone', boneName: VRMHumanBoneName.Head, axis: 'x', scale: 20 }],
  head_y: [{ type: 'bone', boneName: VRMHumanBoneName.Head, axis: 'y', scale: 25 }],
  head_z: [{ type: 'bone', boneName: VRMHumanBoneName.Head, axis: 'z', scale: 15 }],

  // 颈部
  neck_x: [{ type: 'bone', boneName: VRMHumanBoneName.Neck, axis: 'x', scale: 10 }],
  neck_y: [{ type: 'bone', boneName: VRMHumanBoneName.Neck, axis: 'y', scale: 15 }],
  neck_z: [{ type: 'bone', boneName: VRMHumanBoneName.Neck, axis: 'z', scale: 10 }],

  // 脊椎/身体
  body_x: [{ type: 'bone', boneName: VRMHumanBoneName.Spine, axis: 'x', scale: 12 }],
  body_y: [{ type: 'bone', boneName: VRMHumanBoneName.Spine, axis: 'y', scale: 15 }],
  body_z: [{ type: 'bone', boneName: VRMHumanBoneName.Spine, axis: 'z', scale: 8 }],

  // ===== 骨骼 - 手臂 =====
  left_upper_arm_z: [{ type: 'bone', boneName: VRMHumanBoneName.LeftUpperArm, axis: 'z', scale: 60 }],
  right_upper_arm_z: [{ type: 'bone', boneName: VRMHumanBoneName.RightUpperArm, axis: 'z', scale: 60 }],
  left_lower_arm_z: [{ type: 'bone', boneName: VRMHumanBoneName.LeftLowerArm, axis: 'z', scale: 45 }],
  right_lower_arm_z: [{ type: 'bone', boneName: VRMHumanBoneName.RightLowerArm, axis: 'z', scale: 45 }],

  // 手
  left_hand_z: [{ type: 'bone', boneName: VRMHumanBoneName.LeftHand, axis: 'z', scale: 30 }],
  right_hand_z: [{ type: 'bone', boneName: VRMHumanBoneName.RightHand, axis: 'z', scale: 30 }],

  // ===== 简化肢体控制（AI 友好的抽象参数） =====
  // 举手/放手（0=自然下垂, 1=举起）— offset 是自然下垂角度
  left_arm: [
    { type: 'bone', boneName: VRMHumanBoneName.LeftUpperArm, axis: 'z', scale: 65, offset: -65 },
    { type: 'bone', boneName: VRMHumanBoneName.LeftLowerArm, axis: 'z', scale: 30, offset: -5 },
  ],
  right_arm: [
    { type: 'bone', boneName: VRMHumanBoneName.RightUpperArm, axis: 'z', scale: -65, offset: 65 },
    { type: 'bone', boneName: VRMHumanBoneName.RightLowerArm, axis: 'z', scale: -30, offset: 5 },
  ],

  // 手臂前伸（0=自然, 1=向前伸出）
  left_arm_forward: [
    { type: 'bone', boneName: VRMHumanBoneName.LeftUpperArm, axis: 'x', scale: -50, offset: 0 },
  ],
  right_arm_forward: [
    { type: 'bone', boneName: VRMHumanBoneName.RightUpperArm, axis: 'x', scale: -50, offset: 0 },
  ],

  // 弯腰/鞠躬（0=站直, 1=弯腰）
  bow: [
    { type: 'bone', boneName: VRMHumanBoneName.Spine, axis: 'x', scale: -30 },
  ],

  // 上半身扭转
  upper_body_turn: [
    { type: 'bone', boneName: VRMHumanBoneName.Spine, axis: 'y', scale: 20 },
  ],
};

/** 将 AI 参数应用到目标映射，返回姿势名（如果有） */
export function applyParamsToVRM(
  _vrm: VRM,
  params: Record<string, unknown>,
  targets: Map<string, number>,
): string | null {
  let poseName: string | null = null;
  for (const [key, rawValue] of Object.entries(params)) {
    if (key === 'pose' && typeof rawValue === 'string') {
      poseName = rawValue;
      continue;
    }
    const value = Number(rawValue);
    if (isNaN(value)) continue;
    targets.set(key, value);
  }
  return poseName;
}

/** 每帧更新：将目标值平滑应用到 VRM */
export function updateVRMFromTargets(
  vrm: VRM,
  targets: Map<string, number>,
  current: Map<string, number>,
  dt: number,
  lerpSpeed: number = 0.1,
): void {
  const factor = 1 - Math.pow(1 - lerpSpeed, dt * 60);

  for (const [key, target] of targets) {
    const cur = current.get(key) ?? 0;
    const newVal = cur + (target - cur) * factor;
    current.set(key, newVal);

    const mappings = PARAM_MAP[key];
    if (!mappings) continue;

    for (const mapping of mappings) {
      if (mapping.type === 'expression') {
        // 情绪表情限制到 0.7 避免过度变形（如眼睛消失）
        const emotionExprs = new Set(['happy', 'angry', 'sad', 'surprised', 'relaxed']);
        const maxVal = emotionExprs.has(mapping.vrmName) ? 0.6 : 1;
        vrm.expressionManager?.setValue(mapping.vrmName, Math.max(0, Math.min(maxVal, newVal)));
      } else {
        const bone = vrm.humanoid.getNormalizedBoneNode(mapping.boneName as VRMHumanBoneName);
        if (bone) {
          const offset = mapping.offset ?? 0;
          bone.rotation[mapping.axis] = THREE.MathUtils.degToRad(offset + newVal * mapping.scale);
        }
      }
    }
  }
}

/** 获取所有支持的 AI 参数名列表 */
export function getSupportedParams(): string[] {
  return Object.keys(PARAM_MAP);
}
