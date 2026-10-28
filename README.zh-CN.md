# @betterlmy/pi-statusline

**适用于 [Pi Coding Agent](https://github.com/earendil-works/pi-coding-agent) 的模块化、插拔式、全配置状态栏 / Footer 扩展引擎。**

[English](./README.md) | 简体中文

[![npm version](https://img.shields.io/npm/v/@betterlmy/pi-statusline.svg)](https://www.npmjs.com/package/@betterlmy/pi-statusline)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![pi extension](https://img.shields.io/badge/pi-extension-blueviolet)](https://github.com/earendil-works/pi-coding-agent)

---

## 为什么选择 pi-statusline？

Pi 原生自带一套两行底栏，能够展示工作路径、Git 分支、Token 吞吐、费用、上下文水位、当前模型以及思考层级等核心信息。

当开发者希望追加展示生成速率、延迟、Git 详细状态或自定义业务指标时，市面上的插件往往调用 `ctx.ui.setFooter()` **全盘抹掉**原生底栏，导致原有的重要信息彻底丢失。

**pi-statusline 围绕两大核心原则设计：**
1. **默认纯追加，零侵入（`append` 模式）**：基于 Pi 原生的 `ctx.ui.setStatus()` 机制，在原生两行底栏下方**动态追加**一行状态行。原生路径、分支、Token、模型等指示器 100% 完整保留。
2. **高度模块化与插拔式（`StatuslineItem`）**：状态栏上的每一个指标都是独立的组件。任意指标均可单独开关、排序、自定义显示格式，亦可轻松编写属于自己的扩展指标。

---

## 安装方法

### 通过 npm 安装（推荐）

```bash
pi install npm:@betterlmy/pi-statusline
```

### 通过 GitHub 源码安装

```bash
pi install git:github.com/betterlmy/pi-statusline
```

### 本地开发挂载 / 软链接

```bash
pi install ./path/to/pi-statusline
```

### 单次会话临时体验（无需安装）

```bash
pi -e npm:@betterlmy/pi-statusline
```

安装完成后，在当前活动的 Pi 终端中输入 `/reload` 或重启 Pi 即可生效。

---

## 显示模式对比

| 模式 | 底层 API | 视觉表现与行为特点 |
| --- | --- | --- |
| `append` *(默认)* | `ctx.ui.setStatus` | **纯追加模式**。在原生两行 Footer 下方动态追加一行插件状态行，绝不修改或遮挡原生信息。 |
| `replace` | `ctx.ui.setFooter` | **全盘接管模式**。彻底接管并重绘底部底栏，适合需要完全重构底栏排版的高阶用户。 |

随时通过命令交互式切换：

```bash
/statusline mode append
/statusline mode replace
```

---

## 斜杠命令

| 命令 | 说明 |
| --- | --- |
| `/statusline` 或 `/statusline list` | 查看当前工作模式、全局分隔符以及所有已注册指标的开关状态 |
| `/statusline toggle <item>` | 快速开关指定指标项（如 `/statusline toggle tps`） |
| `/statusline mode <append\|replace>` | 在纯追加模式与全盘接管模式之间自由切换 |
| `/statusline sep <separator>` | 即时修改各项之间的分隔符（如 `"/statusline sep ' '"` 或 `"/statusline sep ' · '"`） |

---

## 内置指标项

### `tps`（每秒 Token 速度与生成延迟）

提供精确、抗干扰的 LLM 吞吐与耗时统计。

#### 默认输出形态

* **流式生成过程中（实时动态态）**：
  ```text
  ⚡ 45.0tok/s
  ```
* **单轮生成结算后（常驻结算态）**：
  ```text
  48.2tok/s TTFT 0.6s Total 2.4s
  ```

#### 算法特点

* **亚毫秒级 TTFT 测算**：精准捕获从轮次发起至首个 assistant Token 到达的纯网络与排队延迟，不受前面可能存在的用户消息或工具调用消息干扰。
* **推理停顿监测（Stall Detection）**：实时识别 $\ge 500\text{ms}$ 的流式停顿（由 GPU 调度、排队等待或长推理导致），并从有效生成窗口中扣除，计算出的生成速度真实客观。
* **会话重载恢复（Rehydration）**：指标自动持久化到会话树（`statusline:tps`），执行 `/reload` 或跨会话恢复时自动还原上轮统计，底栏不出现空白。

#### 配置项说明

```typescript
tps: {
  enabled: true,            // 是否启用该指标项
  live: true,               // 流式输出时是否展示动态吞吐动画
  showTPSPrefix: false,     // 速度前是否增加 "TPS " 前缀（默认: false）
  showTTFT: true,           // 是否展示首字延迟 TTFT
  showTotalTime: true,      // 是否展示单轮总耗时
  totalLabel: "Total",      // 总耗时前的提示前缀（设为 "" 则不展示提示词）
  showTokens: false,        // 是否展示 ↑输入 ↓输出 Token 吞吐（默认: false）
  showStall: false,         // 发生停顿（>=500ms）时是否展示停顿时长与次数（默认: false）
  stallThresholdMs: 500,    // 停顿判定阈值（毫秒）
  separator: " ",           // 子指标项之间的分隔符（默认: 单个空格 " "）
}
```

---

## 编写自定义指标项

实现自定义指标只需实现标准的 `StatuslineItem` 接口：

```typescript
import type { StatuslineItem, ItemRenderContext } from "@betterlmy/pi-statusline";

export class GitBranchItem implements StatuslineItem {
  id = "git-branch";
  name = "Git Branch";
  description = "展示当前活动的 Git 分支";
  defaultEnabled = true;
  priority = 50;

  render(context: ItemRenderContext, config: Record<string, unknown>): string | undefined {
    // context 提供 ctx 上下文、active 主题着色方法与流式状态
    const { ctx, theme } = context;
    const branch = "main"; // 动态获取分支
    return theme.fg("accent", `git:${branch}`);
  }
}
```

注册到引擎：

```typescript
import statuslineExtension from "@betterlmy/pi-statusline";

export default function (pi: ExtensionAPI) {
  const engine = statuslineExtension(pi);
  engine.registerItem(new GitBranchItem());
}
```

---

## 配置结构参考

在全局或扩展配置中定制整体表现：

```typescript
{
  mode: "append",             // 显示模式："append"（纯追加）或 "replace"（接管）
  separator: " ",             // 全局指标间的分隔符，默认单个空格
  prefix: "",                 // 状态行全局前缀
  suffix: "",                 // 状态行全局后缀
  order: ["tps", "custom"],   // 显式指定各指标项渲染顺序
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

## 自动化发布与 CI/CD

本仓库已集成自动化 GitHub Actions：

* `.github/workflows/ci.yml`：在 Push 与 PR 时自动执行类型检查（`typecheck`）与单元测试（`test`）。
* `.github/workflows/publish.yml`：基于 npm OIDC Trusted Publishing 免密发布机制。只需在本地打 tag 并推送（如 `git tag v0.1.0 && git push origin v0.1.0`），即可自动打包并带签名（`--provenance`）发布至 npm。

---

## 开源协议

[MIT](./LICENSE)
