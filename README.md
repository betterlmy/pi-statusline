# @betterlmy/pi-statusline

**Modular, pluggable, and fully configurable statusline/footer extension engine for [Pi Coding Agent](https://github.com/earendil-works/pi-coding-agent).**

English | [简体中文](./README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/@betterlmy/pi-statusline.svg)](https://www.npmjs.com/package/@betterlmy/pi-statusline)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![pi extension](https://img.shields.io/badge/pi-extension-blueviolet)](https://github.com/earendil-works/pi-coding-agent)

---

## Why pi-statusline?

Pi provides a functional native two-line footer displaying working directory, git branch, token counters, cost, context window ratio, active model, and reasoning level.

When developers want additional telemetry (such as generation speed, latency, git state, or custom metrics), existing plugins often replace the entire footer via `ctx.ui.setFooter()`, erasing native information.

**pi-statusline is designed around two principles:**
1. **Non-destructive by default (`append` mode)**: Uses Pi's native `ctx.ui.setStatus()` to attach an extra statusline row beneath the native footer. All original status indicators remain completely intact.
2. **Modular & pluggable (`StatuslineItem`)**: Every item is an isolated, configurable component. Toggle, reorder, format, or build your own custom metrics with minimal effort.

---

## Installation

### From npm (Recommended)

```bash
pi install npm:@betterlmy/pi-statusline 
```

### From GitHub

```bash
pi install git:github.com/betterlmy/pi-statusline
```

### Local Development / Linking

```bash
pi install ./path/to/pi-statusline
```

### Try for a single session without saving

```bash
pi -e npm:@betterlmy/pi-statusline
```

After installation, run `/reload` in any active Pi session or restart Pi.

---

## Display Modes

| Mode | Underlying API | Visual Behavior |
| --- | --- | --- |
| `append` *(Default)* | `ctx.ui.setStatus` | **Non-destructive append**. Attaches beneath native footer rows without altering or replacing any default elements. |
| `replace` | `ctx.ui.setFooter` | **Full takeover**. Replaces the entire footer with statusline output for users who want total layout control. |

Switch modes anytime interactively:

```bash
/statusline mode append
/statusline mode replace
```

---

## Slash Commands

| Command | Description |
| --- | --- |
| `/statusline` or `/statusline list` | Inspect current mode, active separator, and on/off status of all items |
| `/statusline toggle <item>` | Toggle an item on/off on the fly (e.g. `/statusline toggle tps`) |
| `/statusline mode <append\|replace>` | Switch between non-destructive append and full footer takeover |
| `/statusline sep <separator>` | Update the delimiter between metrics (e.g. `"/statusline sep ' '"` or `"/statusline sep ' · '"`) |

---

## Built-in Items

### `tps` (Tokens Per Second & Turn Latency)

Provides reliable, inference-aware generation throughput statistics.

#### Default Output

* **During Streaming (Live)**:
  ```text
  ⚡ 45.0tok/s
  ```
* **At Rest (Turn-end authoritative)**:
  ```text
  48.2tok/s TTFT 0.6s Total 2.4s
  ```

#### Algorithm Highlights

* **Sub-millisecond TTFT**: Measures pure latency from turn initiation until the first assistant token chunk arrives. Immune to preceding user prompts or tool executions.
* **Inference Stall Detection**: Discovers streaming gaps $\ge 500\text{ms}$ (caused by GPU scheduling, queue pauses, or prompt processing delays) and subtracts them from active generation time, preventing artificial rate deflation.
* **Session Rehydration**: Telemetry is automatically persisted to the session tree (`statusline:tps`), immediately restoring stats upon session resume or `/reload`.

#### Configuration Options

```typescript
tps: {
  enabled: true,            // Toggle the item on/off
  live: true,               // Show animated live throughput during streaming
  showTPSPrefix: false,     // Prepend "TPS " before the speed rate (default: false)
  showTTFT: true,           // Show Time-To-First-Token in seconds
  showTotalTime: true,      // Show total wall-clock elapsed time
  totalLabel: "Total",      // Prefix label before total elapsed time (set "" to omit)
  showTokens: false,        // Show input and output token counts (e.g. ↑620 ↓1.4k)
  showStall: false,         // Show stall count and duration when stalls occur (e.g. stall 1.2s×2)
  stallThresholdMs: 500,    // Threshold in ms to classify inference pauses as stalls
  separator: " ",           // Custom delimiter between sub-metrics (default: " ")
}
```

---

## Writing a Custom Statusline Item

Creating a new statusline item requires only implementing the `StatuslineItem` interface:

```typescript
import type { StatuslineItem, ItemRenderContext } from "@betterlmy/pi-statusline";

export class GitBranchItem implements StatuslineItem {
  id = "git-branch";
  name = "Git Branch";
  description = "Shows the active git branch";
  defaultEnabled = true;
  priority = 50;

  render(context: ItemRenderContext, config: Record<string, unknown>): string | undefined {
    // Access current Pi context, active theme, and streaming state
    const { ctx, theme } = context;
    const branch = "main"; // retrieve dynamically
    return theme.fg("accent", `git:${branch}`);
  }
}
```

Register your item with the engine:

```typescript
import statuslineExtension from "@betterlmy/pi-statusline";

export default function (pi: ExtensionAPI) {
  const engine = statuslineExtension(pi);
  engine.registerItem(new GitBranchItem());
}
```

---

## Configuration Reference

Customize global and per-item behavior in your configuration:

```typescript
{
  mode: "append",             // "append" | "replace"
  separator: " ",             // Global delimiter between items
  prefix: "",                 // Global prefix for the statusline row
  suffix: "",                 // Global suffix for the statusline row
  order: ["tps", "custom"],   // Explicit item ordering
  items: {
    tps: {
      enabled: true,
      live: true,
      showTTFT: true,
      showTotalTime: true,
      totalLabel: "Total",
      separator: " ",
    },
  },
}
```

---

## Publishing & CI/CD

This package includes automated GitHub Actions workflows:

* `.github/workflows/ci.yml`: Runs `typecheck` and `test` on push and PR.
* `.github/workflows/publish.yml`: Automates npm publication with cryptographic provenance (`--provenance`) when pushing a tag (e.g. `v0.1.0`) using npm Trusted Publishing (OIDC).

---

## License

[MIT](./LICENSE)
