export interface AvatarModelOption {
  label: string;
  path: string;
}

export const AVATAR_MODEL_STORAGE_KEY = "hermes-avatar-model";

export const AVATAR_MODEL_OPTIONS: AvatarModelOption[] = [
  { label: "Yueyue", path: "/models/yueyue.vrm" },
  { label: "Yueyue 2", path: "/models/yueyue-2.vrm" },
  { label: "Yueyue 3", path: "/models/yueyue-3.vrm" },
];

export const DEFAULT_AVATAR_MODEL_PATH = AVATAR_MODEL_OPTIONS[0]!.path;

export function normalizeAvatarModelPath(path: string | null): string {
  if (!path) return DEFAULT_AVATAR_MODEL_PATH;
  return AVATAR_MODEL_OPTIONS.some((option) => option.path === path)
    ? path
    : DEFAULT_AVATAR_MODEL_PATH;
}
