// tokenrhythm 余额查询 hooks
// quota_balance（余额计费模式）
// 只返回平台数据（金额数字），成本计算/货币转换归内核
// 注意：查余额用 cookie（auth.query.cookie），不用 key（key 查不了余额，实测）
// 结构见插件模板分类 §0.5：total 总余额 / permanent 充值 / limited 限时赠送

export async function quota_balance(ctx: Ctx): Promise<Balance> {
  // 余额查询走 cookie 认证（yaml auth.query.cookie 注入）
  // 余额端点以平台实际为准（示例）
  const data = await ctx.http.get("/v1/quota", {
    auth: "query",          // ← 用查询凭据（cookie），非转发 key
  })
  return { total: data.balance }   // 纯数字，无货币符号
}
