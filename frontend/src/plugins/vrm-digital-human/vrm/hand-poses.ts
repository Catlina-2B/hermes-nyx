import { VRMHumanBoneName } from '@pixiv/three-vrm';

interface BoneRotation {
  bone: VRMHumanBoneName;
  x?: number;
  y?: number;
  z?: number;
}

export type HandPoseName =
  | 'fist'
  | 'pray'
  | 'relaxed'
  | 'open'
  | 'right_one'
  | 'right_victory'
  | 'right_three'
  | 'right_four'
  | 'right_five';

const RIGHT_THUMB_FOLDED: BoneRotation[] = [
  { bone: VRMHumanBoneName.RightThumbMetacarpal, x: 11, z: 37 },
  { bone: VRMHumanBoneName.RightThumbProximal, y: -62 },
  { bone: VRMHumanBoneName.RightThumbDistal, y: -70 },
];

const RIGHT_MIDDLE_FOLDED: BoneRotation[] = [
  { bone: VRMHumanBoneName.RightMiddleProximal, z: 84 },
  { bone: VRMHumanBoneName.RightMiddleIntermediate, z: 77 },
  { bone: VRMHumanBoneName.RightMiddleDistal, z: 73 },
];

const RIGHT_RING_FOLDED: BoneRotation[] = [
  { bone: VRMHumanBoneName.RightRingProximal, z: 83 },
  { bone: VRMHumanBoneName.RightRingIntermediate, z: 95 },
  { bone: VRMHumanBoneName.RightRingDistal, z: 53 },
];

const RIGHT_LITTLE_FOLDED: BoneRotation[] = [
  { bone: VRMHumanBoneName.RightLittleProximal, z: 89 },
  { bone: VRMHumanBoneName.RightLittleIntermediate, z: 98 },
  { bone: VRMHumanBoneName.RightLittleDistal, z: 69 },
];

const HAND_POSE_PRESETS: Record<HandPoseName, BoneRotation[]> = {
  relaxed: [],
  open: [],
  fist: [
    { bone: VRMHumanBoneName.RightThumbMetacarpal, x: 11, z: 37 },
    { bone: VRMHumanBoneName.RightThumbProximal, y: -62 },
    { bone: VRMHumanBoneName.RightThumbDistal, y: -70 },
    { bone: VRMHumanBoneName.RightIndexProximal, x: -1, z: 82 },
    { bone: VRMHumanBoneName.RightIndexIntermediate, z: 46 },
    { bone: VRMHumanBoneName.RightIndexDistal, z: 76 },
    { bone: VRMHumanBoneName.RightMiddleProximal, z: 84 },
    { bone: VRMHumanBoneName.RightMiddleIntermediate, z: 77 },
    { bone: VRMHumanBoneName.RightMiddleDistal, z: 73 },
    { bone: VRMHumanBoneName.RightRingProximal, z: 83 },
    { bone: VRMHumanBoneName.RightRingIntermediate, z: 95 },
    { bone: VRMHumanBoneName.RightRingDistal, z: 53 },
    { bone: VRMHumanBoneName.RightLittleProximal, z: 89 },
    { bone: VRMHumanBoneName.RightLittleIntermediate, z: 98 },
    { bone: VRMHumanBoneName.RightLittleDistal, z: 69 },
    { bone: VRMHumanBoneName.LeftThumbMetacarpal, x: 11, z: -37 },
    { bone: VRMHumanBoneName.LeftThumbProximal, y: 62 },
    { bone: VRMHumanBoneName.LeftThumbDistal, y: 70 },
    { bone: VRMHumanBoneName.LeftIndexProximal, x: -1, z: -82 },
    { bone: VRMHumanBoneName.LeftIndexIntermediate, z: -46 },
    { bone: VRMHumanBoneName.LeftIndexDistal, z: -76 },
    { bone: VRMHumanBoneName.LeftMiddleProximal, z: -84 },
    { bone: VRMHumanBoneName.LeftMiddleIntermediate, z: -77 },
    { bone: VRMHumanBoneName.LeftMiddleDistal, z: -73 },
    { bone: VRMHumanBoneName.LeftRingProximal, z: -83 },
    { bone: VRMHumanBoneName.LeftRingIntermediate, z: -95 },
    { bone: VRMHumanBoneName.LeftRingDistal, z: -53 },
    { bone: VRMHumanBoneName.LeftLittleProximal, z: -89 },
    { bone: VRMHumanBoneName.LeftLittleIntermediate, z: -98 },
    { bone: VRMHumanBoneName.LeftLittleDistal, z: -69 },
  ],
  right_one: [
    ...RIGHT_THUMB_FOLDED,
    ...RIGHT_MIDDLE_FOLDED,
    ...RIGHT_RING_FOLDED,
    ...RIGHT_LITTLE_FOLDED,
  ],
  right_victory: [
    { bone: VRMHumanBoneName.RightIndexProximal, x: -6, z: -10 },
    { bone: VRMHumanBoneName.RightMiddleProximal, z: 10 },
    ...RIGHT_THUMB_FOLDED,
    ...RIGHT_RING_FOLDED,
    ...RIGHT_LITTLE_FOLDED,
  ],
  right_three: [
    ...RIGHT_THUMB_FOLDED,
    ...RIGHT_LITTLE_FOLDED,
  ],
  right_four: [
    ...RIGHT_THUMB_FOLDED,
  ],
  right_five: [],
  pray: [
    { bone: VRMHumanBoneName.RightHand, x: -20, y: 6, z: -72 },
    { bone: VRMHumanBoneName.RightThumbMetacarpal, x: 2, y: -12, z: 12 },
    { bone: VRMHumanBoneName.RightThumbProximal, x: -12, y: -8, z: 14 },
    { bone: VRMHumanBoneName.RightThumbDistal, x: -6, y: -4, z: 8 },
    { bone: VRMHumanBoneName.RightIndexProximal, x: -8, z: -6 },
    { bone: VRMHumanBoneName.RightIndexIntermediate, x: -6 },
    { bone: VRMHumanBoneName.RightIndexDistal, x: -3 },
    { bone: VRMHumanBoneName.RightMiddleProximal, x: -6 },
    { bone: VRMHumanBoneName.RightMiddleIntermediate, x: -5 },
    { bone: VRMHumanBoneName.RightMiddleDistal, x: -3 },
    { bone: VRMHumanBoneName.RightRingProximal, x: -8, z: 5 },
    { bone: VRMHumanBoneName.RightRingIntermediate, x: -6 },
    { bone: VRMHumanBoneName.RightRingDistal, x: -3 },
    { bone: VRMHumanBoneName.RightLittleProximal, x: -10, z: 10 },
    { bone: VRMHumanBoneName.RightLittleIntermediate, x: -8 },
    { bone: VRMHumanBoneName.RightLittleDistal, x: -4 },
    { bone: VRMHumanBoneName.LeftHand, x: -20, y: -6, z: 72 },
    { bone: VRMHumanBoneName.LeftThumbMetacarpal, x: 2, y: 12, z: -12 },
    { bone: VRMHumanBoneName.LeftThumbProximal, x: -12, y: 8, z: -14 },
    { bone: VRMHumanBoneName.LeftThumbDistal, x: -6, y: 4, z: -8 },
    { bone: VRMHumanBoneName.LeftIndexProximal, x: -8, z: 6 },
    { bone: VRMHumanBoneName.LeftIndexIntermediate, x: -6 },
    { bone: VRMHumanBoneName.LeftIndexDistal, x: -3 },
    { bone: VRMHumanBoneName.LeftMiddleProximal, x: -6 },
    { bone: VRMHumanBoneName.LeftMiddleIntermediate, x: -5 },
    { bone: VRMHumanBoneName.LeftMiddleDistal, x: -3 },
    { bone: VRMHumanBoneName.LeftRingProximal, x: -8, z: -5 },
    { bone: VRMHumanBoneName.LeftRingIntermediate, x: -6 },
    { bone: VRMHumanBoneName.LeftRingDistal, x: -3 },
    { bone: VRMHumanBoneName.LeftLittleProximal, x: -10, z: -10 },
    { bone: VRMHumanBoneName.LeftLittleIntermediate, x: -8 },
    { bone: VRMHumanBoneName.LeftLittleDistal, x: -4 },
  ],
};

export function getHandPoseRotations(poseName: HandPoseName): BoneRotation[] {
  return HAND_POSE_PRESETS[poseName];
}

export { HAND_POSE_PRESETS };
