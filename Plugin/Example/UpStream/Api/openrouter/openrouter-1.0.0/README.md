# OpenRouter 上游插件（openrouter-1.0.0）

> OpenRouter（https://openrouter.ai）—— 闭源商业 AI 模型聚合路由服务，400+ 模型，
> 平台级协议转换（OpenAI / Anthropic / Responses 三格式），充值制计费。

## ⭐ 本插件的特殊性：插件即元数据源

其他上游插件（tokenrhythm / opencode-go）：`list_models` 只能填平台返回的部分字段，
缺失字段靠 **Kernel-models 从 OpenRouter 补全**（`/api/v1/models` 是全行业最全的模型元数据源）。

OpenRouter 插件反过来了：**它自己就是 OpenRouter**，`/api/v1/models` 返回 422 模型的全量字段
（architecture / reasoning / supported_parameters / pricing / benchmarks…），
所以本插件的 `list_models` **直接填满 ModelInfo 契约**，不需要 Kernel-models 二次补全。

## ★ 模型 ID 归一化（本插件是 `/`→`-` 方案的典型场景）

| 上游原始 ID（raw_id） | 对外 id（归一化） | 说明 |
|---|---|---|
| `deepseek/deepseek-v4-flash-0731` | `deepseek-deepseek-v4-flash-0731` | provider/model → `-` |
| `deepseek/deepseek-v4-flash-0731:free` | `deepseek-deepseek-v4-flash-0731-free` | `:free` 后缀转 `-free`，**不剥离** |
| `anthropic/claude-opus-5` | `anthropic-claude-opus-5` | 嵌套 `/` 全转 `-` |

- **归一化规则**：所有 `_`、`/`、`:` → `-`（模型映射 §2.5.2）。`:free`/`:batch` 转 `-free`/`-batch`，
  保留变体语义且不与基础模型撞名（剥离后缀则会与基础模型冲突）。
- **raw_id 的意义**：归一化名只是键（展示/路由）；**转发请求时用 raw_id 原样请求上游**。
  这是"归一化名不可逆"的解决方案 —— 不需要从 `-` 反推 `/`，因为原始 ID 从未丢失。
- **对外名**：`openrouter_<归一化id>`（如 `openrouter_deepseek-deepseek-v4-flash-0731-free`），
  `<上游名>_<模型名>` 规则见模型映射 §2.5。

## 与 L7.3 的关系（2026-08-24 策略）

之前 Kernel-models 给别的插件补字段时，要"忽略 OpenRouter ID 的 `/` 前部分（provider 前缀），
用 model 部分精确匹配"。**本插件直接省掉这步**：raw_id 就是完整 ID，无匹配成本、无 `/` 歧义。

## 协议支持（平台级转换）

| 协议 | 端点 | 支持 |
|---|---|---|
| openai | `/v1/chat/completions` | ✅ 所有模型 |
| anthropic | `/v1/messages` | ✅ 所有模型（需 `anthropic-version` 头，yaml 已配） |
| responses | `/v1/responses` | ✅ 所有模型 |
| gemini | — | ❌ 不支持 |

⚠️ 与"模型级能力"的区别：tokenrhythm 是**模型级** `supports_anthropic`（各模型不同）；
OpenRouter 是**平台级**转换（所有模型三格式都能调）→ 契约里四个协议维度全 true。

## 配置（config.yaml）

```yaml
openrouter_base_url: "https://openrouter.ai/api"   # 官方/自建反代
openrouter_referer: "https://your.site"            # 来源标注（可提升 rate limit）
openrouter_title: "RelayHub"                       # 应用名
```

凭据：`docker secret openrouter-prod`（`sk-or-...`）。

## 余额（quota_balance）

`GET /v1/auth/key`（复用转发 key）→ `limit - usage` 为可用余额（美元，充值制）。
免费 tier（`limit = null`）无余额概念，返回占位 0；免费模型走 `:free` 后缀不计费。

## 文件清单

| 文件 | 职责 |
|---|---|
| `upstream.yaml` | 平台说明书（端点/认证/头/错误判定） |
| `models.ts` | ★ list_models：内核消费字段映射（id/raw_id/capabilities/limits/…/pricing）+ ID 归一化（核心） |
| `convert.ts` | convert_response usage 归一化；request 透传（标准层无怪癖） |
| `quota.ts` | 余额查询（auth/key → limit-usage） |
| `http.yaml` | 状态码 → 动作（401/402 轮换、429 冷却、5xx 重试） |
| `models.yaml` | 模型列表快照（models.ts 生成，内核优先读；只含内核消费字段） |
