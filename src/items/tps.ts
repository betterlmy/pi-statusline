import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ItemRenderContext, StatuslineItem } from "../types.ts";

export interface TPSConfig {
  enabled?: boolean;
  live?: boolean;
  showTPSPrefix?: boolean;
  showTTFT?: boolean;
  showTotalTime?: boolean;
  totalLabel?: string;
  showTokens?: boolean;
  showStall?: boolean;
  stallThresholdMs?: number;
  separator?: string;
}

export interface TurnTelemetry {
  tps: number | null;
  model: {
    provider: string;
    modelId: string;
  };
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  timing: {
    ttftMs: number | null;
    totalMs: number;
    generationMs: number;
    stallMs: number;
    stallCount: number;
    messageCount: number;
  };
  timestamp: number;
}

interface MessageTiming {
  startTime: number;
  firstUpdate: number | null;
  lastUpdate: number | null;
  stallMs: number;
  stallCount: number;
  inStall: boolean;
  outputChars: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatTokens(count: number): string {
  if (count < 1000) return `${count}`;
  if (count < 1000000) {
    const val = (count / 1000).toFixed(1);
    return `${val.endsWith(".0") ? val.slice(0, -2) : val}k`;
  }
  const val = (count / 1000000).toFixed(1);
  return `${val.endsWith(".0") ? val.slice(0, -2) : val}M`;
}

/**
 * High-precision TPS statusline item.
 * Supports TTFT, GPU stall detection, live streaming TPS, and session rehydration.
 */
export class TPSItem implements StatuslineItem<TPSConfig> {
  id = "tps";
  name = "Tokens Per Second";
  description = "Tracks LLM generation speed, TTFT, stalls, and token counts.";
  defaultEnabled = true;
  priority = 10;

  private pi?: ExtensionAPI;
  private currentTurnStart: number | null = null;
  private firstTokenMs: number | null = null;
  private currentMsg: MessageTiming | null = null;
  private completedMessages: MessageTiming[] = [];
  private accumulatedTokens = { input: 0, output: 0 };
  private activeModel = { provider: "", modelId: "" };

  private isStreaming = false;
  private liveEstimatedTokens = 0;
  private lastLiveRenderTime = 0;

  // Stored last turn telemetry
  private lastTelemetry: TurnTelemetry | null = null;

  setup(pi: ExtensionAPI): void {
    this.pi = pi;
  }

  onSessionStart(_event: unknown, ctx: ExtensionContext): void {
    if (ctx.model) {
      this.activeModel = {
        provider: ctx.model.provider || "unknown",
        modelId: ctx.model.id || "unknown",
      };
    }

    // Rehydrate last turn telemetry from session history
    try {
      const entries = ctx.sessionManager.getBranch();
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry.type === "custom" && (entry.customType === "statusline:tps" || entry.customType === "tps")) {
          const data = entry.data as TurnTelemetry | null;
          if (data && typeof data.tps !== "undefined") {
            this.lastTelemetry = data;
            break;
          }
        }
      }
    } catch {
      // Session manager might not have entries yet
    }
  }

  onModelSelect(event: unknown): void {
    const evt = event as { model?: { provider?: string; id?: string } };
    if (evt?.model) {
      this.activeModel = {
        provider: evt.model.provider || "unknown",
        modelId: evt.model.id || "unknown",
      };
    }
  }

  onTurnStart(_event: unknown, ctx: ExtensionContext): void {
    this.currentTurnStart = performance.now();
    this.firstTokenMs = null;
    this.completedMessages = [];
    this.currentMsg = null;
    this.accumulatedTokens = { input: 0, output: 0 };
    this.isStreaming = false;
    this.liveEstimatedTokens = 0;
    this.lastLiveRenderTime = 0;

    if (ctx.model) {
      this.activeModel = {
        provider: ctx.model.provider || "unknown",
        modelId: ctx.model.id || "unknown",
      };
    }
  }

  onMessageStart(event: unknown): void {
    const evt = event as { message?: { role?: string } };
    // Only track assistant messages (ignore user and toolResult messages)
    if (evt?.message?.role && evt.message.role !== "assistant") {
      return;
    }

    this.isStreaming = true;
    this.currentMsg = {
      startTime: performance.now(),
      firstUpdate: null,
      lastUpdate: null,
      stallMs: 0,
      stallCount: 0,
      inStall: false,
      outputChars: 0,
    };
  }

  onMessageUpdate(event: unknown, ctx: ExtensionContext): void {
    const evt = event as { message?: { role?: string; content?: Array<{ type: string; text?: string }> } };
    // Only track assistant messages
    if (evt?.message?.role && evt.message.role !== "assistant") {
      return;
    }

    const now = performance.now();

    // Capture turn-level TTFT on first assistant token update
    if (this.firstTokenMs === null && this.currentTurnStart !== null) {
      this.firstTokenMs = now;
    }

    if (!this.currentMsg) {
      this.currentMsg = {
        startTime: now,
        firstUpdate: now,
        lastUpdate: now,
        stallMs: 0,
        stallCount: 0,
        inStall: false,
        outputChars: 0,
      };
    }

    // Extract length if text is available
    if (evt?.message?.content) {
      let chars = 0;
      for (const block of evt.message.content) {
        if (block.type === "text" && block.text) {
          chars += block.text.length;
        }
      }
      this.currentMsg.outputChars = chars;
      // Rough estimation: 1 token ≈ 4 characters
      this.liveEstimatedTokens = Math.max(1, Math.round(chars / 4));
    }

    if (this.currentMsg.firstUpdate === null) {
      this.currentMsg.firstUpdate = now;
      this.currentMsg.lastUpdate = now;
      return;
    }

    const gap = now - (this.currentMsg.lastUpdate ?? now);
    const stallThreshold = 500;

    if (gap >= stallThreshold) {
      this.currentMsg.stallMs += gap;
      if (!this.currentMsg.inStall) {
        this.currentMsg.stallCount++;
        this.currentMsg.inStall = true;
      }
    } else {
      this.currentMsg.inStall = false;
    }

    this.currentMsg.lastUpdate = now;

    // Trigger throttled live render if requested
    if (now - this.lastLiveRenderTime > 200 && ctx.hasUI) {
      this.lastLiveRenderTime = now;
    }
  }

  onMessageEnd(event: unknown): void {
    const evt = event as {
      message?: {
        role?: string;
        usage?: { input?: number; output?: number };
      };
    };

    if (evt?.message?.role && evt.message.role !== "assistant") {
      return;
    }

    this.isStreaming = false;
    if (this.currentMsg) {
      this.completedMessages.push(this.currentMsg);
      this.currentMsg = null;
    }

    if (evt?.message?.usage) {
      this.accumulatedTokens.input += evt.message.usage.input || 0;
      this.accumulatedTokens.output += evt.message.usage.output || 0;
    }
  }

  onTurnEnd(_event: unknown, ctx: ExtensionContext): void {
    if (this.currentTurnStart === null) return;
    const now = performance.now();
    const totalMs = now - this.currentTurnStart;

    // Flush currentMsg if still active
    if (this.currentMsg) {
      this.completedMessages.push(this.currentMsg);
      this.currentMsg = null;
    }

    // Aggregate message stats
    let totalStallMs = 0;
    let totalStallCount = 0;
    let activeStreamMs = 0;

    for (const m of this.completedMessages) {
      totalStallMs += m.stallMs;
      totalStallCount += m.stallCount;

      if (m.firstUpdate !== null && m.lastUpdate !== null) {
        activeStreamMs += Math.max(0, m.lastUpdate - m.firstUpdate - m.stallMs);
      }
    }

    // Robust TTFT calculation
    let firstTtftMs: number | null = null;
    if (this.firstTokenMs !== null) {
      firstTtftMs = Math.max(0, this.firstTokenMs - this.currentTurnStart);
    } else {
      // Fallback: search completed messages
      for (const m of this.completedMessages) {
        if (m.firstUpdate !== null) {
          firstTtftMs = Math.max(0, m.firstUpdate - this.currentTurnStart);
          break;
        }
      }
    }

    const outputTokens = this.accumulatedTokens.output;
    let tps: number | null = null;

    if (outputTokens > 0) {
      const durationSeconds = activeStreamMs > 50 ? activeStreamMs / 1000 : totalMs / 1000;
      if (durationSeconds > 0) {
        tps = Math.round((outputTokens / durationSeconds) * 10) / 10;
      }
    }

    this.lastTelemetry = {
      tps,
      model: { ...this.activeModel },
      tokens: {
        input: this.accumulatedTokens.input,
        output: this.accumulatedTokens.output,
        total: this.accumulatedTokens.input + this.accumulatedTokens.output,
      },
      timing: {
        ttftMs: firstTtftMs,
        totalMs,
        generationMs: activeStreamMs,
        stallMs: totalStallMs,
        stallCount: totalStallCount,
        messageCount: this.completedMessages.length,
      },
      timestamp: Date.now(),
    };

    // Persist to session
    try {
      this.pi?.appendEntry("statusline:tps", this.lastTelemetry);
    } catch {
      // Ignore append errors
    }

    // Emit event on shared bus for external tools
    try {
      this.pi?.events.emit("statusline:tps", this.lastTelemetry);
      this.pi?.events.emit("tps:telemetry", this.lastTelemetry);
    } catch {
      // Ignore emit errors
    }

    this.currentTurnStart = null;
    this.completedMessages = [];
  }

  render(context: ItemRenderContext, config: TPSConfig): string | undefined {
    if (config.enabled === false) {
      return undefined;
    }

    const { theme } = context;

    // 1. Streaming live view
    if (context.isStreaming && config.live !== false) {
      if (this.currentTurnStart !== null && this.currentMsg?.firstUpdate) {
        const streamElapsed = Math.max(0, (performance.now() - this.currentMsg.firstUpdate - this.currentMsg.stallMs) / 1000);
        const liveTps = streamElapsed > 0.1 && this.liveEstimatedTokens > 0
          ? (this.liveEstimatedTokens / streamElapsed).toFixed(1)
          : "—";

        return theme.fg("accent", `⚡ ${liveTps}tok/s`);
      }
      return theme.fg("accent", "⚡ streaming...");
    }

    // 2. Idle / Last turn view
    if (!this.lastTelemetry) {
      return undefined;
    }

    const t = this.lastTelemetry;
    const parts: string[] = [];

    // Generation speed: omit "TPS " prefix by default, no space before tok/s
    const prefix = config.showTPSPrefix ? "TPS " : "";
    const tpsStr = t.tps !== null ? `${prefix}${t.tps.toFixed(1)}tok/s` : (config.showTPSPrefix ? "TPS —" : "—tok/s");
    parts.push(theme.fg("success", tpsStr));

    // TTFT
    if (config.showTTFT !== false && t.timing.ttftMs !== null) {
      parts.push(`TTFT ${formatDuration(t.timing.ttftMs / 1000)}`);
    }

    // Total wall-clock time (labeled "Total" to distinguish from TTFT)
    if (config.showTotalTime !== false) {
      const label = typeof config.totalLabel === "string" ? config.totalLabel : "Total";
      const totalPrefix = label.length > 0 ? `${label} ` : "";
      parts.push(`${totalPrefix}${formatDuration(t.timing.totalMs / 1000)}`);
    }

    // Token counts (disabled by default)
    if (config.showTokens === true && (t.tokens.input > 0 || t.tokens.output > 0)) {
      parts.push(`↑${formatTokens(t.tokens.input)} ↓${formatTokens(t.tokens.output)}`);
    }

    // Stalls (disabled by default)
    if (config.showStall === true && t.timing.stallMs > 0) {
      const stallDuration = formatDuration(t.timing.stallMs / 1000);
      parts.push(theme.fg("warning", `stall ${stallDuration}×${t.timing.stallCount}`));
    }

    const separator = typeof config.separator === "string" ? config.separator : (context.separator ?? " ");
    return parts.join(separator);
  }
}
