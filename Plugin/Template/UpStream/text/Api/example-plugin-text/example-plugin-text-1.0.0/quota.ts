// <插件名> 计费查询 hooks
// ════════════════════════════════════════════════════════════════
// 计费情况总览 —— 遇到哪种情况，写在哪里（照着对号入座）：
//   balance 类（Upstream-text-api-balance）：
//     · 只有总余额           → quota_balance 返回 { total }
//     · 充值+限时赠送分开     → quota_balance 返回 total/permanent/limited
//     · 峰时消耗翻倍         → yaml billing.peak（或钩子透传 peak）
//     · 余额有有效期         → yaml rotation.balance_ttl
//     · 查余额要 cookie      → yaml auth.query.cookie
//   quota 类（Upstream-text-api-quota）：
//     · 单窗口限额           → quota_usage 返回 1 个 window
//     · 多窗口（5h/周/月）   → quota_usage 返回多个 window（kind 滚动/日历）
//     · 日限额/3天限额       → window.period = "daily"/"3d"（kind 对应）
//     · 套餐到期时间         → planExpiresAt
//     · 额度耗尽回退余额     → fallbackToBalance
//     · 各窗口独立重置时间   → windows[].resetsAt（必填！）
//     · 峰谷定价             → yaml billing.peak / 钩子透传 peak
//   ⚠️ 成本计算（缓存读/推理/图片/音频/阶梯/换算）不在本文件！
//      那归 Kernel-billing（见 convert.ts extract_usage 只透传 usage 明细）
// ════════════════════════════════════════════════════════════════
// 同时提供两个钩子，按 kind 用哪个：
//   kind: Upstream-text-api-balance → quota_balance（余额查询）
//   kind: Upstream-text-api-quota   → quota_usage（套餐限额查询）
// upstream.yaml 的 scripts 引用哪个就实现哪个（不用的可删）

// ════════════════════════════════════════════════════════════════
// Usage 结构契约（kind: Upstream-text-api-quota）—— 内核依赖以下字段：
//   planExpiresAt?: string     套餐到期时间（整个套餐何时结束，可选）
//   windows[].period           "5h" | "3d" | "daily" | "weekly" | "monthly"
//   windows[].kind             ★ "rolling"（滚动）| "calendar"（日历固定边界）
//                              rolling  ：过去 N 时长滑动（5h/3d）→ resetsAt = now+周期
//                              calendar ：固定日历边界（daily/weekly/monthly）→ resetsAt = 下一个边界
//   windows[].used             已用额度
//   windows[].limit            总额度
//   windows[].percent?         已用百分比（可算，平台给了才填）
//   windows[].windowStart?     ★ 窗口开始时间（calendar 类，sub2api 模式：daily_window_start 等）
//   windows[].resetsAt         ★ 必填：窗口下一次重置时间（ISO8601）
//                              ★ 每个窗口都必须有！内核靠它：判断窗口过期、调度刷新、算剩余时间
//                              ★ 平台不直接给时用 resolveResetsAt 兜底推断（见下）
//   windows[].peak?            此窗口的峰谷定价（峰时消耗倍率，可选）
//   fallbackToBalance?         额度耗尽后是否回退余额
//   peak?                      全局峰谷定价（可选，作用于所有窗口）
// 峰谷定价 PeakRate：{ start: "14:00", end: "18:00", multiplier: 2, timezone?: "Asia/Shanghai" }
//   —— 静态声明进 yaml billing.peak；钩子把平台返回的峰谷数据透传即可
// ════════════════════════════════════════════════════════════════

// ── 余额查询（kind: Upstream-text-api-balance 必配）──────────────
// 只返回平台数据（金额数字），不含成本计算/货币转换（那是内核的职责）
// 归一化结构：total 总余额；permanent 充值余额；limited 限时赠送余额（每笔）
//   —— 平台不支持细分时只填 total 即可
// 金额无货币符号（美元/人民币统一为数字）
export async function quota_balance(ctx: Ctx): Promise<Balance> {
  // ← 填平台的余额端点，如 ctx.http.get("/v1/quota")
  // ← 解析返回的余额字段，如 data.balance
  const data = await ctx.http.get("/v1/quota")     // ← 改实际端点
  return {
    total: data.balance,              // ← 总余额（必填，纯数字）
    // permanent: data.recharge,      // ← 充值余额（平台支持才填）
    // limited: [{ amount: 1.5, expiresAt: "2026-09-01T00:00:00Z" }],  // ← 限时赠送（每笔）
  }
}

// ── 套餐限额查询（kind: Upstream-text-api-quota 必配）────────────
// 调用平台的用量端点，归一化成统一结构（套餐到期 + 多窗口 + 回退标志）
// ⚠️ 每个窗口必须有 kind + resetsAt（滚动/日历、各自重置时间）—— 见文件头契约
// ⚠️ 绝不静默返回 undefined：resolveResetsAt 三层兜底，全失败会 throw
// ⚠️ 峰谷定价：平台有 → 透传；没有 → 省略（静态声明在 yaml billing.peak）
export async function quota_usage(ctx: Ctx): Promise<Usage> {
  // ← 填平台的用量端点，如 ctx.http.get("/usage")
  const data = await ctx.http.get("/usage")       // ← 改实际端点

  return {
    planExpiresAt: data.planExpiresAt,  // ← 套餐到期时间（平台支持才填）
    windows: [
      // ← 按平台实际窗口填写；parseWindow 解析用量字段，resolveResetsAt 兜底重置时间
      // ← rolling 窗口：kind: "rolling"（5h/3d 等滑动窗口）
      { period: "5h", kind: "rolling",  ...parseWindow(data.rolling),  resetsAt: resolveResetsAt(data.rolling, "5h") },
      // ← calendar 窗口：kind: "calendar"（daily/weekly/monthly 固定日历边界）
      // ← windowStart = 窗口开始时间（sub2api 模式：daily_window_start 等，calendar 类建议填）
      { period: "daily",   kind: "calendar", ...parseWindow(data.daily),   windowStart: data.daily_window_start,   resetsAt: resolveResetsAt(data.daily, "daily") },
      { period: "weekly",  kind: "calendar", ...parseWindow(data.weekly),  windowStart: data.weekly_window_start,  resetsAt: resolveResetsAt(data.weekly, "weekly") },
      { period: "monthly", kind: "calendar", ...parseWindow(data.monthly), windowStart: data.monthly_window_start, resetsAt: resolveResetsAt(data.monthly, "monthly") },
    ],
    fallbackToBalance: data.useBalance,   // ← 按平台实际字段
    // peak: parsePeak(data.peak),       // ← 平台返回峰谷定价才透传（可选）
  }
}

// ── 窗口用量解析（平台字段名不固定，兼容变体）───────────────
// 返回 {} 表示平台没这个窗口/字段（展开后不产生属性，窗口仍在但无数据）
function parseWindow(raw: any): { used?: number; limit?: number; percent?: number } {
  if (!raw || typeof raw !== "object") return {}
  return {
    used: raw.used ?? raw.usedTokens ?? raw.used_quota ?? raw.usage_usd,
    limit: raw.limit ?? raw.total ?? raw.total_quota ?? raw.limit_usd,
    percent: raw.percent ?? raw.usagePercent ?? raw.usage_percent,
  }
}

// ── 重置时间解析（★ resetsAt 必填，三层兜底，全失败则报错）──
// 第 1 层：平台直接给 resetsAt / resetAt / resets_at / window_start（ISO8601）→ 直接用
// 第 2 层：平台给 reset_in_sec / resets_in_seconds（N 秒后重置）→ 转 ISO
// 第 3 层：都不给 → 按 period 推断（滚动窗口 = now+周期；日历窗口 = 下一个日历边界）
// 兜底失败（period 未知）→ throw：绝不静默返回 undefined
//   （内核拿不到 resetsAt 会出问题：无法判断窗口过期/调度刷新）
function resolveResetsAt(raw: any, period: string): string {
  // 第 1 层：直接给时间戳
  const direct = raw?.resetsAt ?? raw?.resetAt ?? raw?.resets_at ?? raw?.window_start
  if (typeof direct === "string" && !Number.isNaN(Date.parse(direct))) {
    // calendar 窗口给了 window_start → 下一个边界 = window_start + 周期
    if (raw?.window_start && isCalendar(period)) return nextBoundary(new Date(direct), period)
    return direct
  }
  // 第 2 层：给"多少秒后重置"
  const sec = raw?.reset_in_sec ?? raw?.resets_in_seconds
  if (typeof sec === "number" && Number.isFinite(sec)) {
    return new Date(Date.now() + sec * 1000).toISOString()
  }
  // 第 3 层：按周期推断（UTC）
  const now = new Date()
  if (isRolling(period)) {
    const ms = periodMs(period)   // "5h"→5*3600e3, "3d"→3*86400e3
    if (ms > 0) return new Date(now.getTime() + ms).toISOString()
  }
  if (isCalendar(period)) return nextBoundary(now, period).toISOString()
  throw new Error(`quota_usage: 未知窗口 period="${period}"，无法推断 resetsAt，请在钩子里补平台实际重置时间`)
}

// ── 周期时长（滚动窗口用）───────────────────────────────
// "5h" → 5 小时毫秒数；"3d" → 3 天毫秒数；未知返回 -1
function periodMs(period: string): number {
  const m = /^(\d+)([hd])$/.exec(period)
  if (!m) return -1
  const n = parseInt(m[1], 10)
  return m[2] === "h" ? n * 3600_000 : n * 86400_000
}

// ── 判断窗口类型 ────────────────────────────────────────
function isRolling(period: string): boolean { return /^\d+[hd]$/.test(period) }
function isCalendar(period: string): boolean {
  return period === "daily" || period === "weekly" || period === "monthly"
}

// ── 下一个日历边界（calendar 窗口的 resetsAt）────────────
// daily → 明天 00:00 UTC；weekly → 下周一 00:00 UTC；monthly → 下月 1 日 00:00 UTC
// 平台有自己的边界时请覆盖（传平台给的 window_start/resetsAt）
function nextBoundary(from: Date, period: string): Date {
  switch (period) {
    case "daily":   return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + 1))
    case "weekly":  return nextWeekBoundary(from)
    case "monthly": return nextMonthBoundary(from)
    default:        throw new Error(`nextBoundary: 未知日历窗口 "${period}"`)
  }
}

// 下周一 00:00 UTC（周固定边界；平台有自己的边界时请用平台的）
function nextWeekBoundary(from: Date): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const add = d.getUTCDay() === 0 ? 7 : 7 - d.getUTCDay()   // 到下周一的偏移
  d.setUTCDate(d.getUTCDate() + add)
  return d
}

// 下月 1 日 00:00 UTC（月固定边界；平台有自己的边界时请用平台的）
function nextMonthBoundary(from: Date): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1))
}

// ── 峰谷定价解析（平台返回峰谷数据才用，可删）──────────────
// 兼容 sub2api 风格字段：peak_start / peak_end / peak_rate_multiplier / peak_rate_enabled
// 归一化：{ start, end, multiplier, timezone? }
function parsePeak(raw: any): PeakRate | undefined {
  if (!raw || typeof raw !== "object") return undefined
  if (raw.peak_rate_enabled === false) return undefined
  const start = raw.peak_start ?? raw.start
  const end = raw.peak_end ?? raw.end
  const multiplier = raw.peak_rate_multiplier ?? raw.multiplier
  if (!start || !end || typeof multiplier !== "number") return undefined
  return {
    start,
    end,
    multiplier,
    timezone: raw.timezone ?? raw.peak_timezone,
  }
}
