import assert from "node:assert/strict";
import test from "node:test";
import { TPSItem } from "../src/items/tps.ts";

test("TPSItem - calculates turn telemetry and renders idle view", async () => {
  const item = new TPSItem();

  const mockPi = {
    appendEntry() {},
    events: {
      emit() {},
    },
  };
  item.setup(mockPi);

  const mockCtx = {
    hasUI: true,
    model: { provider: "anthropic", id: "claude-3-5-sonnet" },
    sessionManager: {
      getBranch() {
        return [];
      },
    },
    ui: {
      theme: {
        fg(color, text) {
          return `[${color}]${text}[/]`;
        },
      },
    },
  };

  item.onSessionStart({}, mockCtx);
  item.onTurnStart({}, mockCtx);
  item.onMessageStart({});

  // Simulate streaming updates
  item.onMessageUpdate(
    {
      message: {
        content: [{ type: "text", text: "Hello world this is a test response for TPS" }],
      },
    },
    mockCtx,
  );

  item.onMessageEnd({
    message: {
      role: "assistant",
      usage: { input: 150, output: 50 },
    },
  });

  item.onTurnEnd({}, mockCtx);

  const renderContext = {
    ctx: mockCtx,
    theme: mockCtx.ui.theme,
    isStreaming: false,
  };

  const rendered = item.render(renderContext, {
    enabled: true,
    showTTFT: true,
    showTotalTime: true,
    showTokens: true,
  });

  assert.ok(rendered, "Rendered output should not be empty");
  assert.ok(rendered.includes("tok/s"), "Should contain tok/s");
  assert.ok(!rendered.includes("TPS "), "Should omit TPS prefix by default");
  assert.ok(rendered.includes("TTFT"), "Should contain TTFT label");
  assert.ok(rendered.includes("Total "), "Should contain Total prefix for total duration");
  assert.ok(rendered.includes("↑150 ↓50"), "Should display token count when explicitly enabled");

  // Render with defaults (showTokens and showStall should be omitted, separator is space)
  const defaultRendered = item.render(renderContext, {});
  assert.ok(defaultRendered, "Default rendered output should exist");
  assert.ok(defaultRendered.includes("tok/s"), "Default should have tok/s");
  assert.ok(!defaultRendered.includes("TPS "), "Default should not have TPS prefix");
  assert.ok(defaultRendered.includes("TTFT"), "Default should have TTFT");
  assert.ok(defaultRendered.includes("Total "), "Default should have Total label");
  assert.ok(!defaultRendered.includes("↑"), "Default should not display tokens");
  assert.ok(!defaultRendered.includes("stall"), "Default should not display stalls");
  assert.ok(!defaultRendered.includes(" · "), "Default should use space separator, not middle dot");

  // Custom separator in item config
  const customSepRendered = item.render(renderContext, { separator: " | " });
  assert.ok(customSepRendered.includes(" | "), "Should honor custom separator");
});

test("TPSItem - disables rendering when configured off", () => {
  const item = new TPSItem();
  const mockCtx = {
    ui: {
      theme: {
        fg: (_c, t) => t,
      },
    },
  };

  const rendered = item.render(
    { ctx: mockCtx, theme: mockCtx.ui.theme, isStreaming: false },
    { enabled: false },
  );

  assert.equal(rendered, undefined, "Should return undefined when disabled");
});
