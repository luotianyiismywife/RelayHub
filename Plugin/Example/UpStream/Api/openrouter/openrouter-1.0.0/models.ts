// OpenRouter 模型列表 hooks
// ════════════════════════════════════════════════════════════════
// 来源：GET /api/v1/models（无鉴权即可拉，2026-08-24 调研全量统计 422 模型）
// ════════════════════════════════════════════════════════════════
// ★ 特殊性：OpenRouter 就是模型元数据源本身（插件即元数据源）
//   其他平台：list_models 只填部分字段，缺失靠 Kernel-models 从 OpenRouter 补全
//   OpenRouter：/api/v1/models 返回全量字段 → 本钩子直接填满内核消费字段
//   详见 analysis/06-commercial-reference/openrouter/openrouter.md §1.2 字段映射表
//
// ★ 只填内核消费字段（2026-08-25 精简，持久化分组表见模型映射 §3.2.1）：
//   models.yaml = 内核路由/计费用的数据，不是 OpenRouter API 的全量转储
//   必填 id/raw_id/capabilities + 按需 limits/supportedParameters/defaultParameters/
//   reasoning/pricing/knowledgeCutoff/expirationDate；展示层字段（displayName 等）不填
//
// ★ 模型 ID 归一化（2026-08-25，模型映射 §2.5.2）：
//   OpenRouter ID = provider/model 格式 + 变体后缀 :free / :batch
//   → 所有 _、/、: 转 -（:free 转 -free，不剥离 → 不与基础模型撞名）
//   → id = 归一化名（对外展示/路由键）；raw_id = 原始完整 ID（转发请求时用）
//   例：deepseek/deepseek-v4-flash:free
//       → id     deepseek-deepseek-v4-flash-free
//       → raw_id deepseek/deepseek-v4-flash:free
//
// ★ 与 L7.3 的关系（2026-08-24 策略，本插件直接受益）：
//   以前 Kernel-models 补全时要"忽略 OpenRouter ID 的 / 前部分"匹配插件模型；
//   现在 OpenRouter 直接当上游 → raw_id 就是完整 ID，零匹配成本，无 / 歧义。

// ── 模型列表 ───────────────────────────────────────────────
export async function list_models(ctx: Ctx): Promise<ModelInfo[]> {
  const data = await ctx.http.get("/v1/models")

  return (data.data ?? []).map((m) => {
    const input = m.architecture?.input_modalities ?? []
    const output = m.architecture?.output_modalities ?? []
    const params = m.supported_parameters ?? []

    return {
      // ★ 归一化：所有 _、/、: 转 -（内核不做，必须在这里做）
      //   /→-：provider/model 前缀分隔；:→-：:free/:batch 变体后缀
      //   ★ 归一化名只是键：原始 id 存 raw_id，转发请求 / model_map 匹配都用 raw_id
      id: normalize_id(m.id),
      raw_id: m.id,                              // ★ 原始 provider/model（转发时原样带上）

      // —— 基础信息（只留内核消费：K8 免费模型下线 / 生命周期）——
      knowledgeCutoff: m.knowledge_cutoff,
      expirationDate: m.expiration_date,         // 免费模型限时下线（K8）
      // displayName/description/created 是展示层字段，models.yaml 不存（见头部说明）

      // —— 能力（OpenRouter 平台级转换 → 三格式全 true）——
      capabilities: {
        openai: true,                            // 所有模型可用 openai 格式
        anthropic: true,                         // /v1/messages 平台级转换
        responses: true,                         // /v1/responses 平台级转换
        gemini: false,                           // OpenRouter 不支持 gemini 格式
        // —— 输入模态（architecture.input_modalities）——
        vision: input.includes("image"),
        audio: input.includes("audio"),
        video: input.includes("video"),
        file: input.includes("file"),
        // —— 输出模态（architecture.output_modalities）——
        imageOutput: output.includes("image"),   // 生图模型
        audioOutput: output.includes("audio"),
        // —— 功能能力 ——
        thinking: !!m.reasoning,                 // reasoning 字段存在
        tools: params.includes("tools"),         // supported_parameters 含 tools
      },

      // —— limits ——
      limits: {
        context: m.context_length,
        maxOutput: m.top_provider?.max_completion_tokens,
      },

      // —— 参数支持/默认值（422 模型统计见契约 §0.7）——
      supportedParameters: params,               // ["tools","temperature","reasoning",...]
      defaultParameters: m.default_parameters,   // { temperature, top_p, ... }

      // —— reasoning 详细配置 ——
      reasoning: m.reasoning ? {
        mandatory: m.reasoning.mandatory,
        defaultEnabled: m.reasoning.default_enabled,
        supportedEfforts: m.reasoning.supported_efforts,   // ["max","high","medium","low"]
        defaultEffort: m.reasoning.default_effort,
      } : undefined,

      // —— pricing（★ 字符串 → 数字转换，见 parse_pricing；Kernel-billing 计费用）——
      pricing: parse_pricing(m.pricing),
      // 其余契约字段（aliases/benchmarks/supportedVoices/perRequestLimits/
      // isModerated/tokenizer/instructType/modality）为"可存但不对外展示"，
      // 展示层用不上、白占体积 → 不写进 models.yaml（见头部说明）
    }
  })
}

// ── 归一化：_ / : → -（模型名不含 _、/、:，_ 是唯一对外分隔符）──
// :free/:batch 转 -free/-batch（保留变体语义，不剥离 → 不与基础模型撞名）
function normalize_id(id: string): string {
  return id.replace(/[_/:]/g, "-")
}

// ── pricing 解析：OpenRouter 返回字符串（"0.000005"）→ number ──
// 字段映射见 ModelInfo 契约（§0.7 / openrouter.md §1.2.3）：
//   prompt/completion/input_cache_read/web_search/input_cache_write/audio/
//   input_cache_write_1h/internal_reasoning/image/input_audio_cache/
//   image_output/audio_output → pricing.*；overrides → pricing.tier
function parse_pricing(p: any): ModelInfo["pricing"] | undefined {
  if (!p || typeof p !== "object") return undefined
  const num = (v: any): number | undefined =>
    v === undefined || v === null ? undefined : Number(v)

  const out: ModelInfo["pricing"] = {}
  if (num(p.prompt) !== undefined)               out.prompt = num(p.prompt)
  if (num(p.completion) !== undefined)           out.completion = num(p.completion)
  if (num(p.input_cache_read) !== undefined)     out.cacheRead = num(p.input_cache_read)
  if (num(p.web_search) !== undefined)           out.webSearch = num(p.web_search)
  if (num(p.input_cache_write) !== undefined)    out.cacheWrite = num(p.input_cache_write)
  if (num(p.audio) !== undefined)                out.audio = num(p.audio)
  if (num(p.input_cache_write_1h) !== undefined) out.cacheWrite1h = num(p.input_cache_write_1h)
  if (num(p.internal_reasoning) !== undefined)   out.reasoning = num(p.internal_reasoning)
  if (num(p.image) !== undefined)                out.image = num(p.image)
  if (num(p.input_audio_cache) !== undefined)    out.audioCacheRead = num(p.input_audio_cache)
  if (num(p.image_output) !== undefined)         out.imageOutput = num(p.image_output)
  if (num(p.audio_output) !== undefined)         out.audioOutput = num(p.audio_output)

  // 阶梯定价（overrides → tier）：输入超过 min_prompt_tokens 换费率
  if (Array.isArray(p.overrides)) {
    out.tier = p.overrides.map((t: any) => ({
      minPromptTokens: t.min_prompt_tokens,
      prompt: num(t.prompt),
      completion: num(t.completion),
      cacheRead: num(t.input_cache_read),
      cacheWrite: num(t.input_cache_write),
      cacheWrite1h: num(t.input_cache_write_1h),
      audio: num(t.audio),
    }))
  }
  return Object.keys(out).length > 0 ? out : undefined
}
