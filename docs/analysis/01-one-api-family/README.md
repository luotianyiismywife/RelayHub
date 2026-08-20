# 01 · One API 系 —— 全家桶型 AI 中转站

> 这一类是"全家桶"路线：自带管理后台、用户体系、数据库、计费、渠道管理，什么都有。
> 代价是重：SQLite/MySQL 数据库 + 前端页面 + 常驻内存几百 MB。
> **RelayHub 明确不要学它们的"重"，但要学它们的"请求链路设计"。**

| 项目 | Star | 语言 | 定位 | 协议 |
|---|---|---|---|---|
| [one-api](./one-api.md) | 36.5k | Go + React | 鼻祖：LLM API 管理 & 分发 | MIT |
| [new-api](./new-api.md) | 45.7k | Go + React | one-api 二开：更现代的网关 + 缓存计费 | AGPL-3.0 |
| [coai (chatnio)](./coai.md) | 9.3k | Go + React + MySQL/Redis | NextWeb + OneAPI 合体，C/B 端通吃 | Apache-2.0 |

## 这一系的共同架构

```mermaid
flowchart LR
    Client[客户端 / OpenAI SDK] -->|Bearer token| Gateway[网关]
    Gateway --> Auth[认证中间件<br/>token → 用户/分组/额度]
    Gateway --> RateLimit[限流中间件]
    Gateway --> Distribute[渠道分发<br/>按分组+模型 权重随机选渠道]
    Distribute --> Relay[Relay 转发引擎]
    Relay --> Adapter{适配器模式<br/>按渠道类型}
    Adapter -->|OpenAI 格式| P1[OpenAI / DeepSeek / 兼容]
    Adapter -->|格式转换| P2[Anthropic / Gemini / 国产模型]
    Relay --> Bill[计费<br/>模型倍率×分组倍率×tokens]
    Bill --> DB[(SQLite / MySQL)]
    Gateway --> Admin[管理后台 React]
    Admin --> DB
```

## 值得偷师的点（RelayHub 只取这几条）

1. **适配器模式**：每个渠道一个 `Adaptor`，统一接口
   （`GetRequestURL / ConvertRequest / DoRequest / DoResponse / GetModelList`），新增渠道不改主流程 —— **插件化的雏形**。
2. **分发中间件**：`group2model2channels` 内存索引 + 按优先级/权重随机选渠道，失败自动换渠道重试（5xx/429）。
3. **模型映射**：`用户请求的模型名 → 渠道真实模型名`，一个渠道可以"伪装"成任何模型。
4. **计费公式**：`额度 = 分组倍率 × 模型倍率 × (提示token + 补全token × 补全倍率)`，流式响应结束时回填真实 usage。

## 不该学的东西

- ❌ 前端管理后台（RelayHub 用 `config.yaml`，不需要 UI）
- ❌ 用户注册/登录/兑换码/支付（自己用，一个 API Key 就够）
- ❌ 数据库（配置文件一把梭）
