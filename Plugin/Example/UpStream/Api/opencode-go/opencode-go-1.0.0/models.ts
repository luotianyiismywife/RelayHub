// OpenCode Go 模型列表 hooks
// list_models（默认必配：不同平台模型列表大概率不一样）
// 参考 OpenAI 标准格式：GET /v1/models → { object: "list", data: [{ id, object, created, owned_by }] }

export async function list_models(ctx: Ctx): Promise<ModelInfo[]> {
  // 平台 /models 返回标准 OpenAI 格式（data[].id）
  const data = await ctx.http.get("/v1/models")
  return (data.data ?? []).map((m) => ({
    id: m.id,
    capabilities: {
      openai: true,
      // 协议能力由 models.dev 目录的 provider.npm 决定（@ai-sdk/openai /
      // @ai-sdk/anthropic / @ai-sdk/google / @ai-sdk/openai-compatible），
      // API /models 只返回 id。插件侧不硬编码，按目录元数据合并。
      anthropic: true,      // 实际以 models.dev 目录为准
      responses: true,      // 部分模型支持 responses（apiMode: openai-responses）
    },
  }))
}
