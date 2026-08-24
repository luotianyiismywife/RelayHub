// one-api 模型列表 hooks
// list_models：one-api 返回标准 OpenAI 格式（data[].id），透传归一化

export async function list_models(ctx: Ctx): Promise<ModelInfo[]> {
  const data = await ctx.http.get("/v1/models")
  return (data.data ?? []).map((m) => ({
    // ★ 归一化：模型名所有 _ 转 -（内核不做，必须在这里做）
    id: m.id.replace(/_/g, "-"),
    capabilities: {
      openai: true,
      anthropic: false,   // one-api 的 /v1/models 通常不含能力标记，默认 false
      responses: false,
      gemini: false,
      // one-api 可能不含能力标记，可按配置补充或由 Kernel-models 从 OpenRouter 补全
    },
  }))
}
