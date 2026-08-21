# CPA（CLI Proxy API）架构设计笔记

> 记录 CPA / CLI Proxy API 的架构认知，供 RelayHub 插件化设计参考。
> 来源：LINUX DO 教程（[拒绝token焦虑 cpa 反代 chatgpt 保姆级教程](https://linux.do/t/topic/2120257)）+ new-api 源码实证。

---

## 1. 概念：CLI Proxy API（CPA）是什么

AI 厂商（OpenAI / Anthropic / Google / xAI）都发布了官方命令行工具：

| CLI 工具 | 厂商 | 协议入口 |
|---|---|---|
| Codex CLI（`codex`） | OpenAI | `/backend-api/codex/responses` |
| Claude Code（`claude`） | Anthropic | - |
| Gemini CLI（`gemini`） | Google | - |
| Grok CLI（`xai`） | xAI | `CLIProxyHost`（专用代理主机） |

这些 CLI 默认直连官方 API（需要官方 Key 付费）。**CLI Proxy** = 让 CLI 指向一个中转/反代端点：

1. 用中转站的 Key / **订阅账号池**（CPA 认证文件）付费，不充官方 API
2. 一个地方统一管理多个 CLI 的凭据
3. 聚合多上游、走中转站的计费 / 路由

### 术语澄清

- **CPA（ChatGPT Authentication File）**：ChatGPT 订阅账号的认证凭据（`access_token` / `refresh_token` / `account_id` 等），是"原材料"。
- **CLI Proxy API**：把认证文件 + 官网后端 API 包成一个可被 CLI 访问的代理端点的服务。

---

## 2. 典型部署链路（教程场景）

```
用户 / Codex CLI / Claude Code ...
        │  OpenAI 兼容入口 /v1/responses
        ▼
   ┌─────────────────────┐
   │  NEW API (中转节点)   │   ← token 监控 + 渠道管理 + 负载均衡
   │  渠道类型 57: Codex   │
   └──────────┬──────────┘
              │ 转发到 CPA 的反代端点
              ▼
   ┌─────────────────────┐
   │ CPA (CLI Proxy API) │   ← 管理认证文件 + 反代 chatgpt.com
   │   v6.10.9           │       后端 Codex API
   └──────────┬──────────┘
              │ /backend-api/codex/responses
              ▼
   ┌─────────────────────┐
   │  ChatGPT 官网 (Codex) │
   └─────────────────────┘
```

**职责划分**：
- **CPA**：账号（认证文件）管理 + 官网协议反向代理 —— 账号体系的"控制面"
- **NEW API**：对外统一入口、token 监控、渠道负载均衡 —— 请求的"数据面"

---

## 3. new-api 对接 CPA 的源码实证

### 3.1 渠道类型

`constant/channel.go`：

```go
ChannelTypeCodex = 57   // "ChatGPT Subscription (Codex)"
```

### 3.2 独立适配器

`relay/channel/codex/adaptor.go` —— 请求路径直指 CPA/官网的反代端点：

```go
path = "/backend-api/codex/responses"         // 普通 responses
path = "/backend-api/codex/responses/compact" // 压缩模式
path = "/backend-api/codex/alpha/search"      // 搜索
```

该适配器只支持 `RelayModeResponses` 系列端点，其他端点（chat/completions、embeddings 等）全部返回 `not supported`。

### 3.3 鉴权：Key 是 JSON 认证文件

`relay/channel/codex/oauth_key.go`：

```go
type OAuthKey struct {
    AccessToken  string `json:"access_token,omitempty"`
    RefreshToken string `json:"refresh_token,omitempty"`
    AccountID    string `json:"account_id,omitempty"`
    LastRefresh  string `json:"last_refresh,omitempty"`
    Email        string `json:"email,omitempty"`
    Type         string `json:"type,omitempty"`
    Expired      string `json:"expired,omitempty"`
}
```

`SetupRequestHeader` 中的请求头伪装：

```go
Authorization: Bearer <access_token>
chatgpt-account-id: <account_id>
originator: codex_cli_rs                  // 伪装成官方 CLI
OpenAI-Beta: responses=experimental
Content-Type: application/json            // 强制精确媒体类型
```

### 3.4 凭据自动刷新

`main.go` —— 定时任务，每 10 分钟检查，快过期时自动刷新：

```go
// Codex credential auto-refresh check every 10 minutes, refresh when expires within 1 day
```

---

## 4. 架构思想提炼

### 4.1 控制面 / 数据面分离

openai-cpa 那个仓库描述的核心概念，在这里是实际落地形态：

- **控制面**：账号 / 认证文件 / 鉴权 / 遥测（CPA 负责）
- **数据面**：请求转发 / 路由 / 负载均衡（NEW API 负责）

> ⚠️ 注：`wenfxl/openai-cpa` 仓库源码未公开（仅 LICENSE），概念价值大于代码价值。
> 具体实现参考 sub2api 的 `account_service` + `token_refresher`（源码完整）。

### 4.2 协议适配三件套（写 RelayHub 网页转 API 插件时的范本）

1. **协议适配**：请求路径 + 请求/响应体转换（`GetRequestURL` / `ConvertRequest`）
2. **特殊鉴权**：`Authorization` + `chatgpt-account-id` + `originator` 等定制头
3. **凭据自动刷新**：定时任务 + 过期前刷新（token 生命周期管理）

---

## 5. 对 RelayHub 架构的影响

| 设计点 | 对应 RelayHub 插件 |
|---|---|
| 上游协议适配 | **上游适配插件**（OpenAI/Claude/Gemini/Codex/网页源...） |
| 鉴权方式可插拔 | **鉴权插件**（普通 Key / JSON OAuth / CPA 协议 / 订阅号池） |
| 账号管理独立 | **账号模块**（独立于转发逻辑，参考 sub2api `account_service`） |
| 凭据自动刷新 | 账号模块的**定时刷新任务** |
| token 监控 / 计费 | RelayHub 无 UI，做成 `relayhub health` / `relayhub tokens` 命令 |

### 关键结论

- RelayHub 是 OpenAI 兼容网关，**天然就是 CLI Proxy**：把 Codex / Claude Code / Gemini CLI 的 `base_url` 指向 RelayHub 即可。
- 需要插件支持的点：各 CLI 的**鉴权头差异** + **凭据类型**（普通 key vs 认证文件）。
- 认证文件类型的凭据需要**结构化存储**（JSON 字段，非单一字符串），插件接口设计时要留好。

---

## 6. 参考资料

- LINUX DO 教程：[cpa（CLI Proxy API）反代 chatgpt（Codex）保姆级全图文教程](https://linux.do/t/topic/2120257)
- new-api 源码：`relay/channel/codex/`（适配器 + OAuth Key + 自动刷新）
- sub2api 源码：`backend/internal/service/`（账号服务 + token 刷新 + Grok CLI proxy）
- all-api-hub 源码：`src/services/integrations/cliProxyService.ts`（CLI Proxy 集成，4 种 provider 类型）
