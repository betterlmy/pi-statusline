import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * Terminal theme interface provided by Pi's UI context.
 */
export interface ThemeLike {
  fg(color: string, text: string): string;
  bg?(color: string, text: string): string;
  bold?(text: string): string;
  dim?(text: string): string;
}

/**
 * Context passed to each item's render method.
 */
export interface ItemRenderContext {
  ctx: ExtensionContext;
  theme: ThemeLike;
  isStreaming: boolean;
  width?: number;
}

/**
 * Contract for a pluggable statusline item.
 */
export interface StatuslineItem<TConfig = Record<string, unknown>> {
  /** Unique identifier for the item (e.g. "tps", "git", "cost"). */
  id: string;

  /** Human-readable display name. */
  name: string;

  /** Brief description of what the item displays. */
  description?: string;

  /** Whether the item is enabled by default. Default is true. */
  defaultEnabled?: boolean;

  /** Default ordering priority. Lower numbers render first. Default is 100. */
  priority?: number;

  /** Initialize listeners or resources on the Pi Extension API. */
  setup?(pi: ExtensionAPI): void;

  /** Lifecycle hook: session starts or resumes. */
  onSessionStart?(event: unknown, ctx: ExtensionContext): void | Promise<void>;

  /** Lifecycle hook: agent turn starts. */
  onTurnStart?(event: unknown, ctx: ExtensionContext): void | Promise<void>;

  /** Lifecycle hook: message stream starts. */
  onMessageStart?(event: unknown, ctx: ExtensionContext): void | Promise<void>;

  /** Lifecycle hook: message streaming chunk received. */
  onMessageUpdate?(event: unknown, ctx: ExtensionContext): void | Promise<void>;

  /** Lifecycle hook: message stream ends. */
  onMessageEnd?(event: unknown, ctx: ExtensionContext): void | Promise<void>;

  /** Lifecycle hook: agent turn completes. */
  onTurnEnd?(event: unknown, ctx: ExtensionContext): void | Promise<void>;

  /** Lifecycle hook: active model changes. */
  onModelSelect?(event: unknown, ctx: ExtensionContext): void | Promise<void>;

  /** Cleanup resources on shutdown. */
  dispose?(): void;

  /**
   * Render the item's display string.
   * Return undefined or empty string to omit this item from current render.
   */
  render(context: ItemRenderContext, config: TConfig): string | undefined;
}

/**
 * Top-level statusline configuration.
 */
export interface StatuslineConfig {
  /**
   * Display mode:
   * - "append": Non-destructive. Uses ctx.ui.setStatus() to add a statusline
   *   row without replacing or breaking any native footer elements. (Default)
   * - "replace": Replaces the footer completely via ctx.ui.setFooter().
   */
  mode: "append" | "replace";

  /** Separator between enabled items. Default: " · " */
  separator: string;

  /** Optional prefix for the whole statusline. */
  prefix: string;

  /** Optional suffix for the whole statusline. */
  suffix: string;

  /** Custom ordering of item IDs. Items not listed will follow their natural priority. */
  order?: string[];

  /** Per-item configuration dictionary, keyed by item ID. */
  items: Record<string, Record<string, unknown>>;
}
