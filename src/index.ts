import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StatuslineEngine } from "./engine.ts";

export * from "./config.ts";
export * from "./engine.ts";
export * from "./items/index.ts";
export * from "./items/tps.ts";
export * from "./types.ts";

/**
 * Pi Extension entry point.
 */
export default function statuslineExtension(pi: ExtensionAPI): StatuslineEngine {
  const engine = new StatuslineEngine(pi);
  engine.setup();
  return engine;
}
