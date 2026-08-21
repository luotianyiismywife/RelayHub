// one-api 余额查询 hooks
// quota_balance：one-api 余额接口与 OpenAI 不同（内部接口 /api/user/self）
// one-api 余额 = quota（token 数），汇率：1 USD = 500000 quota（one-api 默认）
// 注意：这里的换算只是"余额展示"，真实成本计算归 Kernel-billing

export async function quota_balance(ctx: Ctx): Promise<Balance> {
  // one-api 内部接口：GET /api/user/self → { quota: 5000000 }
  const data = await ctx.http.get("/api/user/self")

  // quota 是 token 数，换算成金额（纯数字，无货币符号）
  // 1 USD = 500000 quota（one-api 默认汇率，按部署配置可能不同）
  return {
    total: (data.quota ?? 0) / 500000,   // ← 新契约字段是 total（旧 balance 已废弃）
  }
}
