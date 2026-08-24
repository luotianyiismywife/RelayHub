// OpenCode Zen 模型列表 hooks
// ════════════════════════════════════════════════════════════════
// 来源：GET /v1/models（zen 返回标准 OpenAI 格式：{ object, data: [{ id, ... }] }）
// 特点：
//   · 免费模型集中在 *-free 后缀 + big-pickle（隐身模型）+ x-preview-f-free（Ox Alpha Free）
//   · muse-spark-1.2-contributor-free 走 responses 协议（Meta 模型）
//   · 免费模型"限时提供"（官方说收集反馈后可能变动）→ 建议开启模型列表定时刷新
//   · 付费模型（gpt-5.6 / claude-opus-5 等）需账号余额，匿名 public 不可用 → 过滤掉
// ════════════════════════════════════════════════════════════════
// ★ 职责（2026-08-24）：
//   1. 拉取上游 /v1/models
//   2. _→- 归一化（模型名所有 _ 转 -）★ 在这里做，内核不做
//   3. 返回 ModelInfo[]（含 capabilities）
//   4. 内核把返回结果写入插件包内 models.yaml，后续读 models.yaml（不每次调本钩子）

// ── 模型列表 ───────────────────────────────────────────────
export async function list_models(ctx: Ctx): Promise<ModelInfo[]> {
  const data = await ctx.http.get("/v1/models")     // 实际路径由 base_url + apis.models 拼

  return (data.data ?? [])
    // 只暴露匿名可用的免费模型（*free 后缀 / big-pickle 隐身模型）
    .filter((m) => /-free$|^big-pickle$/.test(m.id))
    .map((m) => ({
      // ★ 归一化：模型名所有 _ 转 -（内核不做，必须在这里做）
      id: m.id.replace(/_/g, "-"),
      capabilities: {
        openai:    !m.id.includes("muse-spark"),    // muse-spark 走 responses，不支持 openai
        anthropic: false,
        responses:  m.id.includes("muse-spark"),
        gemini:    false,
        // —— 能力维度（可选，Kernel-models 从 OpenRouter 补全）——
        // vision / thinking / tools / audio / video
      },
      // ⚠️ muse-spark-1.2-contributor-free 禁香港/新加坡节点：
      //    地区限制由内核按出口 IP 判定（network.proxy_pool 绕行），
      //    不在本文件处理 —— 路由/出口选择是内核职责，插件只透传数据。
    }))
}
