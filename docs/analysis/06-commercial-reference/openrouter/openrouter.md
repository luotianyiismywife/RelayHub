# OpenRouter

> **闭源商业 AI 模型聚合路由服务**。核心路由引擎闭源，但 API 设计、模型元数据格式、定价结构、路由策略全部公开。
> 对 RelayHub 的参考价值：**模型元数据格式（ModelInfo）+ 多维定价（PriceTable）+ 路由策略**。
> 官网：https://openrouter.ai ｜ 文档：https://openrouter.ai/docs ｜ 模型列表 API：`GET https://openrouter.ai/api/v1/models`

---

## 0. 概况

| 项 | 说明 |
|---|---|
| 定位 | 统一入口聚合 100+ 模型提供商，自动 fallback、按成本/质量路由 |
| 开源情况 | **核心闭源**（路由引擎/计费/模型管理）；SDK 开源（`@openrouter/sdk` / `openrouter` Python / `@openrouter/agent`） |
| 协议 | OpenAI 兼容（`/api/v1/chat/completions`），可作 OpenAI SDK 的 drop-in replacement |
| 与 RelayHub 关系 | **不是竞品**（OpenRouter 是托管服务，RelayHub 是自用网关），但**字段设计是标杆** |

---

## 1. 模型列表 API 完整字段（⭐ 核心参考）

`GET https://openrouter.ai/api/v1/models` 返回 400+ 模型的完整元数据。**这是 RelayHub ModelInfo 契约的字段来源**。

### 1.1 完整字段结构（以 `anthropic/claude-opus-5` 为例）

```json
{
  "id": "anthropic/claude-opus-5",
  "canonical_slug": "anthropic/claude-opus-5-20260723",
  "hugging_face_id": "",
  "name": "Anthropic: Claude Opus 5",
  "created": 1784912544,
  "description": "Claude Opus 5 is Anthropic's flagship model...",
  "context_length": 1000000,

  "architecture": {
    "modality": "text+image+file->text",
    "input_modalities": ["text", "image", "file"],
    "output_modalities": ["text"],
    "tokenizer": "Claude",
    "instruct_type": null
  },

  "pricing": {
    "prompt": "0.000005",
    "completion": "0.000025",
    "web_search": "0.01",
    "input_cache_read": "0.0000005",
    "input_cache_write": "0.00000625",
    "input_cache_write_1h": "0.00001",
    "image": "0.000005",
    "audio": "0.000005",
    "input_audio_cache": "0.0000005",
    "internal_reasoning": "0.000025",
    "image_output": "0.00012",
    "audio_output": "0.000064",
    "overrides": [
      {
        "min_prompt_tokens": 200000,
        "prompt": "0.00001",
        "completion": "0.000045",
        "input_cache_read": "0.000001"
      }
    ]
  },

  "top_provider": {
    "context_length": 1000000,
    "max_completion_tokens": 128000,
    "is_moderated": true
  },

  "per_request_limits": null,
  "supported_parameters": [
    "include_reasoning", "max_completion_tokens", "max_tokens",
    "reasoning", "reasoning_effort", "response_format", "stop",
    "structured_outputs", "temperature", "tool_choice", "tools",
    "verbosity"
  ],
  "default_parameters": {},
  "supported_voices": null,
  "knowledge_cutoff": null,
  "expiration_date": null,

  "links": {
    "details": "/api/v1/models/anthropic/claude-opus-5-20260723/endpoints"
  },

  "benchmarks": {
    "design_arena": [...],
    "artificial_analysis": {
      "intelligence_index": 63.1,
      "coding_index": 78,
      "agentic_index": 59.2
    }
  },

  "reasoning": {
    "mandatory": false,
    "default_enabled": true,
    "supported_efforts": ["max", "xhigh", "high", "medium", "low"],
    "default_effort": "high"
  }
}
```

### 1.2 字段逐项说明 + 对 RelayHub 的借鉴

#### 1.2.1 基础信息

| 字段 | 类型 | 说明 | → RelayHub ModelInfo | 备注 |
|---|---|---|---|---|
| `id` | string | 模型 ID（`provider/model`） | `id`（归一化后） | OpenRouter 用 `provider/model`，RelayHub 用 `插件名_模型名` |
| `canonical_slug` | string | 规范化 slug（含日期） | 不需要 | RelayHub 用目录版本管理 |
| `hugging_face_id` | string? | HF 模型 ID | 不需要 | 开源模型溯源用，自用不需要 |
| `name` | string | 展示名 | 可选 `displayName` | 给客户端展示用 |
| `created` | number | 创建时间戳 | 可选 | |
| `description` | string | 模型描述 | 可选 | |
| `context_length` | number | 最大上下文 | `limits.context` | ⭐ |
| `knowledge_cutoff` | string? | 知识截止日期 | 可选 | |
| `expiration_date` | string? | 模型下线日期 | 可选 | ⭐ 免费模型限时场景有用（K8） |

#### 1.2.2 architecture（架构/模态）⭐

| 字段 | 类型 | 说明 | → RelayHub capabilities | 判定 |
|---|---|---|---|---|
| `modality` | string | 模态摘要（`text+image+file->text`） | 派生 | 解析 `input_modalities` 更准 |
| `input_modalities` | string[] | 输入模态列表 | `vision`/`audio`/`video` | 含 `image`→vision=true |
| `output_modalities` | string[] | 输出模态列表 | 可选 | `text`/`image`/`audio` |
| `tokenizer` | string | 分词器 | 不需要 | 计费用，RelayHub 用上游返回的 usage |
| `instruct_type` | string? | 指令类型 | 不需要 | |

#### 1.2.3 pricing（定价）⭐⭐⭐ 核心参考

| 字段 | 类型 | 说明 | → RelayHub PriceTable | 备注 |
|---|---|---|---|---|
| `prompt` | string | 输入单价（$/token） | `input` | ⭐ 注意是字符串，需转 number |
| `completion` | string | 输出单价 | `output` | ⭐ |
| `input_cache_read` | string | 缓存读单价 | `cacheRead` | ⭐ 约 1/10 价 |
| `input_cache_write` | string | 缓存写单价（5min TTL） | `cacheWrite` | ⭐ 约 1.25x |
| `input_cache_write_1h` | string | 缓存写单价（1h TTL） | `cacheWrite1h` | ⭐ Claude 特有 |
| `image` | string | 图片输入单价 | `image` | |
| `audio` | string | 音频输入单价 | `audioPerSecond`? | |
| `input_audio_cache` | string | 音频缓存读 | - | |
| `internal_reasoning` | string | 推理 token 单价 | `reasoning` | ⭐ |
| `image_output` | string | 图片输出（生图）单价 | `imagePerOutput` | ⭐ 按张 |
| `audio_output` | string | 音频输出单价 | - | |
| `web_search` | string | web search 单价（按请求） | `perRequest` | ⭐ |
| `overrides` | array | **阶梯定价** | `tier` | ⭐⭐ J3 阶梯分段 |

**`overrides` 阶梯定价结构**（J3）：

```json
"overrides": [
  {
    "min_prompt_tokens": 200000,   // 输入超过 20 万 token
    "prompt": "0.00001",           // 换费率
    "completion": "0.000045",
    "input_cache_read": "0.000001"
  }
]
```

> 请求跨档 → 分段计价（低于阈值按 A 价、超出按 B 价）。

#### 1.2.4 top_provider（提供商信息）

| 字段 | 类型 | 说明 | → RelayHub | 备注 |
|---|---|---|---|---|
| `context_length` | number | 提供商实际支持的上下文 | `limits.context` | 与顶层 `context_length` 可能不同 |
| `max_completion_tokens` | number? | 最大输出 | `limits.maxOutput` | ⭐ |
| `is_moderated` | bool | 是否内容审核 | 可选 | |

#### 1.2.5 supported_parameters（支持的参数）⭐⭐

**模型支持哪些请求参数**——这决定了客户端能传什么。RelayHub 可用它做参数校验。

常见值（数组）：

| 参数 | 含义 | 对应能力 |
|---|---|---|
| `temperature` | 温度 | - |
| `top_p` | top_p | - |
| `top_k` | top_k | - |
| `max_tokens` | 最大输出 | - |
| `max_completion_tokens` | 最大输出（新） | - |
| `reasoning` | 推理开关 | `thinking` |
| `reasoning_effort` | 推理等级 | `thinking` |
| `include_reasoning` | 返回推理内容 | `thinking` |
| `tools` | 工具调用 | `tools` |
| `tool_choice` | 工具选择 | `tools` |
| `response_format` | 响应格式 | - |
| `structured_outputs` | 结构化输出 | - |
| `seed` | 随机种子 | - |
| `stop` | 停止词 | - |
| `frequency_penalty` | 频率惩罚 | - |
| `presence_penalty` | 存在惩罚 | - |
| `repetition_penalty` | 重复惩罚 | - |
| `logprobs` | logprobs | - |
| `top_logprobs` | top logprobs | - |
| `logit_bias` | logit bias | - |
| `min_p` | min_p | - |
| `verbosity` | 详细度 | - |
| `web_search_options` | web search | - |
| `parallel_tool_calls` | 并行工具调用 | - |

#### 1.2.6 default_parameters（默认参数）⭐⭐ 之前漏了

**模型的默认参数值**——客户端没传时用这些。RelayHub 可用它做 `body.defaults` 的数据源。

```json
"default_parameters": {
  "temperature": 1,
  "top_p": 0.95,
  "top_k": 20,
  "frequency_penalty": null,
  "presence_penalty": null,
  "repetition_penalty": null
}
```

> ⚠️ `null` 表示"无默认值"（≠ 0）。这与 J9（缺失值语义）一致。

**对 RelayHub 的意义**：
- 内核转发时，客户端没传的参数可用模型默认值填充
- 但要小心：有些默认值是 OpenRouter 自己的，不是上游的——需验证

#### 1.2.7 reasoning（推理/思考）⭐⭐ 之前漏了

**思考等级配置**——影响请求参数处理。

```json
"reasoning": {
  "mandatory": false,                    // 是否强制开启推理
  "default_enabled": true,               // 默认是否开启
  "supported_efforts": ["max", "xhigh", "high", "medium", "low"],  // 支持的等级
  "default_effort": "high",              // 默认等级
  "supports_max_tokens": true            // 推理时是否支持 max_tokens（部分模型不支持）
}
```

| 字段 | 类型 | 说明 | → RelayHub |
|---|---|---|---|
| `mandatory` | bool | 强制推理（不能关） | `thinking.mandatory` |
| `default_enabled` | bool | 默认开 | `thinking.defaultEnabled` |
| `supported_efforts` | string[] | 支持的思考等级 | `thinking.supportedEfforts` |
| `default_effort` | string | 默认等级 | `thinking.defaultEffort` |
| `supports_max_tokens` | bool? | 推理时支持 max_tokens | 可选 |

**思考等级枚举**（各模型不同）：
- `max` / `xhigh` / `high` / `medium` / `low` / `minimal` / `none`

**对 RelayHub 的意义**：
- 客户端传 `reasoning_effort: "high"` → 校验是否在 `supported_efforts` 里
- `mandatory: true` 的模型 → 强制带 reasoning 参数
- 不同模型等级枚举不同 → 不能硬编码

#### 1.2.8 其他字段

| 字段 | 类型 | 说明 | → RelayHub |
|---|---|---|---|
| `per_request_limits` | object? | 每请求限制 | 可选 |
| `supported_voices` | string[]? | 支持的语音（TTS） | 未来（音频） |
| `links.details` | string | 详情链接 | 不需要 |
| `benchmarks` | object? | 基准测试分数 | 可选（路由参考） |

---

## 2. 路由策略（参考价值高）

OpenRouter 提供多种路由模式，对应 RelayHub 的 D1 路由策略：

| 路由模式 | 说明 | → RelayHub |
|---|---|---|
| **直接指定** | `model: "anthropic/claude-opus-5"` | 默认行为 |
| **latest 别名** | `~openai/gpt-latest` → 最新 GPT | E 组模型映射（别名） |
| **Auto Router** | 按任务自动选模型 | 自用可能不需要 |
| **Pareto Router** | 按 coding score 过滤 | 可选路由策略 |
| **Free Router** | 随机选免费模型 | 可选 |
| **fallback** | 主模型失败→备用模型 | H10 Kernel-retry |

### 2.1 latest 别名（⭐ 值得借鉴）

```
~openai/gpt-latest      → 最新 GPT
~anthropic/claude-latest → 最新 Claude
~google/gemini-pro-latest → 最新 Gemini Pro
```

**对 RelayHub**：`model_map` 可配 `gpt-latest: opencode-go_gpt-5.6-sol`，手动维护"最新"指向。

### 2.2 fallback 机制

```json
{
  "model": "anthropic/claude-opus-5",
  "fallbacks": ["openai/gpt-5.6-sol", "google/gemini-3.1-pro"]
}
```

主模型失败 → 按顺序试 fallback。对应 RelayHub 的 H10 Kernel-retry。

---

## 3. 对 RelayHub 的完整借鉴清单

### 3.1 ModelInfo 契约扩展（基于完整字段）

之前 ModelInfo 漏了 `default_parameters` 和 `reasoning` 详细结构，应扩展：

```ts
interface ModelInfo {
  id: string
  displayName?: string                // name
  description?: string
  capabilities: {
    openai: boolean
    anthropic: boolean
    responses: boolean
    gemini: boolean
    vision?: boolean
    thinking?: boolean
    tools?: boolean
    audio?: boolean
    video?: boolean
  }
  limits?: {
    context?: number
    maxOutput?: number
  }
  // —— 2026-08-24 新增（基于 OpenRouter 完整字段）——
  supportedParameters?: string[]      // supported_parameters
  defaultParameters?: Record<string, any>  // default_parameters
  reasoning?: {                       // reasoning 详细结构
    mandatory: boolean
    defaultEnabled?: boolean
    supportedEfforts?: string[]       // ["max","high","medium","low"]
    defaultEffort?: string
  }
  expirationDate?: string             // expiration_date（免费模型限时）
  knowledgeCutoff?: string
}
```

### 3.2 PriceTable 契约（已基本对齐）

OpenRouter 的 `pricing` 字段已基本覆盖 RelayHub 的 PriceTable（J 组），补充：
- `audio_output` → 音频输出单价
- `input_audio_cache` → 音频缓存读
- `overrides` → `tier`（阶梯定价，已对齐）

### 3.3 路由策略（D1）

- latest 别名 → model_map 配置
- fallback → Kernel-retry（H10）
- Auto/Pareto Router → 自用可能不需要，但可作未来路由策略参考

---

## 4. 与开源项目的对比

| 维度 | OpenRouter | LiteLLM | new-api | RelayHub |
|---|---|---|---|---|
| 开源 | ❌ 核心闭源 | ✅ | ✅ | ✅（规划） |
| 模型元数据 | ⭐⭐⭐ 最全 | 有 | 有 | 借鉴 OpenRouter |
| 多维定价 | ⭐⭐⭐ 最全 | 有 | 有 | 借鉴 OpenRouter |
| 路由策略 | ⭐⭐⭐ 最丰富 | 有 | 简单 | 借鉴部分 |
| 协议转换 | 不做（同 RelayHub） | 做 | 做 | **不做**（2026-08-24 简化） |
| 自托管 | ❌ | ✅ | ✅ | ✅ |

**结论**：OpenRouter 是**字段设计的标杆**（ModelInfo/PriceTable），但**架构参考要看 LiteLLM/new-api**（开源）。

---

## 5. 参考

- 官网：https://openrouter.ai
- 文档：https://openrouter.ai/docs
- 模型列表 API：`GET https://openrouter.ai/api/v1/models`（无需认证）
- SDK：`@openrouter/sdk`（TS）/ `openrouter`（Python）/ `@openrouter/agent`
- 路由文档：https://openrouter.ai/docs/guides/routing
