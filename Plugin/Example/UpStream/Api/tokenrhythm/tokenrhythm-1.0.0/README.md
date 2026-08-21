# tokenrhythm 上游插件

> kind：`Upstream-api-balance`（API Key + 余额计费）
> 平台：基云律动（https://tokenrhythm.studio/v1）
> 来源：https://github.com/luotianyiismywife/tokenrhythm-copilot （实测排障记录）

## 文件

| 文件 | 说明 |
|---|---|
| `upstream.yaml` | 上游定义（端点/认证/静态规则/协议策略/脚本映射） |
| `http.yaml` | 状态码 → 动作映射（rotate/cooldown/retry/passthrough，实测） |
| `convert.ts` | 协议条件修正（convert_request / convert_response） |
| `models.ts` | 模型列表归一化（list_models，能力探测） |
| `quota.ts` | 余额查询（quota_balance） |
| `package.json` | 插件元数据 |

## 平台要点

- **计费模式**：余额计费（非套餐）
- **三协议**：OpenAI 兼容（标准）+ Anthropic / Responses（有怪癖，需 ts）
- **Anthropic 必带头**：`anthropic-version: 2023-06-01` + 必传 `max_tokens`（yaml 静态规则）
- **Anthropic 踩坑**：thinking enabled + temperature/top_p → 400（ts 修正）
- **Responses 踩坑**：扁平工具格式、tool_choice 仅 auto/none、拒绝 tool_call 块（ts 修正）
- **能力探测**：`GET /models` 返回 supports_anthropic / supports_responses，不硬编码模型 ID

## 平台实测规则清单（来源 tokenrhythm-copilot）

| 规则 | 处理 |
|---|---|
| Anthropic 必带头 | yaml `special.headers.anthropic`（anthropic-version） |
| Anthropic 必传 max_tokens | yaml `required_fields.anthropic` |
| thinking enabled + temperature → 400 | ts `convert_request`（跳过 temperature/top_p） |
| DeepSeek tool_choice 只接受字符串 | ts `convert_request` |
| Responses 工具扁平格式 | ts `convert_request` |
| Responses tool_choice 仅 auto/none | ts `convert_request` |
| OpenAI thinking 仅 enabled/auto/disabled | ts `convert_request` |
| Responses 拒绝 tool_call 块 | ts `convert_response`（文本化回填） |
| 部分模型不支持 Anthropic/Responses | ts `list_models`（能力探测） |
