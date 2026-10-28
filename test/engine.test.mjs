import assert from "node:assert/strict";
import test from "node:test";
import { resolveConfig } from "../src/config.ts";
import { StatuslineEngine } from "../src/engine.ts";

test("resolveConfig - merges partial user overrides", () => {
  const cfg = resolveConfig({
    mode: "replace",
    separator: " | ",
    items: {
      tps: { enabled: false },
    },
  });

  assert.equal(cfg.mode, "replace");
  assert.equal(cfg.separator, " | ");
  assert.equal(cfg.items.tps.enabled, false);
  assert.equal(cfg.items.tps.showTTFT, true, "Should retain default properties not overridden");
});

test("resolveConfig - default separator is single space", () => {
  const defaultCfg = resolveConfig();
  assert.equal(defaultCfg.separator, " ");
});

test("StatuslineEngine - registers items and builds formatted output in append mode", () => {
  let registeredStatus = null;
  const mockPi = {
    on() {},
    registerCommand() {},
    appendEntry() {},
    events: { emit() {} },
  };

  const engine = new StatuslineEngine(mockPi, {
    separator: " /// ",
  });

  // Register custom item
  engine.registerItem({
    id: "custom-clock",
    name: "Clock",
    render: () => "12:00:00",
  });

  const mockCtx = {
    hasUI: true,
    ui: {
      theme: {
        fg: (_c, t) => t,
      },
      setStatus(key, text) {
        registeredStatus = { key, text };
      },
      setFooter() {},
    },
  };

  const output = engine.buildOutput(mockCtx);
  assert.ok(output.includes("12:00:00"), "Should include custom item output");
});

test("StatuslineEngine - toggleItem changes enabled status", () => {
  const mockPi = {
    on() {},
    registerCommand() {},
  };

  const engine = new StatuslineEngine(mockPi);
  const next = engine.toggleItem("tps", false);
  assert.equal(next, false);
  assert.equal(engine.getConfig().items.tps.enabled, false);

  const toggledAgain = engine.toggleItem("tps");
  assert.equal(toggledAgain, true);
  assert.equal(engine.getConfig().items.tps.enabled, true);
});
