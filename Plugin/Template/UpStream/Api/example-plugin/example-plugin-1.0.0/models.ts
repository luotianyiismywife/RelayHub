// <插件名> 模型列表 hooks
// ════════════════════════════════════════════════════════════════
// 模型情况总览 —— 遇到哪种情况，写在哪里（照着对号入座）：
//   · 平台返回标准 /v1/models → 本文件 list_models 归一化 ModelInfo[]
//   · 平台有扩展字段（supports_anthropic 等）→ 映射到 capabilities
//   · 模型映射（外部名 → 上游名）→ yaml model_map（数据在插件，行为在内核）
//   · 模型元数据合并（models.dev 的 context/vision）→ Kernel-models（G5，不写这里）
// ════════════════════════════════════════════════════════════════
// list_models（默认必配：不同平台模型列表大概率不一样）
// 参考 OpenAI 标准格式：GET /v1/models → { object: "list", data: [{ id, object, created, owned_by }] }

// ── 模型列表 ───────────────────────────────────────────────
export async function list_models(ctx: Ctx): Promise<ModelInfo[]> {
  // 大多数 OpenAI 兼容平台返回标准格式：data[].id
  // ← 填平台实际端点，如 ctx.http.get("/v1/models")
  const data = await ctx.http.get("/v1/models")     // ← 改实际端点

  // 若平台有扩展字段（supports_anthropic 等），在此归一化到 capabilities
  return (data.data ?? []).map((m) => ({
    id: m.id,
    capabilities: {
      openai: true,
      // anthropic: m.supports_anthropic ?? false,   // ← 按平台实际字段
      // responses: m.supports_responses ?? false,   // ← 按平台实际字段
    },
  }))
}
