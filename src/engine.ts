import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DEFAULT_CONFIG, resolveConfig } from "./config.ts";
import { ItemRegistry } from "./items/index.ts";
import type { ItemRenderContext, StatuslineConfig, StatuslineItem } from "./types.ts";

/**
 * Main coordinator for pi-statusline.
 */
export class StatuslineEngine {
  private pi: ExtensionAPI;
  private registry = new ItemRegistry();
  private config: StatuslineConfig = structuredClone(DEFAULT_CONFIG);
  private currentCtx?: ExtensionContext;
  private isStreaming = false;

  constructor(pi: ExtensionAPI, initialConfig?: Partial<StatuslineConfig>) {
    this.pi = pi;
    this.config = resolveConfig(initialConfig);
  }

  /**
   * Register a new or custom statusline item.
   */
  registerItem(item: StatuslineItem): void {
    this.registry.register(item);
    if (item.setup) {
      item.setup(this.pi);
    }
  }

  /**
   * Get an item by ID.
   */
  getItem(id: string): StatuslineItem | undefined {
    return this.registry.get(id);
  }

  /**
   * List all registered items.
   */
  listItems(): StatuslineItem[] {
    return this.registry.getAll();
  }

  /**
   * Current active configuration.
   */
  getConfig(): StatuslineConfig {
    return this.config;
  }

  /**
   * Update configuration dynamically.
   */
  updateConfig(updates: Partial<StatuslineConfig>): void {
    this.config = resolveConfig({
      ...this.config,
      ...updates,
    });
    this.render();
  }

  /**
   * Toggle an item on/off.
   */
  toggleItem(id: string, enabled?: boolean): boolean {
    const current = this.config.items[id]?.enabled ?? true;
    const nextState = typeof enabled === "boolean" ? enabled : !current;

    this.config.items[id] = {
      ...(this.config.items[id] || {}),
      enabled: nextState,
    };

    this.render();
    return nextState;
  }

  /**
   * Switch display mode (append or replace).
   */
  setMode(mode: "append" | "replace"): void {
    if (this.config.mode === mode) return;

    if (this.config.mode === "replace" && mode === "append") {
      // Restore native footer
      if (this.currentCtx?.hasUI) {
        this.currentCtx.ui.setFooter(undefined);
      }
    } else if (this.config.mode === "append" && mode === "replace") {
      // Clear native status slot
      if (this.currentCtx?.hasUI) {
        this.currentCtx.ui.setStatus("statusline", undefined);
      }
    }

    this.config.mode = mode;
    this.render();
  }

  /**
   * Initialize hooks on Pi extension lifecycle.
   */
  setup(): void {
    // 1. Setup registered items
    for (const item of this.registry.getAll()) {
      if (item.setup) {
        item.setup(this.pi);
      }
    }

    // 2. Lifecycle event hooks
    this.pi.on("session_start", async (event: any, ctx: ExtensionContext) => {
      this.currentCtx = ctx;
      this.isStreaming = false;

      for (const item of this.registry.getAll()) {
        if (item.onSessionStart) {
          await item.onSessionStart(event, ctx);
        }
      }
      this.render();
    });

    this.pi.on("model_select", async (event: any, ctx: ExtensionContext) => {
      this.currentCtx = ctx;
      for (const item of this.registry.getAll()) {
        if (item.onModelSelect) {
          await item.onModelSelect(event, ctx);
        }
      }
      this.render();
    });

    this.pi.on("turn_start", async (event: any, ctx: ExtensionContext) => {
      this.currentCtx = ctx;
      this.isStreaming = false;

      for (const item of this.registry.getAll()) {
        if (item.onTurnStart) {
          await item.onTurnStart(event, ctx);
        }
      }
      this.render();
    });

    this.pi.on("message_start", async (event: any, ctx: ExtensionContext) => {
      this.currentCtx = ctx;
      this.isStreaming = true;

      for (const item of this.registry.getAll()) {
        if (item.onMessageStart) {
          await item.onMessageStart(event, ctx);
        }
      }
      this.render();
    });

    this.pi.on("message_update", async (event: any, ctx: ExtensionContext) => {
      this.currentCtx = ctx;

      for (const item of this.registry.getAll()) {
        if (item.onMessageUpdate) {
          await item.onMessageUpdate(event, ctx);
        }
      }
      this.render();
    });

    this.pi.on("message_end", async (event: any, ctx: ExtensionContext) => {
      this.currentCtx = ctx;
      this.isStreaming = false;

      for (const item of this.registry.getAll()) {
        if (item.onMessageEnd) {
          await item.onMessageEnd(event, ctx);
        }
      }
      this.render();
    });

    this.pi.on("turn_end", async (event: any, ctx: ExtensionContext) => {
      this.currentCtx = ctx;
      this.isStreaming = false;

      for (const item of this.registry.getAll()) {
        if (item.onTurnEnd) {
          await item.onTurnEnd(event, ctx);
        }
      }
      this.render();
    });

    this.pi.on("session_shutdown", async () => {
      for (const item of this.registry.getAll()) {
        if (item.dispose) {
          item.dispose();
        }
      }
      if (this.currentCtx?.hasUI) {
        this.currentCtx.ui.setStatus("statusline", undefined);
      }
    });

    // 3. Register Slash Commands
    this.registerCommands();
  }

  /**
   * Determine item ordering.
   */
  private getOrderedItems(): StatuslineItem[] {
    const all = this.registry.getAll();
    const orderMap = new Map<string, number>();

    if (this.config.order) {
      this.config.order.forEach((id, index) => {
        orderMap.set(id, index);
      });
    }

    return [...all].sort((a, b) => {
      const orderA = orderMap.has(a.id) ? orderMap.get(a.id)! : 1000 + (a.priority ?? 100);
      const orderB = orderMap.has(b.id) ? orderMap.get(b.id)! : 1000 + (b.priority ?? 100);
      return orderA - orderB;
    });
  }

  /**
   * Build the formatted string of all enabled items.
   */
  buildOutput(ctx: ExtensionContext): string | undefined {
    const renderContext: ItemRenderContext = {
      ctx,
      theme: ctx.ui.theme,
      isStreaming: this.isStreaming,
      separator: this.config.separator,
    };

    const orderedItems = this.getOrderedItems();
    const segments: string[] = [];

    for (const item of orderedItems) {
      const itemConfig = this.config.items[item.id] || {};
      const isEnabled = itemConfig.enabled ?? item.defaultEnabled ?? true;

      if (!isEnabled) continue;

      const rendered = item.render(renderContext, itemConfig);
      if (rendered && rendered.trim().length > 0) {
        segments.push(rendered.trim());
      }
    }

    if (segments.length === 0) {
      return undefined;
    }

    const content = segments.join(this.config.separator);
    return `${this.config.prefix}${content}${this.config.suffix}`;
  }

  /**
   * Trigger rendering according to active mode.
   */
  render(): void {
    if (!this.currentCtx || !this.currentCtx.hasUI) return;

    const output = this.buildOutput(this.currentCtx);

    if (this.config.mode === "append") {
      // Non-destructive append to native footer status bar
      this.currentCtx.ui.setStatus("statusline", output);
    } else {
      // Replace footer
      this.currentCtx.ui.setFooter((_tui: any, _theme: any, _footerData: any) => {
        return {
          dispose: () => {},
          invalidate: () => {},
          render: (width: number) => {
            return output ? [output.slice(0, width)] : [];
          },
        };
      });
    }
  }

  private registerCommands(): void {
    this.pi.registerCommand("statusline", {
      description: "Manage pi-statusline (toggle items, change mode, inspect state)",
      handler: async (args: string, ctx: ExtensionContext) => {
        const parts = args.trim().split(/\s+/).filter(Boolean);
        const sub = parts[0]?.toLowerCase();

        if (sub === "toggle" && parts[1]) {
          const itemId = parts[1];
          if (!this.registry.has(itemId)) {
            ctx.ui.notify(`Unknown item: "${itemId}"`, "warning");
            return;
          }
          const newState = this.toggleItem(itemId);
          ctx.ui.notify(`Item "${itemId}" ${newState ? "enabled" : "disabled"}`, "info");
          return;
        }

        if (sub === "mode" && parts[1]) {
          const mode = parts[1].toLowerCase();
          if (mode === "append" || mode === "replace") {
            this.setMode(mode as "append" | "replace");
            ctx.ui.notify(`Display mode set to "${mode}"`, "info");
            return;
          }
          ctx.ui.notify(`Invalid mode: "${mode}". Valid options: append, replace`, "warning");
          return;
        }

        if ((sub === "sep" || sub === "separator") && parts.length > 1) {
          const rawSep = args.trim().slice(sub.length).trim();
          const unquoted = rawSep.replace(/^["'](.*)["']$/, "$1");
          this.updateConfig({ separator: unquoted });
          ctx.ui.notify(`Separator set to "${unquoted}"`, "info");
          return;
        }

        if (sub === "list" || !sub) {
          const items = this.registry.getAll();
          const infoLines = items.map((it) => {
            const enabled = this.config.items[it.id]?.enabled ?? it.defaultEnabled ?? true;
            return `• ${it.id} (${it.name}): ${enabled ? "ON" : "OFF"}${it.description ? ` — ${it.description}` : ""}`;
          });

          const summary = [
            `pi-statusline [mode: ${this.config.mode}, separator: "${this.config.separator}"]`,
            ...infoLines,
            "",
            "Usage:",
            "  /statusline toggle <item>     - Toggle an item",
            "  /statusline mode <mode>       - Set mode (append | replace)",
            "  /statusline sep <separator>   - Set separator (e.g. ' ' or ' · ')",
          ].join("\n");

          ctx.ui.notify(summary, "info");
        }
      },
    });
  }
}
