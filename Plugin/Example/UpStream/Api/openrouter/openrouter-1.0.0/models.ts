// OpenRouter 模型列表 hooks
// ════════════════════════════════════════════════════════════════
// 来源：GET /api/v1/models（无鉴权即可拉，2026-08-24 调研全量统计 422 模型）
// ════════════════════════════════════════════════════════════════
// ★ 特殊性：OpenRouter 就是模型元数据源本身（插件即元数据源）
//   其他平台：list_models 只填部分字段，缺失靠 Kernel-models 从 OpenRouter 补全
//   OpenRouter：/api/v1/models 返回全量字段 → 本钩子直接填满内核消费字段
//   详见 analysis/06-commercial-reference/openrouter/openrouter.md §1.2 字段映射表
//
// ★ 只填主结构字段（2026-08-25 精简，主结构见模型映射 §3.2.1）：
//   models.yaml = 内核路由用的数据，不是 OpenRouter API 的全量转储
//   必填 id/raw_id/capabilities + 按需 displayName/description/limits/
//   supportedParameters/defaultParameters/reasoning/knowledgeCutoff/expirationDate
//   无关字段（pricing/created/aliases/benchmarks/supportedVoices 等）不映射
//   （pricing 归上游/中转站自己算，RelayHub 只转发）
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

      // —— 基础信息（展示 + 生命周期）——
      displayName: m.name,                       // 页面插件展示用（如 "Anthropic: Claude Opus 5"）
      description: m.description,                // 页面插件展示用
      knowledgeCutoff: m.knowledge_cutoff,
      expirationDate: m.expiration_date,         // 免费模型限时下线（K8）
      // created 无关不映射（见头部说明）

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
        // —— 输出模态：暂不映射（生图/音视频未来做 image/audio/video/mix kind 再补）——
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
      // 其余契约字段（pricing/created/aliases/benchmarks/supportedVoices/
      // perRequestLimits/isModerated/tokenizer/instructType/modality）不映射：
      // pricing 归上游/中转站自己算，RelayHub 只转发（模型映射 §3.2.1）；
      // 其余无关字段白占体积 → 不写进 models.yaml（见头部说明）
    }
  })
}

// ── 归一化：_ / : → -（模型名不含 _、/、:，_ 是唯一对外分隔符）──
// :free/:batch 转 -free/-batch（保留变体语义，不剥离 → 不与基础模型撞名）
function normalize_id(id: string): string {
  return id.replace(/[_/:]/g, "-")
}
