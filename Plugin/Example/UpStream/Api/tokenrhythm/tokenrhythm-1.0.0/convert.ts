// tokenrhythm 协议转换 hooks
// convert_request / convert_response（静态头已在 yaml special.headers）

// ── 请求转换：条件修正 ─────────────────────────────────────
export async function convert_request(req: Req, ctx: Ctx): Promise<Req> {
  if (req.protocol === "anthropic") {
    // 实测：thinking 强制开启 + temperature/top_p → 400"请求参数组合无效"
    // （DeepSeek 系列强制思考；adaptive/disabled 才允许 temperature）
    if (req.thinking?.type === "enabled") {
      delete req.temperature
      delete req.top_p
    }
    // tool_choice：DeepSeek 只接受字符串，不接受对象形式
    if (typeof req.tool_choice === "object") {
      req.tool_choice = req.tool_choice.type ?? "auto"
    }
  }

  if (req.protocol === "responses") {
    // Responses 工具格式必须扁平：{type,name,description,parameters}
    // （OpenAI 嵌套 function 格式会被拒：InvalidParameter）
    if (req.tools) {
      req.tools = req.tools.map((t) => ({
        type: "function",
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      }))
    }
    // tool_choice 仅接受 auto/none（思考模式拒绝 required/对象形式）
    if (req.tool_choice && !["auto", "none"].includes(req.tool_choice)) {
      req.tool_choice = "auto"
    }
  }

  if (req.protocol === "openai") {
    // OpenAI 端点 thinking 仅接受字符串语义：enabled/auto/disabled
    // （adaptive 会被拒绝）
    if (req.thinking && !["enabled", "auto", "disabled"].includes(req.thinking.type)) {
      req.thinking = { type: "auto" }
    }
  }

  return req
}

// ── 响应转换：Responses 拒绝 function_call 内容块 + usage 归一化 ──
export async function convert_response(resp: Resp, ctx: Ctx): Promise<Resp> {
  if (ctx.protocol === "responses") {
    resp = textify_tool_calls(resp)   // [tool_call] / [tool_result] 文本化回填
  }
  // usage 多维明细归一化（契约见插件模板分类 §0.6）：
  // tokenrhythm 兼容 OpenAI 协议，usage 含 prompt_tokens_details / completion_tokens_details
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
