export {};

declare global {
  interface Window {
    hermesVrmDebug?: {
      info: () => {
        version: string;
        activePose: string | null;
        activeAnimation: string | null;
        modelPath: string;
        lastExpr: string;
        bones: Record<string, { x: number; y: number; z: number } | null>;
      };
      pose: (pose: string) => unknown;
      animation: (animation?: string) => unknown;
      faceMeshes: () => Array<Record<string, unknown>>;
    };
  }
}
