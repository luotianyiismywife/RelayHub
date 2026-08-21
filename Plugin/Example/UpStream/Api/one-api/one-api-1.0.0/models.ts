// one-api 模型列表 hooks
// list_models：one-api 返回标准 OpenAI 格式（data[].id），透传归一化

export async function list_models(ctx: Ctx): Promise<ModelInfo[]> {
  const data = await ctx.http.get("/v1/models")
  return (data.data ?? []).map((m) => ({
    id: m.id,
    capabilities: {
      openai: true,
      // one-api 的 /v1/models 可能不含能力标记，可按配置补充
      // anthropic: ..., responses: ...,
    },
  }))
}
