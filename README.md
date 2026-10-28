# pi-statusline

Modular, pluggable, and fully configurable statusline/footer extension engine for [Pi Coding Agent](https://github.com/earendil-works/pi-coding-agent).

[![pi extension](https://img.shields.io/badge/pi-extension-blueviolet)](https://github.com/earendil-works/pi-coding-agent)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

---

## Highlights

- **Pluggable Item Architecture**: Everything on the statusline is a self-contained `StatuslineItem`. Toggle, reorder, or write your own custom metrics with minimal effort.
- **Append by Default (Zero UI Interference)**: Runs in non-destructive `append` mode (`ctx.ui.setStatus`), dynamically attaching to Pi's native statusline without touching or overriding the default path, git branch, token counters, or model indicators.
- **Optional Replace Mode**: Need full takeover? Switch to `replace` mode (`ctx.ui.setFooter`) to render a bespoke footer layout.
- **Built-in Precision TPS**:
  - Sub-millisecond TTFT (Time to First Token) measurement.
  - Automatic GPU & queue stall detection (deducted from active generation window).
  - Live streaming throughput indicator (`⚡ tok/s`).
  - Rest/idle authoritative speed, token breakdowns, and turn duration.
  - Session rehydration: restores telemetry after `/reload` or session resume.
- **Interactive Slash Commands**: Manage items and display modes on the fly via `/statusline`.

---

## Installation

### From GitHub

```bash
pi install git:github.com/betterlmy/pi-statusline
```

### Try without installing (single session)

```bash
pi -e git:github.com/betterlmy/pi-statusline
```

---

## Display Modes

| Mode | API | Behavior |
| --- | --- | --- |
| `append` *(Default)* | `ctx.ui.setStatus` | Appends a dedicated statusline row beneath Pi's native 2-row footer. Zero risk of breaking existing indicators. |
| `replace` | `ctx.ui.setFooter` | Replaces the native footer completely with your statusline content. |

Switch modes anytime via command:
```bash
/statusline mode append
/statusline mode replace
```

---

## Commands

| Command | Description |
| --- | --- |
| `/statusline` or `/statusline list` | Show active mode and status of all registered items |
| `/statusline toggle <item>` | Toggle an item on/off (e.g. `/statusline toggle tps`) |
| `/statusline mode <append\|replace>` | Switch between non-destructive append and full footer replace |

---

## Built-in Items

### `tps` (Tokens Per Second)

Provides high-precision generation performance statistics:

```
TPS 48.2 tok/s · TTFT 0.6s · 2.4s
```

During streaming, it renders an animated live estimate:
```
⚡ 45.0 tok/s
```

Configurable options for `tps`:
- `enabled`: Toggle the item on/off (default: `true`).
- `live`: Show live estimate during streaming (default: `true`).
- `showTTFT`: Show Time-To-First-Token in seconds (default: `true`).
- `showTotalTime`: Show total wall-clock elapsed time (default: `true`).
- `showTokens`: Show input and output token counts (default: `false`).
- `showStall`: Show stall count and duration when stalls >= 500ms occur (default: `false`).
- `stallThresholdMs`: Threshold in ms to classify inference pauses as stalls (default: `500`).

---

## Writing a Custom Item

Any custom metric can be plugged into `pi-statusline`:

```typescript
import type { StatuslineItem, ItemRenderContext } from "@betterlmy/pi-statusline";

export class GitStatusItem implements StatuslineItem {
  id = "git-summary";
  name = "Git Summary";
  defaultEnabled = true;
  priority = 50;

  render(context: ItemRenderContext): string | undefined {
    const branch = "main"; // fetch from git
    return context.theme.fg("accent", `[git: ${branch}]`);
  }
}
```

Register it with the engine:

```typescript
engine.registerItem(new GitStatusItem());
```

---

## License

[MIT](./LICENSE)
