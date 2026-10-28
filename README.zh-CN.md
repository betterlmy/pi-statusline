# pi-statusline

适用于 [Pi Coding Agent](https://github.com/earendil-works/pi-coding-agent) 的模块化、插拔式、全配置状态栏 / Footer 扩展引擎。

[![pi extension](https://img.shields.io/badge/pi-extension-blueviolet)](https://github.com/earendil-works/pi-coding-agent)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

---

## 核心特性

- **插拔式模块架构（Item Architecture）**：状态栏上的每一个指标都是独立的 `StatuslineItem`，每一项都可独立开关、配置参数、自定义排序或轻松编写扩展。
- **默认纯追加模式（Append，无破坏性）**：默认采用 `append` 模式（基于 `ctx.ui.setStatus`），仅在原生底部栏下方动态追加状态行，**绝不覆盖或替换** Pi 原生的路径、Git 分支、Token 吞吐、费用及模型信息。
- **可选全量接管模式（Replace）**：如果希望彻底自定义整个底部栏，可自由切换至 `replace` 模式（基于 `ctx.ui.setFooter`）。
- **内置高精度 TPS 测速**：
  - 亚毫秒级 TTFT（首字延迟）测算。
  - GPU / 排队停顿检测（stall detection），自动从纯生成窗口中扣除。
  - 流式生成时的实时动态吞吐指示（`⚡ tok/s`）。
  - 对话结束后的权威结算速度、Token 吞吐明细及耗时。
  - 会话状态恢复（Rehydration）：在 `/reload` 重载或会话恢复后自动恢复上轮统计数据。
- **交互式斜杠命令**：通过 `/statusline` 即可在运行时随时查看状态、开关模块或切换显示模式。

---

## 安装方法

### 通过 GitHub 安装

```bash
pi install git:github.com/betterlmy/pi-statusline
```

### 单次会话试用（无需安装）

```bash
pi -e git:github.com/betterlmy/pi-statusline
```

---

## 显示模式对比

| 模式 | 底层 API | 行为特点 |
| --- | --- | --- |
| `append` *(默认)* | `ctx.ui.setStatus` | **纯追加**。在原生两行 Footer 下方动态追加插件行，原生的所有指标原封不动保留。 |
| `replace` | `ctx.ui.setFooter` | **全盘接管**。完全接管并重绘底部栏。 |

随时通过命令切换模式：
```bash
/statusline mode append
/statusline mode replace
```

---

## 斜杠命令

| 命令 | 说明 |
| --- | --- |
| `/statusline` 或 `/statusline list` | 查看当前模式及所有已注册指标项的开关状态 |
| `/statusline toggle <item>` | 快速开关指定指标项（如 `/statusline toggle tps`） |
| `/statusline mode <append\|replace>` | 在纯追加模式与全盘接管模式之间切换 |
| `/statusline sep <separator>` | 自定义分隔符字符串（如 `"/statusline sep ' '"` 或 `"/statusline sep ' · '"`） |

---

## 内置指标项

### `tps`（每秒 Token 速度）

展示 LLM 生成性能遥测数据：

```
TPS 48.2 tok/s TTFT 0.6s 2.4s
```

在模型流式输出时动态显示：
```
⚡ 45.0 tok/s
```

`tps` 的可配置项：
- `enabled`: 是否启用（默认: `true`）。
- `live`: 流式输出时是否显示实时吞吐（默认: `true`）。
- `showTTFT`: 是否展示首字延迟 TTFT（默认: `true`）。
- `showTotalTime`: 是否展示单轮总耗时（默认: `true`）。
- `showTokens`: 是否展示输入/输出 Token 吞吐（默认: `false`）。
- `showStall`: 发生停顿（>= 500ms）时是否展示停顿时长与次数（默认: `false`）。
- `separator`: 子指标之间的分隔符（默认: 单个空格 `" "`）。
- `stallThresholdMs`: 停顿判定阈值（默认: `500` 毫秒）。

---

## 编写自定义指标项（二开示例）

任何自定义指标均可通过实现 `StatuslineItem` 接口直接插拔接入：

```typescript
import type { StatuslineItem, ItemRenderContext } from "@betterlmy/pi-statusline";

export class MyCustomItem implements StatuslineItem {
  id = "my-metric";
  name = "My Custom Metric";
  defaultEnabled = true;
  priority = 50;

  render(context: ItemRenderContext): string | undefined {
    return context.theme.fg("accent", "自定义指标内容");
  }
}
```

注册到引擎即可：

```typescript
engine.registerItem(new MyCustomItem());
```

---

## 开源协议

[MIT](./LICENSE)
