// one-api 协议转换 hooks（示例：模型映射）
// convert_request：多级代理场景下，把对外暴露的模型名映射成 one-api 的模型名
// （模板预留：模型映射和格式转换是下一步要研究的事，这里给个雏形）
// convert_response：usage 多维明细归一化（契约见插件模板分类 §0.6）

export async function convert_request(req: Req, ctx: Ctx): Promise<Req> {
  // 模型映射表：对外名 → one-api 实际名
  // const modelMap: Record<string, string> = {
  //   "gpt-4o": "gpt-4o-2024-11-20",
  //   "claude": "claude-sonnet-4",
  // }
  // if (modelMap[req.model]) req.model = modelMap[req.model]

  return req   // 默认透传（模型映射待后续研究）
}

export async function convert_response(resp: Resp, ctx: Ctx): Promise<Resp> {
  // one-api 兼容 OpenAI 协议，usage 含 prompt_tokens_details / completion_tokens_details
  resp.usage = extract_usage(resp.usage) ?? resp.usage
  return resp
}

// ── usage 多维明细归一化（同模板，契约见插件模板分类 §0.6）──
function extract_usage(raw: any): TokenUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const u: TokenUsage = {}
  const ptd = raw.prompt_tokens_details ?? {}
  const ctd = raw.completion_tokens_details ?? {}
  if (typeof raw.prompt_tokens === "number")     u.prompt = raw.prompt_tokens
  if (typeof raw.completion_tokens === "number") u.completion = raw.completion_tokens
  if (typeof ptd.cached_tokens === "number")     u.cacheRead = ptd.cached_tokens
  if (typeof ctd.reasoning_tokens === "number")  u.reasoning = ctd.reasoning_tokens
  return Object.keys(u).length > 0 ? u : undefined
}
