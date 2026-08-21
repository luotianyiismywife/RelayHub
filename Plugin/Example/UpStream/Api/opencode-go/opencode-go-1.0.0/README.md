# OpenCode Go 上游插件

> kind：`Upstream-api-quota`（API Key + 套餐限额计费）
> 平台：OpenCode Go（https://opencode.ai/zen/go/v1/）
> 来源：https://github.com/OnesoftQwQ/opencode-go-copilot （goUsage.ts 实测）

## 文件

| 文件 | 说明 |
|---|---|
| `upstream.yaml` | 上游定义（端点/认证/计费/脚本映射） |
| `http.yaml` | 状态码 → 动作映射（rotate/cooldown/retry/passthrough，无 402） |
| `quota.ts` | 套餐限额多窗口查询（quota_usage + 宽容解析） |
| `models.ts` | 模型列表归一化（list_models） |
| `convert.ts` | 协议转换（convert_request / convert_response，usage 归一化） |
| `package.json` | 插件元数据 |

## 平台要点

- **计费模式**：套餐限额（5小时滚动 / 周 / 月 三窗口），非余额计费
- **用量端点**：`GET /usage`（Bearer 认证，10s 超时）
- **宽容解析**：字段名不固定（percent/usagePercent、resetsAt/resetAt/reset_in_sec）
- **401 语义**：key 有效但无 Go 套餐（非 key 错误）
- **useBalance**：额度耗尽后回退 Zen 余额的标志
- **模型列表**：`GET /models`（OpenAI 格式），目录（models.dev）驱动 + API 过滤
