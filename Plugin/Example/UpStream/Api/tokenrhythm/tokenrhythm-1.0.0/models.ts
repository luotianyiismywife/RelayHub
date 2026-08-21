// tokenrhythm 模型列表 hooks
// list_models（默认必配：不同平台模型列表大概率不一样）
// 参考 OpenAI 标准格式：GET /v1/models → { object: "list", data: [{ id, object, created, owned_by }] }
// 本平台在标准格式基础上扩展了能力标记（supports_anthropic / supports_responses）

export async function list_models(ctx: Ctx): Promise<ModelInfo[]> {
  const models = await ctx.http.get("/v1/models")
  return models.map((m) => ({
    id: m.id,
    capabilities: {
      openai: true,
      anthropic: m.supports_anthropic ?? false,   // qwen3.7-max/kimi-k2.7-code 为 false
      responses: m.supports_responses ?? false,
    },
  }))
}
