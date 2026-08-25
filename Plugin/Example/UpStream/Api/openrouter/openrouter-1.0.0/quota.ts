// OpenRouter 余额查询 hooks
// quota_balance（余额计费模式：充值制，按用量扣 credit）
// 只返回平台数据（金额数字），成本计算/货币转换归内核
// 结构见插件模板分类 §0.5：total 总余额 / permanent 充值 / limited 限时赠送
// ════════════════════════════════════════════════════════════════
// OpenRouter GET /api/v1/auth/key（用转发 key 即可，无需独立查询凭据）：
//   { "data": {
//       "label": "My key",
//       "usage": 123.45,          // 已用（美元）
//       "limit": 1000,            // 额度上限（美元）；null = 免费 tier
//       "is_free_tier": false,
//       "rate_limit": { "requests": 1000, "interval": "10s" }
//   } }
// 余额 = limit - usage（充值制）；（免费 tier 无余额概念，占位 0）

export async function quota_balance(ctx: Ctx): Promise<Balance> {
  const data = await ctx.http.get("/v1/auth/key")
  const d = data.data ?? {}

  // 免费 tier（limit = null）：模型走 :free 后缀免费调用，无余额概念
  // 返回 0 仅占位 —— 若内核因此判定"无余额"，配合 error_patterns 不会误轮换
  if (typeof d.limit !== "number") {
    return { total: 0 }
  }
  return { total: d.limit - (d.usage ?? 0) }   // 纯数字，无货币符号（美元）
}
