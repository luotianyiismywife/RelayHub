// OpenCode Go 套餐用量查询 hooks
// quota_usage（套餐限额计费，多窗口 + 宽容解析）
// ⚠️ 每个窗口必须有 kind + resetsAt（滚动/日历、各自重置时间）—— 契约见
//    Template/UpStream/Api/example-plugin/quota.ts（resolveResetsAt 三层兜底）

// ── 套餐用量查询（Quota 类核心钩子）───────────────────────
export async function quota_usage(ctx: Ctx): Promise<Usage> {
  // GET /usage → { rolling, weekly, monthly, useBalance }
  // 实测：401 = key 有效但无 Go 套餐（内核据此标记无套餐）
  const data = await ctx.http.get("/usage")

  return {
    // 多窗口套餐：5小时滚动（rolling）/ 周 / 月（calendar）
    // opencode-go 实测：rolling 5h 为滚动窗口，weekly/monthly 为日历窗口
    windows: [
      { period: "5h",      kind: "rolling",  ...parseWindow(data.rolling),  resetsAt: resolveResetsAt(data.rolling, "5h") },
      { period: "weekly",  kind: "calendar", ...parseWindow(data.weekly),   resetsAt: resolveResetsAt(data.weekly, "weekly") },
      { period: "monthly", kind: "calendar", ...parseWindow(data.monthly),  resetsAt: resolveResetsAt(data.monthly, "monthly") },
    ],
    // 额度耗尽后是否回退 Zen 余额
    fallbackToBalance: data.useBalance,
  }
}

// ── 窗口用量解析（平台字段名不固定，实测需兼容多种写法）────
function parseWindow(raw: any): { used?: number; limit?: number; percent?: number } {
  if (!raw || typeof raw !== "object") return {}
  const used = raw.used ?? raw.usedTokens ?? raw.used_quota
  const limit = raw.limit ?? raw.total ?? raw.total_quota
  const percent = raw.percent ?? raw.usagePercent ?? raw.usage_percent
  return { used, limit, percent }
}

// ── 重置时间解析（★ resetsAt 必填，三层兜底，全失败则报错）──
// 第 1 层：平台直接给 resetsAt / resetAt / resets_at / window_start → 直接用
// 第 2 层：平台给 reset_in_sec / resets_in_seconds（N 秒后重置）→ 转 ISO
// 第 3 层：都不给 → 按 period 推断（滚动 = now+周期；日历 = 下一个日历边界）
// 兜底失败（period 未知）→ throw：绝不静默返回 undefined
function resolveResetsAt(raw: any, period: string): string {
  const direct = raw?.resetsAt ?? raw?.resetAt ?? raw?.resets_at ?? raw?.window_start
  if (typeof direct === "string" && !Number.isNaN(Date.parse(direct))) return direct
  const sec = raw?.reset_in_sec ?? raw?.resets_in_seconds
  if (typeof sec === "number" && Number.isFinite(sec)) {
    return new Date(Date.now() + sec * 1000).toISOString()
  }
  const now = new Date()
  if (isRolling(period)) {
    const ms = periodMs(period)
    if (ms > 0) return new Date(now.getTime() + ms).toISOString()
  }
  if (isCalendar(period)) return nextBoundary(now, period).toISOString()
  throw new Error(`quota_usage: 未知窗口 period="${period}"，无法推断 resetsAt，请在钩子里补平台实际重置时间`)
}

// ── 窗口类型判断 / 周期时长 / 日历边界 ──────────────────
function isRolling(period: string): boolean { return /^\d+[hd]$/.test(period) }
function isCalendar(period: string): boolean {
  return period === "daily" || period === "weekly" || period === "monthly"
}
function periodMs(period: string): number {
  const m = /^(\d+)([hd])$/.exec(period)
  if (!m) return -1
  const n = parseInt(m[1], 10)
  return m[2] === "h" ? n * 3600_000 : n * 86400_000
}
function nextBoundary(from: Date, period: string): Date {
  switch (period) {
    case "daily":   return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + 1))
    case "weekly":  return nextWeekBoundary(from)
    case "monthly": return nextMonthBoundary(from)
    default:        throw new Error(`nextBoundary: 未知日历窗口 "${period}"`)
  }
}

// 下周一 00:00 UTC（周固定边界；平台有自己的边界时请用平台的）
function nextWeekBoundary(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const add = d.getUTCDay() === 0 ? 7 : 7 - d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + add)
  return d
}

// 下月 1 日 00:00 UTC（月固定边界；平台有自己的边界时请用平台的）
function nextMonthBoundary(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}
