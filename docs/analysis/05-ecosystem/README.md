# 05 · 周边生态工具

> 围绕中转站的辅助工具：多站聚合、账号管理、订阅管理。不直接是"中转站"，但写 RelayHub 时能抄交互/数据结构设计。

| 项目 | Star | 语言 | 定位 | 协议 |
|---|---|---|---|---|
| [metapi](./metapi.md) | 3.2k | TypeScript | 把多个中转站聚合为一个入口，自动发现模型、智能路由 | MIT |
| [all-api-hub](./all-api-hub.md) | 4.7k | TypeScript | New-API/Sub2API 账号管理看板：余额/签到/密钥/价格对比 | AGPL-3.0 |
| [Sub-Store](./sub-store.md) | 10.3k | JavaScript | 订阅管理/转换（机场订阅类，通用"转换器"范式） | AGPL-3.0 |

## 偷师清单

1. **metapi**：多上游聚合 + 自动模型发现 + 成本最优路由 —— 与 RelayHub"多渠道 + 路由策略"的关系很像。
2. **all-api-hub**：账号余额/健康检查的展示方式 —— RelayHub 的 `/health` 或 CLI 状态命令可参考。
3. **Sub-Store**：把几十种输入格式统一转成目标格式的"转换器注册表"设计 —— 协议转换插件的现成范例。
