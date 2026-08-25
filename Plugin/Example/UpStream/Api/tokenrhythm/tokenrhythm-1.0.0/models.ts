// tokenrhythm 模型列表 hooks
// ════════════════════════════════════════════════════════════════
// 来源：GET /v1/models（需 Bearer key，2026-08-24 实测）
// 本平台在 OpenAI 标准格式上扩展了能力标记：
//   supports_anthropic / supports_responses / supports_vision / supports_tools
//   pricing（含 effective_pricing 折扣）/ responses_capabilities（responses 详细能力）
// ════════════════════════════════════════════════════════════════
// ★ 职责（2026-08-24，2026-08-25 补 /→- 与 raw_id）：
//   1. 拉取上游 /v1/models
//   2. 归一化（模型名所有 _、/ 转 -）★ 在这里做，内核不做
//   3. 返回 ModelInfo[]（只填上游能返回的字段；id=归一化名，raw_id=上游原始 ID）
//   4. 内核把返回结果写入插件包内 models.yaml，后续读 models.yaml（不每次调本钩子）
//
// ★ models.yaml 是本钩子的产物（缓存/声明文件），内核启动时优先读它
//
// ★ 字段填充分工（2026-08-24）：
//   本钩子（models.ts）：只填上游 /v1/models 返回的字段（supports_* / context_length 等）
//   Kernel-models 插件：从 OpenRouter /api/v1/models 补全缺失字段：
//     - reasoning 详细配置（mandatory / supportedEfforts / defaultEffort）
//     - supportedParameters（temperature / tools / reasoning 等支持的参数）
//     - defaultParameters（默认参数值）
//     - thinking 能力标记（从 reasoning 推断）
//     - expirationDate / knowledgeCutoff
//
// ★ 模型 ID 映射（Kernel-models 补全时用，2026-08-24 实测验证）：
//   策略：忽略 OpenRouter ID 的 / 前部分（provider 前缀），用 model 部分精确匹配
//   tokenrhythm ID: deepseek-v4-flash-0731
//   OpenRouter ID:  deepseek/deepseek-v4-flash-0731 → model 部分 deepseek-v4-flash-0731 ✅
//   实测：17 模型中 15 个精确匹配，2 个无匹配（seed-2.1-* OpenRouter 未收录）
//   边界：:batch/:free 后缀需剥离后匹配基础名；无匹配时只输出上游字段不阻塞
//   详见待办 L7.3

// ── 模型列表 ───────────────────────────────────────────────
export async function list_models(ctx: Ctx): Promise<ModelInfo[]> {
  const data = await ctx.http.get("/v1/models")

  return (data.data ?? []).map((m) => ({
    // ★ 归一化：模型名所有 _、/ 转 -（内核不做，必须在这里做）
    //   _→-：对外名 _ 是上游分隔符（独占）；/→-：模型名不得含 /（如 OpenRouter provider/model）
    //   ★ 归一化名只是键：上游原始 id 存 raw_id，转发请求/内部匹配都用 raw_id
    id: m.id.replace(/_/g, "-").replace(/\//g, "-"),
    // ★ 上游原始 ID（不归一化）：转发请求 / model_map 匹配 / L7.3 匹配都用它
    raw_id: m.id,

    // —— 协议维度（必填，平台扩展字段最权威）——
    capabilities: {
      openai: true,                                    // tokenrhythm 全模型支持 openai 格式
      anthropic: m.supports_anthropic ?? false,        // qwen3.7-max/kimi-k2.7-code 为 false
      responses: m.supports_responses ?? false,
      gemini: false,                                   // tokenrhythm 不支持 gemini 格式
      // —— 能力维度（平台有扩展字段则填，缺失 Kernel-models 从 OpenRouter 补全）——
      vision: m.supports_vision ?? undefined,
      tools: m.supports_tools ?? undefined,
      // thinking：tokenrhythm 未直接返回，Kernel-models 从 OpenRouter reasoning 字段推断
    },

    // —— limits（平台返回则填）——
    limits: m.context_length ? {
      context: m.context_length,
      maxOutput: m.max_completion_tokens ?? undefined,
    } : undefined,

    // —— 以下字段 tokenrhythm 未直接返回，留给 Kernel-models 从 OpenRouter 补全 ——
    // reasoning: { mandatory, supportedEfforts, defaultEffort }  ← OpenRouter reasoning 字段
    // supportedParameters: [...]                                  ← OpenRouter supported_parameters
    // defaultParameters: { temperature, top_p, ... }              ← OpenRouter default_parameters
    // expirationDate / knowledgeCutoff                            ← OpenRouter 对应字段
  }))
}
