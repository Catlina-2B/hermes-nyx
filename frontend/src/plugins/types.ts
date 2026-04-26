import type { MutableRefObject, ReactNode } from "react";

export type ChatDirective = Record<string, unknown>;
export type ChatDirectiveHandler = (directive: ChatDirective) => void;

export interface PluginContext {
  chatDirectiveRef: MutableRefObject<ChatDirectiveHandler | null>;
}

export interface HermesFrontendPlugin {
  id: string;
  name: string;
  renderSidebarTop?: (context: PluginContext) => ReactNode;
  renderSidebarBottom?: (context: PluginContext) => ReactNode;
  renderOverlay?: (context: PluginContext) => ReactNode;
}
