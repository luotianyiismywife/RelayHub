# CLIProxyAPI

> **CLI Proxy API**：把 ChatGPT Codex / Claude Code / Gemini CLI / Grok Build / Antigravity / Kimi 等 CLI 工具的订阅账号，
> 包成 OpenAI/Gemini/Claude/Codex 兼容的 API 服务。48.5k star，Go 实现，821 个 release，230 个贡献者。
> **RelayHub 的直接竞品和重点参考**——定位高度重合（CLI Proxy + 多上游 + 账号池），但 CLIProxyAPI 是单体服务，RelayHub 是微内核+插件。

## 项目卡片

| 项 | 值 |
|---|---|
| 仓库 | [router-for-me/CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) |
| Star | 48.5k |
| Fork | 7.5k |
| 语言 | Go 100% |
| License | MIT |
| Release | 821（最新 v7.2.140，2026-08-22） |
| 贡献者 | 230 |
| 定位 | CLI 订阅账号 → 兼容 API 代理服务 |

---

## 1. 核心能力

| 能力 | 说明 |
|---|---|
| **多 CLI 协议** | OpenAI（Codex/GPT）/ Anthropic（Claude Code）/ Google（Gemini CLI/Antigravity）/ xAI（Grok Build）/ Kimi |
| **多协议出口** | OpenAI 兼容（/v1/chat/completions + /v1/responses）/ Gemini（generateContent）/ Claude（/v1/messages） |
| **OAuth 登录** | 各 CLI 的 OAuth 流程（Gemini/OpenAI/Claude/Grok），非 API Key |
| **多账号轮换** | round-robin 负载均衡（Gemini/OpenAI/Claude/Grok 各自号池） |
| **流式支持** | streaming / non-streaming / WebSocket |
| **工具调用** | function calling / tools 支持 |
| **多模态** | text + image 输入 |
| **Go SDK** | 可嵌入的 Go SDK（`docs/sdk-usage.md`），支持自定义 Provider |
| **插件系统** | docker-compose 挂载 plugin volume（v7.x 新增） |
| **集群部署** | docker-compose.cluster.yml（多实例） |
| **Codex Live** | TCP 代理 + WebRTC relay（实时语音/视频） |

---

## 2. 架构分析

### 2.1 目录结构

```
CLIProxyAPI/
├── cmd/              # 入口（main.go）
├── internal/         # 核心逻辑（provider/translator/auth 等）
├── sdk/              # 可嵌入的 Go SDK
├── docs/             # SDK 文档（usage/advanced/access/watcher）
├── examples/         # 自定义 Provider 示例
├── test/             # 测试
├── config.example.yaml
├── docker-compose.yml
├── docker-compose.cluster.yml
└── Dockerfile
```

### 2.2 核心抽象

CLIProxyAPI 的架构和 RelayHub 高度相似：

| CLIProxyAPI 概念 | RelayHub 对应 | 说明 |
|---|---|---|
| **Provider** | 上游插件 | 每个 CLI（Codex/Claude/Gemini/Grok）一个 Provider |
| **Translator** | convert_request/response | 协议参数修正（但 CLIProxyAPI 做格式转换，RelayHub 不做） |
| **Auth** | auth（凭据管理） | OAuth 登录态管理 |
| **Executor** | 转发引擎 | 执行请求 |
| **Watcher** | 凭据刷新 | 监控凭据过期，自动刷新 |
| **config.yaml** | config.yaml | 配置驱动 |
| **Go SDK** | 插件 SDK | 可嵌入/自定义 Provider |

### 2.3 与 RelayHub 的关键差异

| 维度 | CLIProxyAPI | RelayHub |
|---|---|---|
| **架构** | 单体 Go 服务 | 微内核 + 插件（Rust + TS） |
| **协议转换** | ✅ 做（OpenAI↔Gemini↔Claude 互转） | ❌ 不做（格式匹配+报错） |
| **插件化** | Go SDK 自定义 Provider | yaml + ts 声明化插件 |
| **配置** | config.yaml | config.yaml（同构） |
| **凭据** | OAuth 登录态（CLI 订阅） | API Key + OAuth 文件 + 账号池 |
| **计费** | 无内置（外接 CPA-Manager-Plus） | Kernel-billing（内置） |
| **模型列表** | 无统一模型元数据 | models.yaml + OpenRouter 补全 |
| **部署** | Docker 单容器 | Docker 单容器（同构） |

---

## 3. 对 RelayHub 的参考价值

### 3.1 值得借鉴的

| 设计 | 参考点 | 对应 RelayHub |
|---|---|---|
| **Provider 抽象** | 每个 CLI 一个 Provider，接口统一 | 上游插件（每个上游一个插件） |
| **Translator** | 协议参数修正（同格式内） | convert_request/response（已对齐） |
| **Watcher** | 凭据过期监控 + 自动刷新 | 凭据刷新（auth.refresh） |
| **Go SDK** | 可嵌入 + 自定义 Provider | 插件 SDK（A 组待办） |
| **config.yaml** | 配置驱动，无 DB | config.yaml 一把梭（同构） |
| **集群部署** | docker-compose.cluster.yml | 未来多副本（自写金丝雀） |
| **Codex Live WebRTC** | 实时语音/视频 relay | 未来 realtime 支持 |

### 3.2 RelayHub 不做的

| CLIProxyAPI 做的 | RelayHub 不做的原因 |
|---|---|
| **协议格式转换**（OpenAI↔Gemini↔Claude） | 简化架构（2026-08-24 决策），不匹配直接报错 |
| **OAuth 登录流程** | RelayHub 用 API Key + 认证文件，不做 OAuth 登录 |
| **内置 CLI 订阅管理** | RelayHub 是网关，订阅管理归上游插件/账号池 |

### 3.3 CLIProxyAPI 生态（RelayHub 可参考的周边）

CLIProxyAPI 有庞大的生态（30+ 衍生项目），几个值得关注的：

| 生态项目 | 功能 | 对 RelayHub 的启发 |
|---|---|---|
| [CPA-Manager-Plus](https://github.com/seakee/CPA-Manager-Plus) | 请求级监控 + 成本估算 + LiteLLM 价格同步 | Kernel-billing + Kernel-usage 的实现参考 |
| [CPA Usage Keeper](https://github.com/Willxup/cpa-usage-keeper) | SQLite 存储 + 聚合 API + dashboard | Kernel-usage 的存储方案（SQLite） |
| [CLIProxyAPI Dashboard](https://github.com/itsmylife44/cliproxyapi-dashboard) | Next.js 管理面板 | 未来 Page-panel 的参考 |
| [Quotio](https://github.com/nguyenphutrong/quotio) | 实时配额追踪 + 智能故障转移 | Kernel-health + Kernel-retry 的 UI 参考 |
| [Grok Search MCP](https://github.com/MapleMapleCat/Grok_Search_Mcp) | MCP 服务器（Grok 搜索） | 未来 Kernel-mcp 的参考 |

---

## 4. 与其他项目的对比

| 维度 | CLIProxyAPI | sub2api | one-api/new-api | RelayHub |
|---|---|---|---|---|
| Star | 48.5k | 37.8k | 45.7k | - |
| 语言 | Go | Go | Go | Rust+TS |
| 定位 | CLI 订阅 → API | 订阅 → API | API Key 分发 | 自用网关 |
| 协议转换 | ✅ 做 | ❌ 不做 | ✅ 做 | ❌ 不做 |
| 插件化 | Go SDK | 无 | 代码适配器 | yaml+ts |
| 配置 | config.yaml | DB | DB | config.yaml |
| 计费 | 外接 | 内置 | 内置 | 内置（Kernel-billing） |
| 模型元数据 | 无 | 无 | 有 | models.yaml + OpenRouter |

---

## 5. 总结

CLIProxyAPI 是 **CLI Proxy 领域的标杆项目**（48.5k star，821 release），和 RelayHub 定位最接近。关键差异：

1. **CLIProxyAPI 做协议转换，RelayHub 不做**——这是最大的架构分歧
2. **CLIProxyAPI 是单体 Go，RelayHub 是微内核+插件**——RelayHub 更灵活但更复杂
3. **CLIProxyAPI 无模型元数据，RelayHub 有 models.yaml + OpenRouter 补全**——RelayHub 更完整
4. **CLIProxyAPI 生态庞大（30+ 衍生），RelayHub 从零开始**——但 RelayHub 的插件化设计可复用这些生态

**写 RelayHub 内核时的参考重点**：
- Provider/Translator/Watcher 抽象（§2.2）
- config.yaml 配置驱动（同构）
- CPA-Manager-Plus 的成本估算 + LiteLLM 价格同步（Kernel-billing 参考）

---

## 6. 参考

- 仓库：https://github.com/router-for-me/CLIProxyAPI
- 文档：https://help.router-for.me/
- SDK 文档：`docs/sdk-usage.md` / `docs/sdk-advanced.md` / `docs/sdk-access.md` / `docs/sdk-watcher.md`
- 管理 API：https://help.router-for.me/management/api
- 桌面客户端：[EasyCLIProxyAPI](https://github.com/router-for-me/EasyCLIProxyAPI)
