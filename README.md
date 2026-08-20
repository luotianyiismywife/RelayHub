# RelayHub

> 一个 AI 中转站，微内核 + 插件化。
> **主要特点：我自己用着顺手。**
> 次要特点：如果你也觉得 NewAPI 太大，可以试试。
> 不保证 PR 合并速度，因为作者可能正在调代码。

---

## 这个项目是干嘛的

把一堆 AI 渠道（OpenAI、DeepSeek、Claude、Gemini、各种兼容服务……）统一成一个 OpenAI 兼容入口，自己用。

就这么简单。没有用户系统，没有兑换码，没有充值，没有管理后台 —— 一个 `config.yaml` 写完所有渠道和路由规则。

## 真正的"远景"（就这几条）

1. **内核跑起来内存 < 50MB**，别像 NewAPI 那样动不动就几百兆。
2. **配置文件一把梭**，一个 `config.yaml` 写完所有渠道和路由规则，不用搞数据库。
3. **插件按需加载**，要计费就挂计费插件，要日志就挂日志插件，不要的统统不装。
4. **启动命令不超过 3 秒**，`./relayhub --config ./config.yaml` 完事。
5. **遇到坑自己能改**，代码写得清晰点，别搞太抽象的架构，半年后自己还能看得懂。

## 设计哲学

```mermaid
flowchart LR
    subgraph 内核（小而硬）
        K[HTTP 入口<br/>OpenAI 兼容]
        K --> C[配置加载<br/>config.yaml]
        K --> R[路由引擎<br/>选渠道/重试]
        K --> A[适配器<br/>发上游/收响应]
    end
    subgraph 插件（按需挂）
        P1[计费插件]
        P2[日志插件]
        P3[缓存插件]
        Pn[你自己的插件]
    end
    K -.->|事件钩子| P1
    K -.->|事件钩子| P2
    K -.->|事件钩子| P3
```

## 项目状态

🚧 **刚开坑**。当前仓库只有这份 README 和调研资料，内核代码还没开始写。

## 参考资料：开源 AI 中转站调研

做之前先把市面上能学的都学了，结论在这里：

📖 **[docs/research/README.md](./docs/research/README.md)** —— 调研资料库总索引

按架构路线分了 5 类，每个项目独立一篇（含仓库链接、架构图、代码阅读路线、对 RelayHub 的启发）：

| 分类 | 收录项目 | 一句话 |
|---|---|---|
| [01 · One API 系](./docs/research/01-one-api-family/README.md) | one-api / new-api / coai | 全家桶：管理后台 + 数据库 + 计费（学它的转发链路，别学它的重） |
| [02 · 轻量网关](./docs/research/02-lightweight-gateway/README.md) ⭐ | simple-one-api / LiteLLM / Portkey / openai-forward | 配置优先、无数据库 —— **RelayHub 的同类** |
| [03 · 云原生](./docs/research/03-cloud-native-gateway/README.md) | Higress / Envoy AI Gateway | Envoy + Wasm 插件（学插件机制，不学 K8s） |
| [04 · 网页/订阅转 API](./docs/research/04-web2api/README.md) ⭐ | sub2api / gpt4free / chatgpt2api / AutoTeam 等 | 订阅账号→API（以后写网页转 API 插件的弹药库） |
| [05 · 生态工具](./docs/research/05-ecosystem/README.md) | metapi / all-api-hub / Sub-Store | 多站聚合 / 账号看板 / 订阅转换 |

## 从哪里学起（推荐顺序）

1. [simple-one-api](./docs/research/02-lightweight-gateway/simple-one-api.md) —— 和 RelayHub 定位最像，看它的 config 结构和路由策略
2. [one-api](./docs/research/01-one-api-family/one-api.md) —— 看 `Adaptor` 接口和渠道分发/重试
3. [LiteLLM](./docs/research/02-lightweight-gateway/litellm.md) —— 看翻译层和计费，插件化的教科书

## Roadmap（草稿）

- [ ] 内核：HTTP 入口 + config.yaml 加载 + OpenAI 兼容透传
- [ ] 路由：多渠道、权重、失败重试
- [ ] 插件机制：事件钩子（请求前/响应后/计费）
- [ ] 计费插件、日志插件
- [ ] 协议转换插件（OpenAI ⇄ Claude）

## 许可

待定。大概率 MIT —— 反正也没人 star。
