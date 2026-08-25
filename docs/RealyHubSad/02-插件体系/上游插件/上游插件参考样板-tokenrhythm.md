# 上游插件参考样板（tokenrhythm）

> **概述文档**：tokenrhythm（基云律动）作为上游插件的参考示例说明。
> 完整可运行内容见 **plugin 目录**（不是本文件，避免双份维护）。

---

## 1. 这个示例展示什么

tokenrhythm 是"**协议有怪癖的平台**"的典型代表，展示了：

| 关注点 | 做法 |
|---|---|
| **kind 选择** | `Upstream-text-api-balance`（文本 + key + 余额计费） |
| **协议分工** | OpenAI 用 yaml（标准）；Anthropic/Responses 用 ts（有怪癖） |
| **静态规则** | `anthropic-version` 强制头 + `max_tokens` 必传 → yaml `special` |
| **条件修正** | thinking+temperature 400、扁平工具格式 → ts `convert_request` |
| **能力探测** | `/models` 的 `supports_anthropic/responses` → ts `list_models` |
| **余额查询** | `quota_balance`（纯数字，无货币符号） |

## 2. 详细内容看 plugin 目录

```
plugin/Template/UpStream/            # 模板（复制改名用）
plugin/Example/UpStream/Api/
├── tokenrhythm/tokenrhythm-1.0.0/   # 本示例（Upstream-text-api-balance）
├── opencode-go/opencode-go-1.0.0/   # 套餐限额示例（Upstream-text-api-quota）
└── one-api/one-api-1.0.0/           # 中转站作为上游示例
```

> **详细内容**（upstream.yaml + http.yaml + convert.ts + models.ts + quota.ts）见
> [Plugin/Example/UpStream/Api/tokenrhythm/](../../../../Plugin/Example/UpStream/Api/tokenrhythm/)。

## 3. Sub 类模板状态

> ⚠️ **Upstream-<模态>-sub（账号池类）暂无完整示例** —— plugin 目录目前只有 text+Api 类（Balance/Quota）。
> Sub 类（sub2api / CPA 等账号池平台）的插件待写，模板见
> [插件模板分类](../插件模板分类.md) §3（Upstream-<模态>-sub yaml 骨架）。

## 4. 相关文档

- [上游定义声明化设计](./上游定义声明化设计.md) —— yaml 契约
- [平台差异与协议兼容处理](./平台差异与协议兼容处理.md) —— 平台怪癖处理
- [插件开发规范](../插件开发规范.md) —— 插件名规范（`-` 不用 `_`）等
