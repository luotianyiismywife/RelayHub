// OpenRouter 协议修正 hooks
// ════════════════════════════════════════════════════════════════
// ⚠️ 不做格式转换（2026-08-24 简化）：客户端格式 = 上游格式，零转换
// ════════════════════════════════════════════════════════════════
// OpenRouter 是"标准兼容层"：openai/anthropic/responses 三格式原生收，
// 参数怪癖最少 → convert_request 基本透传（发现实测怪癖再补）。
// 已知由 yaml 声明处理的部分（不写在这里）：
//   - anthropic-version 头            → special.headers.anthropic
//   - anthropic 必传 max_tokens       → body.defaults + required_fields
//   - HTTP-Referer / X-Title 来源头   → headers（{{ref:...}}）
// convert_request / convert_response

// ── 请求转换：条件修正（OpenRouter 无已知参数怪癖，透传）────
// 备注：OpenRouter OpenAI 格式支持 reasoning: { effort, exclude }（思考控制，
// 2025+ 特有），与 OpenAI 标准 reasoning_effort 语义等价，客户端传哪个都透传。
// 实测遇到具体平台怪癖（如某 provider 拒绝某参数组合）再在此补条件修正。
export async function convert_request(req: Req, ctx: Ctx): Promise<Req> {
  return req
}

// ── 响应转换：usage 归一化 ────────────────────────────────
// OpenRouter usage 结构（OpenAI 兼容 + 扩展）：
//   { prompt_tokens, completion_tokens, total_tokens,
//     prompt_tokens_details: { cached_tokens },
//     completion_tokens_details: { reasoning_tokens },
//     native_tokens_prompt / native_tokens_completion }  ← 原始计费 token（忽略）
export async function convert_response(resp: Resp, ctx: Ctx): Promise<Resp> {
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
