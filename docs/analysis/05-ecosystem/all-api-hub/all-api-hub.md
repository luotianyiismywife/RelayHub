# all-api-hub

> **New-API/Sub2API 中转站账号管理看板**（4.7k star）：余额/用量仪表盘、自动签到、密钥一键使用、价格对比、可用性测试、高级渠道管理。

## 项目卡片

| 项 | 值 |
|---|---|
| 仓库 | [qixing-jk/all-api-hub](https://github.com/qixing-jk/all-api-hub) |
| Star | ~4.7k |
| 语言 | TypeScript |
| 协议 | AGPL-3.0 |
| 官网 | all-api-hub.qixing1217.top |

## 核心能力

- 多中转站账号统一管理：余额/用量看板
- 自动签到
- 密钥一键复制使用
- 上游价格对比、可用性测试（health check）
- 高级渠道管理

## 对 RelayHub 的启发

1. **可用性测试的展示**：对每个渠道做健康检查并可视化 —— RelayHub 的 `relayhub health` 命令可以输出类似表格。
2. **价格对比**：多上游同模型比价 —— 渠道配置可预置单价字段，路由策略里用。
3. 它是"管理面板"类工具，RelayHub 不搞 UI，但这些**检查逻辑**（余额探测、健康探测）可以内聚成小命令。

---

# 模块清单表

| 模块（源码路径） | 职责 | 关键文件 |
|---|---|---|
| `src/services/accounts/` | **多账号管理**：账号 CRUD、会话、Token | `accounts/` |
| `src/services/apiAdapters/` | **上游适配**：NewAPI/Sub2API 等中转站 API 适配 | `apiAdapters/` |
| `src/services/apiService/` `apiTransport/` | API 请求层 | `apiService/` |
| `src/services/checkin/` | **自动签到** | `checkin/` |
| `src/services/modelPricing/` `models/` | **模型价格对比**、模型列表 | `modelPricing/` |
| `src/services/accountSiteDefinitions/` | 站点定义（各中转站的结构描述） | `accountSiteDefinitions/` |
| `src/services/verification/` `protectionBypass/` | 验证/风控绕过 | `verification/` |
| `src/services/importExport/` | 账号批量导入导出 | `importExport/` |
| `src/services/history/` `notifications/` | 历史记录 / 通知 | `history/` |
| `src/features/` | **前端功能页**（React 页面）：账号管理、用量分析、密钥管理、渠道管理 | `features/` |
| `src/entrypoints/` | 浏览器扩展入口（这是浏览器插件 + PWA） | `entrypoints/` |
| `src/lib/` `hooks/` `utils/` | 工具库 | `lib/` |

## 请求数据流（文字版）

1. 用户添加中转站账号（NewAPI/Sub2API 的 base_url + key）。
2. `apiAdapters` 按站点类型适配 → `apiService` 拉余额/用量/模型列表。
3. 仪表盘展示多站聚合数据；`modelPricing` 对比各站同模型价格。
4. `checkin` 定时自动签到（按站点协议）。
5. 可用性测试：周期探活 → 结果可视化。
6. 导入导出：`importExport` 支持批量账号迁移。
