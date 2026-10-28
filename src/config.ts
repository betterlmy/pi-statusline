import type { StatuslineConfig } from "./types.ts";

export const DEFAULT_CONFIG: StatuslineConfig = {
  mode: "append",
  separator: " · ",
  prefix: "",
  suffix: "",
  items: {
    tps: {
      enabled: true,
      live: true,
      showTTFT: true,
      showTotalTime: true,
      showTokens: true,
      showStall: true,
      stallThresholdMs: 500,
    },
  },
};

/**
 * Merge user overrides with default configuration.
 */
export function resolveConfig(userConfig?: Partial<StatuslineConfig>): StatuslineConfig {
  if (!userConfig) {
    return structuredClone(DEFAULT_CONFIG);
  }

  const mergedItems: Record<string, Record<string, unknown>> = structuredClone(DEFAULT_CONFIG.items);

  if (userConfig.items) {
    for (const [id, itemConf] of Object.entries(userConfig.items)) {
      mergedItems[id] = {
        ...(mergedItems[id] || {}),
        ...itemConf,
      };
    }
  }

  return {
    mode: userConfig.mode === "replace" ? "replace" : DEFAULT_CONFIG.mode,
    separator: typeof userConfig.separator === "string" ? userConfig.separator : DEFAULT_CONFIG.separator,
    prefix: typeof userConfig.prefix === "string" ? userConfig.prefix : DEFAULT_CONFIG.prefix,
    suffix: typeof userConfig.suffix === "string" ? userConfig.suffix : DEFAULT_CONFIG.suffix,
    order: Array.isArray(userConfig.order) ? [...userConfig.order] : undefined,
    items: mergedItems,
  };
}
