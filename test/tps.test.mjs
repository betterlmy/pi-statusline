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
  assert.ok(rendered.includes("TPS"), "Should contain TPS label");
  assert.ok(rendered.includes("TTFT"), "Should contain TTFT label");
  assert.ok(rendered.includes("↑150 ↓50"), "Should display token count");
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
