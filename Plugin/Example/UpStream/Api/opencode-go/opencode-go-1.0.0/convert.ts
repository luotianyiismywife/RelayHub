// OpenCode Go 协议修正 hooks
// ⚠️ 不做格式转换（2026-08-24 简化）：客户端格式 = 上游格式，零转换
// convert_request / convert_response（标准协议，透传）
// usage 多维明细归一化（契约见插件模板分类 §0.6）：供 Kernel-billing / Kernel-usage 消费

// ── 请求转换：协议标准，直接透传 ────────────────────────────
export async function convert_request(req: Req, ctx: Ctx): Promise<Req> {
  return req   // opencode-go 协议较标准，无修正
}

// ── 响应转换：usage 多维明细归一化 ─────────────────────────
export async function convert_response(resp: Resp, ctx: Ctx): Promise<Resp> {
  // opencode-go 走 OpenAI 兼容协议，usage 含 prompt_tokens_details / completion_tokens_details
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
