// <插件名> 协议转换 hooks（可选，平台有怪癖才需要）
// ════════════════════════════════════════════════════════════════
// 协议情况总览 —— 遇到哪种情况，写在哪里（照着对号入座）：
//   · 静态强制头 / 必传字段（如 anthropic-version、max_tokens）→ yaml special
//   · 条件逻辑（thinking 模式限制 / 工具格式差异 / 参数互斥）→ 本文件 convert_request
//   · 响应修正（工具调用文本化 / 字段重写）→ 本文件 convert_response
//   · usage 多维明细（缓存读/推理等）→ 本文件 extract_usage（见下）
//   ⚠️ 协议入口转换（客户端格式 → 标准 OpenAI）是内核内置，本文件只管"标准→上游"的出口修正
// ════════════════════════════════════════════════════════════════
// 静态头已在 yaml special.headers，这里只管条件逻辑

// ── 请求转换：条件修正 ─────────────────────────────────────
export async function convert_request(req: Req, ctx: Ctx): Promise<Req> {
  // if (req.protocol === "anthropic") {
  //   // 示例：thinking 强制开启时删 temperature
  //   if (req.thinking?.type === "enabled") delete req.temperature
  // }
  return req   // 无怪癖时直接透传
}

// ── 响应转换（可选）────────────────────────────────────────
// 职责：① 协议修正（平台有怪癖才写） ② usage 多维明细归一化（推荐）
// ② 归一化成 TokenUsage（契约见插件模板分类 §0.6）：
//    把平台返回的 input_token_details / output_token_details 等
//    原始对象转成统一字段，供 Kernel-billing（成本计算）和 Kernel-usage（记录）消费。
//    平台无明细字段 → 不调用 extract_usage，透传即可（内核按基础 prompt/completion 算）。
export async function convert_response(resp: Resp, ctx: Ctx): Promise<Resp> {
  // usage 多维明细归一化（推荐）：标准 OpenAI / Anthropic / Gemini 字段都兼容
  // resp.usage = extract_usage(resp.usage)
  return resp   // 无怪癖时直接透传
}

// ── usage 多维明细归一化（契约见插件模板分类 §0.6）──────────
// 输入：平台返回的原始 usage（OpenAI/Anthropic/Gemini 字段名各异）
// 输出：统一 TokenUsage（缺省字段不出现；Kernel-billing 按 0 处理）
// 关键规则：
//   - 子维度从主维度扣除（返回 cacheRead 时 prompt 应剔除缓存部分，不重复计费）
//   - unknown ≠ 0：平台没给的字段就不返回（J9，不能把未知伪装成免费）
//   - 各平台字段名参考（可扩展）：
//     OpenAI  ：prompt_tokens_details.cached_tokens / completion_tokens_details.reasoning_tokens
//     Anthropic：input_tokens/output_tokens/cache_creation_input_tokens/cache_read_input_tokens
//     Gemini  ：promptTokenCount/candidatesTokenCount/cachedContentTokenCount/thoughtsTokenCount
function extract_usage(raw: any): TokenUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const u: TokenUsage = {}
  const ptd = raw.prompt_tokens_details ?? {}
  const ctd = raw.completion_tokens_details ?? {}
  // 基础字段（各协议内核入口已归一化成 prompt_tokens/completion_tokens）
  if (typeof raw.prompt_tokens === "number")     u.prompt = raw.prompt_tokens
  if (typeof raw.completion_tokens === "number") u.completion = raw.completion_tokens
  // OpenAI 子维度
  if (typeof ptd.cached_tokens === "number")     u.cacheRead = ptd.cached_tokens
  if (typeof ctd.reasoning_tokens === "number")  u.reasoning = ctd.reasoning_tokens
  // Anthropic 子维度（内核入口转换时已并入 prompt/completion，这里补明细）
  if (typeof raw.cache_read_input_tokens === "number")     u.cacheRead = raw.cache_read_input_tokens
  if (typeof raw.cache_creation_input_tokens === "number") u.cacheWrite = raw.cache_creation_input_tokens
  // Gemini 子维度
  if (typeof raw.cachedContentTokenCount === "number") u.cacheRead = raw.cachedContentTokenCount
  if (typeof raw.thoughtsTokenCount === "number")       u.reasoning = raw.thoughtsTokenCount
  return Object.keys(u).length > 0 ? u : undefined
}
