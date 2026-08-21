# <插件名> 上游插件模板（Upstream-api 通用）

> 本目录是**模板**，复制后按注释填写即可。
> 支持两种计费 kind（二选一，结构相同）：
> - `Upstream-api-balance`：API Key + 余额计费 → 用 `quota_balance` 钩子
> - `Upstream-api-quota`：API Key + 套餐限额 → 用 `quota_usage` 钩子 + `billing` 段
> 参考示例：`Example/UpStream/Api/tokenrhythm/`（balance）、`Example/UpStream/Api/opencode-go/`（quota）

## ⚠️ 职责边界（写插件前必读）—— 什么该自己写，什么留给内核

> **原则：上游插件只描述"这个平台长什么样"（数据/协议/怪癖），
> 一切"怎么处理请求"（计算/轮换/限流/重试/缓存/记录）都归内核或内核插件。**
> 照着下表写，不用想哪些没法和内核对接。

| 能力 | 归属 | 上游插件要做的 | 内核/内核插件做的 |
|---|---|---|---|
| **端点/协议** | 上游插件 | `apis` 声明路径+方法；四协议内核内置 | 协议分发、入口转换 |
| **鉴权** | 上游插件 | `auth` 声明类型+key；`auth.query` 声明查询凭据 | 凭据托管（docker secret） |
| **静态规则** | 上游插件 | `special`：强制头/必传字段/透传剥离 | 转发时注入 |
| **模型列表** | 上游插件 | `list_models` 返回 `ModelInfo[]`（含 capabilities） | 聚合/过滤/刷新调度 |
| **模型映射** | **数据在插件** | `model_map` 声明外部名→上游名 | **行为在内核**（ModelResolver 解析） |
| **协议修正** | 上游插件 | `convert_request/response`（平台怪癖） | 调用钩子 |
| **余额/套餐查询** | 上游插件 | `quota_balance`/`quota_usage` 返回平台原始数据 | 按 TTL 缓存、预检、路由 |
| **错误判定** | 上游插件 | `rotation` 声明 http_rules（http.yaml 状态码→动作）/ error_patterns / balance_ttl | **轮换机制**（mode/cooldown/并发） |
| **成本计算** | **内核插件** | ❌ 不写！只透传 usage 明细（extract_usage） | `Kernel-billing`：价格表+多维计算 |
| **预扣/结算** | 内核 | ❌ 不写！ | 流式预扣→回填 diff（J5） |
| **限流/并发** | 内核插件 | ❌ 不写！ | `Kernel-ratelimit`/并发限制 |
| **重试/回退** | 内核插件 | ❌ 不写！ | `Kernel-retry`（指数退避+fallback） |
| **缓存** | 内核插件 | ❌ 不写！ | `Kernel-cache`（语义缓存） |
| **日志/统计** | 内核插件 | ❌ 不写！ | `Kernel-logging`/`Kernel-usage` |
| **告警** | 内核插件 | ❌ 不写！ | `Kernel-alert`（判定） |
| **健康检查** | 内核插件 | ❌ 不写！ | `Kernel-health`（熔断/半开） |
| **模型元数据** | 内核插件 | ❌ 不写！（G5） | `Kernel-models`（models.dev 合并） |

**一句话**：上游插件 = 平台说明书（数据+协议+怪癖）；内核插件 = 横切能力（计算/轮换/限流/记录）；内核 = 转发引擎（调度/预扣/缓存）。

## 使用方法

1. 复制本目录为 `plugin/UpStream/Api/<插件名>/<插件名>-1.0.0/`
2. 按 `upstream.yaml` 中的注释填写平台信息（含 kind 选择）
3. 按各 `.ts` 文件中的注释实现平台差异逻辑
4. 删除 `# 模板说明` 部分

## 文件清单

| 文件 | 说明 |
|---|---|
| `upstream.yaml` | 上游定义（**必须填写**：kind/端点/认证/脚本映射） |
| `http.yaml` | **状态码 → 动作映射**（**必须按平台实测改**；文件头注释含全部字段说明/动作语义/状态码速查） |
| `convert.ts` | convert_request / convert_response（协议修正 + usage 归一化） |
| `models.ts` | list_models（**默认必配**：模型列表归一化） |
| `quota.ts` | 双钩子：quota_balance（balance 用）+ quota_usage（quota 用） |
| `package.json` | 插件元数据（**必须填写**：name/version） |
| `README.md` | 平台说明（可选） |

## http.yaml 动作语义（判定在插件，机制在内核）

> 📄 **完整字段说明就在 http.yaml 文件头注释里**（YAML 原生支持注释）——
> 每个字段含义 + 动作语义 + 常见状态码速查 + 平台差异 + 与 rotation 段配合。
> 配置时打开 http.yaml 看注释即可，不用翻文档。

| action | 含义 | 内核怎么做 | 典型状态码 |
|---|---|---|---|
| `rotate` | **确定性凭据失效** | 持久化标记该 key 不可用，换下一个 key | 401（无效）、402（余额不足） |
| `cooldown` | **瞬态限流** | 内存冷却该 key（时长 config.yaml），换下一个 | 429 |
| `retry` | **服务端/超时** | 指数退避重试（次数 config.yaml），可换 key | 500/502/503/504/408 |
| `passthrough` | **客户端错误** | 直接返回客户端，不重试不轮换 | 400/403/404/422 等 4xx |
| `default` | 未列出的状态码 | passthrough（安全兜底） | — |

- `rotatable` / `retryable`：显式标记该状态码是否参与轮换/重试（省略 = false）
- 错误**文本**模式（body 里的 error code，如 `insufficient_balance`）→ 写在 `upstream.yaml` 的 `rotation.error_patterns`
- ⚠️ 机制（冷却时长/重试次数/换 key 模式）全在内核 `config.yaml`，**不在 http.yaml**

## 源码组织：文件自由，yaml 声明调用（核心约定）

**内核与插件的共同协议 = yaml 的 `scripts` 段**。
每个钩子显式声明"调用哪个文件、哪个函数"，内核完全按 yaml 加载，不猜目录结构：

```yaml
scripts:
  quota_balance:  ./quota.ts                     # balance：余额查询
  # quota_usage:  ./quota.ts                     # quota：套餐限额（与 kind 对应）
  convert_request: { file: ./convert.ts, fn: convertRequest }  # 指定函数名
```

- **简单插件**：全部钩子指向同一个文件即可（不强制拆分）
- **推荐拆分**：`convert.ts` / `models.ts` / `quota.ts` 按职责分，每个钩子指向对应文件
- **内核加载协议**：读 `scripts` → 找文件 → 找函数 → 调用（QuickJS 构建打包 / deno_core 原生 ESM 均可）
- **判断标准**：逻辑膨胀到难以维护再拆文件，别过度设计
