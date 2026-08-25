# OpenCode Zen 上游插件

> kind：`Upstream-text-api-free`（文本 + 匿名 key + 免费模型，无余额/套餐计费）
> 平台：OpenCode Zen（https://opencode.ai/zen/v1/）
> 来源：opencode 官方源码（request.ts / zen handler.ts）+ 2026-08-24 抓包实测

## ⚠️ 关于 kind：`Upstream-text-api-free`

kind 是 `Upstream-<模态>-<凭据>-<计费>`（模态 text/image/audio/video/mix；凭据 api/sub；计费 balance/quota/free）。
balance/quota 都需要 `quota_balance` / `quota_usage` 钩子查额度。**zen 免费模型两者都不是**：

- 无余额（匿名 `public`，不绑定账号）
- 无套餐（配额在 **IP 维度**，由 zen 服务端 `createIpRateLimiter` 按 IP 限速）

所以本示例声明为 `Upstream-text-api-free`（文本 + 免费计费 kind）。
语义：**免费模型、无限量、无 balance/quota 查询钩子、限速判定走内核（IP 维度）**。

## ★ 请求头示例及原因（本插件核心）

2026-08-24 对真实 opencode CLI 的抓包：

```json
{
  "User-Agent": "opencode/1.15.0 ai-sdk/provider-utils/4.0.23 runtime/bun/1.3.13",
  "x-opencode-client": "cli",
  "x-opencode-project": "global",
  "x-opencode-request": "msg_po1nt9",
  "x-opencode-session": "ses_po1nt9"
}
```

**为什么伪装成 CLI 的请求头**：zen 后端按客户端标识分配不同的 TPS 配额
（源码 `modelTpsLimits: Record<string, { qualify; unqualify }>`），CLI 客户端
（`x-opencode-client: cli`）拿到的是更高一档（qualify）配额，用量更大、更不容易触发模型降级。

**逐字段配置原因**（对应 `upstream.yaml` 的 `headers` 段）：

| 请求头 | 配置值 | 原因 |
|---|---|---|
| `User-Agent` | `{{ref:opencode_user_agent}}` | **版本漂移**：`1.15.0`/`4.0.23`/`1.3.13` 是抓包快照，opencode 更新后对不上会被识别。用 `{{ref:}}` 从 config.yaml 读，用户只改配置不动插件 |
| `x-opencode-client` | `"cli"` | **静态**：CLI 默认值。这是 zen 判定"合格客户端"的主要字段 |
| `x-opencode-project` | `"global"` | **静态**：CLI 未指定项目时的兜底值（源码 `InstanceState.context.project.id` 缺省 = `global`），最贴近真实 CLI 形态 |
| `x-opencode-session` | `"ses_{{var:rid}}"` | **必须动态**：真实 CLI 每请求都是新 session ID。固定值会让 zen 侧看到"所有请求同一 session"，特征明显 |
| `x-opencode-request` | `"msg_{{var:rid}}"` | **同请求复用**：抓包 `msg_po1nt9`/`ses_po1nt9` 共享同一随机串（message 和 session 同源生成）。`{{var:rid}}` 表达这种关联，比两个独立随机更逼真 |

**为什么这些能全放 yaml**：请求头声明化（设计文档 §5.6）后，`convert_request` 钩子整体省略——
伪装逻辑零代码，纯配置。

## 代理池（network.proxy_pool）

两个原因必须配代理池（config.yaml 里配来源，resin 订阅转节点列表）：

1. **IP 维度限速**：免费模型按请求 IP 限速（源码 `allowAnonymous` + `createIpRateLimiter`），轮换出口 IP 可绕
2. **地区限制**：`muse-spark-1.2-contributor-free` 禁香港/新加坡节点（源码 `isModelCountryRestricted`），出口需选美国等

## 文件清单

| 文件 | 说明 |
|---|---|
| `upstream.yaml` | 上游定义：端点/匿名认证/请求头注入/默认参数/代理池/错误判定/脚本映射 |
| `http.yaml` | 状态码 → 动作映射（429 IP 限速 cooldown、403 地区限制换出口，需实测校准） |
| `models.ts` | list_models（过滤免费模型 + capabilities：muse-spark 走 responses） |
| `package.json` | 插件元数据 |

**为什么没有这些文件**（与模板对比，都是有意的省略）：

| 模板文件 | 本插件 | 原因 |
|---|---|---|
| `convert.ts` | ❌ 省略 | 请求头声明化（yaml `headers`）取代了 convert_request；响应是标准 OpenAI 格式，格式匹配后直接转发，convert_response 透传即可 |
| `quota.ts` | ❌ 省略 | `Upstream-text-api-free` 无余额/套餐查询钩子 |

## config.yaml 配置示例

```yaml
upstreams:
  - ref: opencode-zen@^1.0
    opencode_zen_base_url: "https://opencode.ai/zen/v1"      # 免费模型端点（Go 套餐是 /zen/go/v1/）
    opencode_user_agent: "opencode/1.15.0 ai-sdk/provider-utils/4.0.23 runtime/bun/1.3.13"
    opencode-zen-pool:
      source: ref:resin-sub                                  # 代理池来源（resin 订阅转的节点列表）
      strategy: round-robin                                  # 轮换策略
      exclude_countries: [HK, SG]                            # muse-spark 禁香港/新加坡
```

## 已知风险（写插件前必读）

- **ToS 灰区**：伪装 CLI 客户端标识规避配额/降级判定，违反 OpenCode 服务条款，账号/IP 有被风控风险
- **版本漂移**：UA 版本号会过时，需定期更新 config.yaml（插件零改动）
- **免费模型限时**：官方说明"限时免费，用于收集反馈"，模型可能随时下线，需刷新模型列表
- **响应头校验**：若 zen 后续加 TLS 指纹/客户端指纹校验，纯请求头伪装会失效（本插件只做能声明化的部分）

## 参考

- 设计文档：`docs/RealyHubSad/02-插件体系/上游插件/上游定义声明化设计.md`（§5.6 请求头声明化 / §5.7 可配置面）
- 姊妹插件：`Example/UpStream/Api/opencode-go/`（Go 套餐 = `Upstream-text-api-quota`，三窗口限额）
