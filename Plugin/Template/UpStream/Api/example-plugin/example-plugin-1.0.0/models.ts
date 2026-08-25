// <插件名> 模型列表 hooks
// ════════════════════════════════════════════════════════════════
// 模型情况总览 —— 遇到哪种情况，写在哪里（照着对号入座）：
//   · 平台返回标准 /v1/models → 本文件 list_models 归一化 ModelInfo[]
//   · 平台有扩展字段（supports_anthropic 等）→ 映射到 capabilities
//   · 模型映射（外部名 → 上游名）→ yaml model_map（数据在插件，行为在内核）
//   · 模型元数据补全（OpenRouter/models.dev 的 vision/thinking/reasoning 等）→ Kernel-models（G5，不写这里）
// ════════════════════════════════════════════════════════════════
// list_models（默认必配：不同平台模型列表大概率不一样）
// 参考 OpenAI 标准格式：GET /v1/models → { object: "list", data: [{ id, object, created, owned_by }] }
//
// ★ 职责（2026-08-24 更新，2026-08-25 补 /→- 与 raw_id）：
//   1. 拉取上游 /v1/models
//   2. 归一化（模型名所有 _、/ 转 -）★ 在这里做，内核不做
//   3. 返回 ModelInfo[]（含 capabilities + limits + supportedParameters + reasoning 等；id=归一化名，raw_id=上游原始 ID）
//   4. 内核会把返回结果写入插件包内 models.yaml，后续读 models.yaml（不每次调本钩子）
//
// ★ models.yaml 是本钩子的产物（缓存/声明文件），内核启动时优先读它：
//   - models.yaml 存在 → 内核直接读（快，不调 ts）
//   - models.yaml 不存在 → 内核调本钩子生成 → 写入 models.yaml
//   - 定时/手动刷新 → 内核调本钩子 → 更新 models.yaml
//
// ★ 字段填充优先级（2026-08-24，基于 OpenRouter 完整字段）：
//   - 协议维度（openai/anthropic/responses/gemini）：插件填（最权威）
//   - 能力维度（vision/thinking/tools/audio/video）：插件能填则填，缺失 Kernel-models 补全
//   - limits（context/maxOutput）：插件能填则填，缺失 Kernel-models 补全
//   - supportedParameters/defaultParameters/reasoning：插件能填则填，缺失 Kernel-models 补全
//   - expirationDate/knowledgeCutoff：插件能填则填，缺失 Kernel-models 补全
//   详见 analysis/06-commercial-reference/openrouter/openrouter.md §1.2
//
// ⚠️ 契约全量 ≠ 每个插件都填（2026-08-25 教训，openrouter 示例插件踩过）：
//   完整 ModelInfo 契约 + 持久化分组见文档「模型映射与模型列表设计 §3.2.1」（唯一权威），此处不重复。
//   必填：id / raw_id / capabilities；按需：displayName/description/limits/.../reasoning；
//   无关不填：pricing/created/aliases/benchmarks/supportedVoices 等。
//   参考实现：openrouter 插件 models.ts

// ── 模型列表 ───────────────────────────────────────────────
export async function list_models(ctx: Ctx): Promise<ModelInfo[]> {
  // 大多数 OpenAI 兼容平台返回标准格式：data[].id
  // ← 填平台实际端点，如 ctx.http.get("/v1/models")
  const data = await ctx.http.get("/v1/models")     // ← 改实际端点

  // 若平台有扩展字段（supports_anthropic 等），在此归一化到 capabilities
  return (data.data ?? []).map((m) => ({
    // ★ 归一化：模型名所有 _、/ 转 -（内核不做，必须在这里做）
    //   _→-：对外名 _ 是上游分隔符（独占）；/→-：模型名不得含 /（如 OpenRouter provider/model）
    //   ★ 归一化名只是键：上游原始 id 存 raw_id，转发请求/内部匹配都用 raw_id
    id: m.id.replace(/_/g, "-").replace(/\//g, "-"),
    // ★ 上游原始 ID（不归一化）：转发请求 / model_map 匹配 / 与外部数据源匹配都用它
    raw_id: m.id,

    // —— 协议维度（必填，插件最权威）——
    capabilities: {
      openai: true,
      // anthropic: m.supports_anthropic ?? false,   // ← 按平台实际字段
      // responses: m.supports_responses ?? false,   // ← 按平台实际字段
      // gemini: m.supports_gemini ?? false,
      // —— 能力维度（可选，插件能填则填，缺失 Kernel-models 从 OpenRouter 补全）——
      // vision: m.supports_vision ?? false,
      // thinking: m.supports_reasoning ?? false,
      // tools: m.supports_tools ?? false,
      // audio: m.supports_audio ?? false,
      // video: m.supports_video ?? false,
    },

    // —— limits（可选，插件能填则填）——
    // limits: {
    //   context: m.context_length,
    //   maxOutput: m.max_completion_tokens,
    // },

    // —— supportedParameters（可选，模型支持的参数）——
    // supportedParameters: m.supported_parameters,   // ["temperature","tools","reasoning",...]

    // —— defaultParameters（可选，模型默认参数值）——
    // defaultParameters: m.default_parameters,       // { temperature: 1, top_p: 0.95 }

    // —— reasoning（可选，推理/思考详细配置）——
    // reasoning: m.reasoning ? {
    //   mandatory: m.reasoning.mandatory,
    //   defaultEnabled: m.reasoning.default_enabled,
    //   supportedEfforts: m.reasoning.supported_efforts,   // ["max","high","medium","low"]
    //   defaultEffort: m.reasoning.default_effort,
    // } : undefined,

    // —— 生命周期（可选）——
    // expirationDate: m.expiration_date,    // 免费模型限时下线（K8）
    // knowledgeCutoff: m.knowledge_cutoff,

    // —— 定价（★ 插件自己填，不从 OpenRouter 补全）——
    // 各平台价格不同（tokenrhythm 有折扣、opencode-go 套餐制不按量计费）
    // 上游返回什么填什么，缺失就缺失（quota 类不填 pricing）
    // pricing: m.pricing ? {
    //   prompt: m.pricing.prompt,
    //   completion: m.pricing.completion,
    //   cacheRead: m.pricing.input_cache_read,
    //   cacheWrite: m.pricing.input_cache_write,
    //   cacheWrite1h: m.pricing.input_cache_write_1h,
    //   reasoning: m.pricing.internal_reasoning,
    //   image: m.pricing.image,
    //   imageOutput: m.pricing.image_output,
    //   audio: m.pricing.audio,
    //   audioOutput: m.pricing.audio_output,
    //   webSearch: m.pricing.web_search,
    //   tier: m.pricing.overrides,   // 阶梯定价（J3）
    // } : undefined,
  }))
}
