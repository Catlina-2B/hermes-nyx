import DigitalHumanPanel from "./DigitalHumanPanel";
import type { HermesFrontendPlugin } from "../types";

export const vrmDigitalHumanPlugin: HermesFrontendPlugin = {
  id: "vrm-digital-human",
  name: "VRM Digital Human",
  renderSidebarBottom: (context) => (
    <DigitalHumanPanel expressionCallbackRef={context.chatDirectiveRef} />
  ),
};
