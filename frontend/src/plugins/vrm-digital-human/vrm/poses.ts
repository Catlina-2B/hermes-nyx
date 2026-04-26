import * as THREE from 'three';
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { getHandPoseRotations } from './hand-poses';

const deg = THREE.MathUtils.degToRad;

interface BoneRotation {
  bone: VRMHumanBoneName;
  x?: number;
  y?: number;
  z?: number;
}

const POSE_PRESETS: Record<string, BoneRotation[]> = {

  // ===== 基础姿势 =====

  natural: [
    { bone: VRMHumanBoneName.LeftUpperArm, z: -65 },
    { bone: VRMHumanBoneName.RightUpperArm, z: 65 },
    { bone: VRMHumanBoneName.LeftLowerArm, z: -5 },
    { bone: VRMHumanBoneName.RightLowerArm, z: 5 },
  ],

  // ===== 用户验证姿势 =====

  hands_on_hips: [
    { bone: VRMHumanBoneName.LeftUpperArm, x: 2, y: -2, z: -34 },
    { bone: VRMHumanBoneName.RightUpperArm, x: -2, y: 2, z: 36 },
    { bone: VRMHumanBoneName.LeftLowerArm, x: -18, y: -114, z: -81 },
    { bone: VRMHumanBoneName.RightLowerArm, x: -18, y: 114, z: 81 },
    { bone: VRMHumanBoneName.LeftHand, x: 2 },
  ],

  hands_behind: [
    { bone: VRMHumanBoneName.LeftUpperArm, z: -100 },
    { bone: VRMHumanBoneName.RightUpperArm, z: 100 },
    { bone: VRMHumanBoneName.LeftLowerArm, x: 100 },
    { bone: VRMHumanBoneName.RightLowerArm, x: 61, z: -2 },
  ],

  hands_front: [
    { bone: VRMHumanBoneName.LeftUpperArm, x: -4, y: -72, z: -48 },
    { bone: VRMHumanBoneName.RightUpperArm, y: 78, z: 46 },
    { bone: VRMHumanBoneName.LeftLowerArm, x: 15, y: -110 },
    { bone: VRMHumanBoneName.RightLowerArm, x: 15, y: 101, z: -4 },
    { bone: VRMHumanBoneName.LeftHand, z: -49 },
    { bone: VRMHumanBoneName.RightHand, x: -1, y: 32, z: -39 },
  ],

  wave: [
    { bone: VRMHumanBoneName.LeftUpperArm, z: -78 },
    { bone: VRMHumanBoneName.LeftHand, x: 26, z: -6 },
    { bone: VRMHumanBoneName.LeftThumbMetacarpal, y: 14, z: -11 },
    { bone: VRMHumanBoneName.LeftThumbProximal, x: -39, y: 10, z: -13 },
    { bone: VRMHumanBoneName.LeftThumbDistal, x: -18, y: 18, z: -10 },
    { bone: VRMHumanBoneName.LeftIndexProximal, x: 2, z: -10 },
    { bone: VRMHumanBoneName.LeftIndexIntermediate, z: -8 },
    { bone: VRMHumanBoneName.LeftIndexDistal, z: -12 },
    { bone: VRMHumanBoneName.LeftMiddleProximal, z: -6 },
    { bone: VRMHumanBoneName.LeftMiddleIntermediate, z: -12 },
    { bone: VRMHumanBoneName.LeftMiddleDistal, z: -21 },
    { bone: VRMHumanBoneName.LeftRingProximal, z: -8 },
    { bone: VRMHumanBoneName.LeftRingIntermediate, z: -20 },
    { bone: VRMHumanBoneName.LeftLittleProximal, z: -12 },
    { bone: VRMHumanBoneName.LeftLittleIntermediate, z: -4 },
    { bone: VRMHumanBoneName.LeftLittleDistal, z: -4 },
    { bone: VRMHumanBoneName.RightUpperArm, x: -41, y: 45, z: -50 },
    { bone: VRMHumanBoneName.RightHand, x: -32 },
    { bone: VRMHumanBoneName.RightIndexProximal, y: 15 },
    { bone: VRMHumanBoneName.RightMiddleProximal, y: 4 },
    { bone: VRMHumanBoneName.RightRingProximal, y: -7 },
    { bone: VRMHumanBoneName.RightLittleProximal, y: -16 },
  ],

  angry_pose: [
    { bone: VRMHumanBoneName.LeftUpperArm, z: -48 },
    { bone: VRMHumanBoneName.RightUpperArm, z: 48 },
    { bone: VRMHumanBoneName.LeftLowerArm, z: -68 },
    { bone: VRMHumanBoneName.RightLowerArm, z: 68 },
    { bone: VRMHumanBoneName.LeftHand, z: 29 },
    { bone: VRMHumanBoneName.RightHand, z: -29 },
    { bone: VRMHumanBoneName.Head, x: -45 },
    { bone: VRMHumanBoneName.Spine, x: 45 },
    { bone: VRMHumanBoneName.LeftUpperLeg, z: 9 },
    { bone: VRMHumanBoneName.RightUpperLeg, z: -9 },
    { bone: VRMHumanBoneName.LeftLowerLeg, z: -5 },
    { bone: VRMHumanBoneName.RightLowerLeg, z: 5 },
  ],

  sitting_crossed_legs: [
    { bone: VRMHumanBoneName.LeftUpperArm, x: -4, y: -72, z: -48 },
    { bone: VRMHumanBoneName.RightUpperArm, y: 78, z: 46 },
    { bone: VRMHumanBoneName.LeftLowerArm, x: 15, y: -110 },
    { bone: VRMHumanBoneName.RightLowerArm, x: 15, y: 101, z: -4 },
    { bone: VRMHumanBoneName.LeftHand, z: -49 },
    { bone: VRMHumanBoneName.RightHand, x: -1, y: 32, z: -39 },
    { bone: VRMHumanBoneName.Chest, y: 33 },
    { bone: VRMHumanBoneName.LeftUpperLeg, x: -46, y: 6, z: 41 },
    { bone: VRMHumanBoneName.RightUpperLeg, x: -81, y: -1, z: 67 },
    { bone: VRMHumanBoneName.LeftLowerLeg, x: 60, y: 34 },
    { bone: VRMHumanBoneName.RightLowerLeg, x: 48, z: -1 },
  ],

  // ===== 自动验证姿势 =====

  salute: [
    { bone: VRMHumanBoneName.RightUpperArm, x: -22, y: 2, z: 6 },
    { bone: VRMHumanBoneName.RightLowerArm, x: -10, y: 144, z: -26 },
    { bone: VRMHumanBoneName.RightHand, x: -15, z: 10 },
    { bone: VRMHumanBoneName.LeftUpperArm, z: -65 },
    { bone: VRMHumanBoneName.LeftLowerArm, z: -5 },
  ],

  arms_crossed: [
    { bone: VRMHumanBoneName.RightUpperArm, x: -10, y: 80, z: 40 },
    { bone: VRMHumanBoneName.RightLowerArm, x: 15, y: 120, z: -4 },
    { bone: VRMHumanBoneName.LeftUpperArm, x: -10, y: -80, z: -40 },
    { bone: VRMHumanBoneName.LeftLowerArm, x: 15, y: -120 },
    { bone: VRMHumanBoneName.Head, x: -3, z: 3 },
  ],

  thinking: [
    { bone: VRMHumanBoneName.RightUpperArm, x: 76, y: 52, z: -48 },
    { bone: VRMHumanBoneName.RightLowerArm, x: 50, y: 46, z: -122 },
    { bone: VRMHumanBoneName.LeftUpperArm, z: -65 },
    { bone: VRMHumanBoneName.LeftLowerArm, z: -5 },
    { bone: VRMHumanBoneName.Head, x: -3, z: 8 },
  ],

  shy: [
    { bone: VRMHumanBoneName.RightUpperArm, x: -2, y: 16, z: 22 },
    { bone: VRMHumanBoneName.RightLowerArm, x: 48, y: 4, z: -148 },
    { bone: VRMHumanBoneName.LeftUpperArm, x: -12, y: 6, z: 6 },
    { bone: VRMHumanBoneName.LeftLowerArm, x: 4, y: -152, z: 14 },
    { bone: VRMHumanBoneName.Head, x: -8, y: 8, z: 5 },
    { bone: VRMHumanBoneName.Spine, x: 5 },
  ],

  pointing: [
    { bone: VRMHumanBoneName.RightUpperArm, x: -60, y: 10, z: 10 },
    { bone: VRMHumanBoneName.RightHand, z: -10 },
    { bone: VRMHumanBoneName.LeftUpperArm, z: -78 },
    { bone: VRMHumanBoneName.Head, y: -5 },
  ],

  cheer: [
    { bone: VRMHumanBoneName.RightUpperArm, x: -41, y: 30, z: -55 },
    { bone: VRMHumanBoneName.LeftUpperArm, x: -41, y: -30, z: 55 },
    { bone: VRMHumanBoneName.Head, x: -5 },
  ],

  shrug: [
    { bone: VRMHumanBoneName.RightUpperArm, x: 10, z: 30 },
    { bone: VRMHumanBoneName.RightLowerArm, x: 10, y: 70 },
    { bone: VRMHumanBoneName.RightHand, x: 30 },
    { bone: VRMHumanBoneName.LeftUpperArm, x: 10, z: -30 },
    { bone: VRMHumanBoneName.LeftLowerArm, x: 10, y: -70 },
    { bone: VRMHumanBoneName.LeftHand, x: 30 },
    { bone: VRMHumanBoneName.Head, z: 5 },
  ],

  pray: [
    { bone: VRMHumanBoneName.RightUpperArm, x: -6, y: 76, z: 54 },
    { bone: VRMHumanBoneName.RightLowerArm, x: 18, y: 140, z: -14 },
    { bone: VRMHumanBoneName.LeftUpperArm, x: -6, y: -76, z: -54 },
    { bone: VRMHumanBoneName.LeftLowerArm, x: 18, y: -140, z: 14 },
    ...getHandPoseRotations('pray'),
    { bone: VRMHumanBoneName.Head, x: -2 },
  ],

  embrace: [
    { bone: VRMHumanBoneName.RightUpperArm, x: -50, y: 20, z: 10 },
    { bone: VRMHumanBoneName.LeftUpperArm, x: -50, y: -20, z: -10 },
    { bone: VRMHumanBoneName.Head, x: -3 },
  ],

  victory: [
    { bone: VRMHumanBoneName.RightUpperArm, x: -41, y: 45, z: -50 },
    { bone: VRMHumanBoneName.RightHand, x: -25 },
    { bone: VRMHumanBoneName.LeftUpperArm, z: -78 },
  ],

  right_one: [
    { bone: VRMHumanBoneName.RightUpperArm, x: -38, y: 36, z: 12 },
    { bone: VRMHumanBoneName.RightLowerArm, x: -12, y: 110, z: -34 },
    { bone: VRMHumanBoneName.RightHand, x: -12, y: 8, z: -8 },
    { bone: VRMHumanBoneName.LeftUpperArm, z: -78 },
    ...getHandPoseRotations('right_one'),
  ],

  right_victory: [
    { bone: VRMHumanBoneName.RightUpperArm, x: -38, y: 36, z: 12 },
    { bone: VRMHumanBoneName.RightLowerArm, x: -12, y: 110, z: -34 },
    { bone: VRMHumanBoneName.RightHand, x: -12, y: 8, z: -8 },
    { bone: VRMHumanBoneName.LeftUpperArm, z: -78 },
    ...getHandPoseRotations('right_victory'),
  ],

  right_three: [
    { bone: VRMHumanBoneName.RightUpperArm, x: -38, y: 36, z: 12 },
    { bone: VRMHumanBoneName.RightLowerArm, x: -12, y: 110, z: -34 },
    { bone: VRMHumanBoneName.RightHand, x: -12, y: 8, z: -8 },
    { bone: VRMHumanBoneName.LeftUpperArm, z: -78 },
    ...getHandPoseRotations('right_three'),
  ],

  right_four: [
    { bone: VRMHumanBoneName.RightUpperArm, x: -38, y: 36, z: 12 },
    { bone: VRMHumanBoneName.RightLowerArm, x: -12, y: 110, z: -34 },
    { bone: VRMHumanBoneName.RightHand, x: -12, y: 8, z: -8 },
    { bone: VRMHumanBoneName.LeftUpperArm, z: -78 },
    ...getHandPoseRotations('right_four'),
  ],

  right_five: [
    { bone: VRMHumanBoneName.RightUpperArm, x: -38, y: 36, z: 12 },
    { bone: VRMHumanBoneName.RightLowerArm, x: -12, y: 110, z: -34 },
    { bone: VRMHumanBoneName.RightHand, x: -12, y: 8, z: -8 },
    { bone: VRMHumanBoneName.LeftUpperArm, z: -78 },
    ...getHandPoseRotations('right_five'),
  ],

  confident: [
    { bone: VRMHumanBoneName.RightUpperArm, z: 48 },
    { bone: VRMHumanBoneName.RightLowerArm, z: 68 },
    { bone: VRMHumanBoneName.RightHand, z: -29 },
    { bone: VRMHumanBoneName.LeftUpperArm, z: -78 },
    { bone: VRMHumanBoneName.Spine, x: 5 },
    { bone: VRMHumanBoneName.Chest, y: -8 },
    { bone: VRMHumanBoneName.Head, x: -3 },
  ],

  stretch: [
    { bone: VRMHumanBoneName.RightUpperArm, x: -50, y: 20, z: -60 },
    { bone: VRMHumanBoneName.RightLowerArm, x: -60 },
    { bone: VRMHumanBoneName.LeftUpperArm, x: -50, y: -20, z: 60 },
    { bone: VRMHumanBoneName.LeftLowerArm, x: -60 },
    { bone: VRMHumanBoneName.Spine, x: -5 },
    { bone: VRMHumanBoneName.Head, x: 5 },
  ],

  cute_tilt: [
    { bone: VRMHumanBoneName.Head, z: 12, x: -5 },
    { bone: VRMHumanBoneName.Spine, z: 5 },
    { bone: VRMHumanBoneName.LeftUpperArm, z: -100 },
    { bone: VRMHumanBoneName.LeftLowerArm, x: 80 },
    { bone: VRMHumanBoneName.RightUpperArm, z: 100 },
    { bone: VRMHumanBoneName.RightLowerArm, x: 80 },
  ],

  fight_stance: [
    { bone: VRMHumanBoneName.RightUpperArm, x: -16, y: 18, z: 52 },
    { bone: VRMHumanBoneName.RightLowerArm, x: 18, y: 108, z: 8 },
    { bone: VRMHumanBoneName.RightHand, x: -19 },
    { bone: VRMHumanBoneName.LeftUpperArm, x: -16, y: -18, z: -52 },
    { bone: VRMHumanBoneName.LeftLowerArm, x: 18, y: -108, z: -8 },
    { bone: VRMHumanBoneName.LeftHand, x: -19 },
    ...getHandPoseRotations('fist'),
    { bone: VRMHumanBoneName.Chest, y: 12 },
    { bone: VRMHumanBoneName.Head, y: -6 },
    { bone: VRMHumanBoneName.LeftUpperLeg, z: 8 },
    { bone: VRMHumanBoneName.RightUpperLeg, z: -8 },
  ],

  sassy: [
    { bone: VRMHumanBoneName.Head, z: 10, x: -3 },
    { bone: VRMHumanBoneName.Spine, z: -8 },
    { bone: VRMHumanBoneName.Chest, z: 5 },
    { bone: VRMHumanBoneName.Hips, z: 5 },
    { bone: VRMHumanBoneName.RightUpperArm, z: 48 },
    { bone: VRMHumanBoneName.RightLowerArm, z: 68 },
    { bone: VRMHumanBoneName.RightHand, z: -29 },
    { bone: VRMHumanBoneName.LeftUpperArm, z: -78 },
  ],

  giggle: [
    { bone: VRMHumanBoneName.RightUpperArm, x: -15, y: 55, z: -10 },
    { bone: VRMHumanBoneName.RightLowerArm, x: 10, y: 95 },
    { bone: VRMHumanBoneName.RightHand, x: -10 },
    { bone: VRMHumanBoneName.LeftUpperArm, z: -78 },
    { bone: VRMHumanBoneName.Head, x: -5, z: 3 },
  ],

  bow: [
    { bone: VRMHumanBoneName.LeftUpperArm, z: -65 },
    { bone: VRMHumanBoneName.RightUpperArm, z: 65 },
    { bone: VRMHumanBoneName.LeftLowerArm, z: -5 },
    { bone: VRMHumanBoneName.RightLowerArm, z: 5 },
    { bone: VRMHumanBoneName.Spine, x: 35 },
    { bone: VRMHumanBoneName.Chest, x: 10 },
    { bone: VRMHumanBoneName.Head, x: 10 },
  ],

  coding: [
    { bone: VRMHumanBoneName.LeftUpperArm, x: -6, y: -26, z: -76 },
    { bone: VRMHumanBoneName.RightUpperArm, x: -6, y: 26, z: 76 },
    { bone: VRMHumanBoneName.LeftLowerArm, x: 50, y: -54, z: -4 },
    { bone: VRMHumanBoneName.RightLowerArm, x: 50, y: 54, z: 4 },
    { bone: VRMHumanBoneName.LeftHand, x: -10, y: -18, z: -14 },
    { bone: VRMHumanBoneName.RightHand, x: -10, y: 18, z: 14 },
    { bone: VRMHumanBoneName.LeftUpperLeg, z: 2 },
    { bone: VRMHumanBoneName.RightUpperLeg, z: -2 },
  ],

  // ===== 舞蹈帧 =====

  dance_twist_l: [
    // 手臂举过头顶，肘弯曲
    { bone: VRMHumanBoneName.LeftUpperArm, x: -20, y: -60, z: 70 },
    { bone: VRMHumanBoneName.LeftLowerArm, y: -130 },
    { bone: VRMHumanBoneName.RightUpperArm, x: -20, y: 60, z: -70 },
    { bone: VRMHumanBoneName.RightLowerArm, y: 130 },
    // 扭腰向左
    { bone: VRMHumanBoneName.Spine, z: 12 },
    { bone: VRMHumanBoneName.UpperChest, y: -18, z: -7 },
    { bone: VRMHumanBoneName.Hips, y: 19 },
    { bone: VRMHumanBoneName.LeftUpperLeg, y: -8, z: -7 },
    { bone: VRMHumanBoneName.RightUpperLeg, z: -1 },
    { bone: VRMHumanBoneName.RightLowerLeg, z: -7 },
    { bone: VRMHumanBoneName.RightFoot, y: -7 },
  ],

  dance_twist_r: [
    // 手臂举过头顶，肘弯曲
    { bone: VRMHumanBoneName.LeftUpperArm, x: -20, y: -60, z: 70 },
    { bone: VRMHumanBoneName.LeftLowerArm, y: -130 },
    { bone: VRMHumanBoneName.RightUpperArm, x: -20, y: 60, z: -70 },
    { bone: VRMHumanBoneName.RightLowerArm, y: 130 },
    // 扭腰向右
    { bone: VRMHumanBoneName.Spine, z: -12 },
    { bone: VRMHumanBoneName.UpperChest, y: 18, z: 7 },
    { bone: VRMHumanBoneName.Hips, y: -19 },
    { bone: VRMHumanBoneName.RightUpperLeg, y: 8, z: 7 },
    { bone: VRMHumanBoneName.LeftUpperLeg, z: 1 },
    { bone: VRMHumanBoneName.LeftLowerLeg, z: 7 },
    { bone: VRMHumanBoneName.LeftFoot, y: 7 },
  ],
};

export function applyPosePreset(vrm: VRM, poseName: string): void {
  const preset = POSE_PRESETS[poseName];
  if (!preset) return;

  vrm.humanoid.resetNormalizedPose();

  for (const rot of preset) {
    const bone = vrm.humanoid.getNormalizedBoneNode(rot.bone);
    if (!bone) continue;
    if (rot.x !== undefined) bone.rotation.x = deg(rot.x);
    if (rot.y !== undefined) bone.rotation.y = deg(rot.y);
    if (rot.z !== undefined) bone.rotation.z = deg(rot.z);
  }
}

/** 获取姿势的目标骨骼旋转值（弧度），用于平滑过渡 */
export function getPoseTargets(poseName: string): Map<string, { x: number; y: number; z: number }> {
  const preset = POSE_PRESETS[poseName];
  const targets = new Map<string, { x: number; y: number; z: number }>();
  if (!preset) return targets;

  for (const rot of preset) {
    targets.set(rot.bone, {
      x: rot.x !== undefined ? deg(rot.x) : 0,
      y: rot.y !== undefined ? deg(rot.y) : 0,
      z: rot.z !== undefined ? deg(rot.z) : 0,
    });
  }
  return targets;
}

export function getPosePresetNames(): string[] {
  return Object.keys(POSE_PRESETS);
}

export { POSE_PRESETS };
