# openai-forward

> **纯转发路线**：Python asyncio 高并发转发 + 智能缓存 + 速率/Token 限流 + 自定义密钥。
> 已归档（2026-07，~1k star），但"转发+缓存"的思路值得记一笔。

## 项目卡片

| 项 | 值 |
|---|---|
| 仓库 | [KenyonY/openai-forward](https://github.com/KenyonY/openai-forward) |
| Star | ~988（已归档） |
| 语言 | Python（uvicorn + aiohttp + asyncio） |
| 协议 | MIT |
| 部署 | [deploy.md](https://github.com/KenyonY/openai-forward/blob/main/deploy.md) |

## 核心能力

- 全能转发：几乎任何类型请求（openai 风格 + 通用 general 转发）
- **智能缓存**：相同请求直接返回缓存（可省费、加速），openai 转发支持 `extra_body={"caching": true}` 控制
- 用户流量控制：请求速率 + Token 速率（内存移动窗口）
- 实时响应日志（对话日志可导出 JSON）
- 自定义密钥：`fk-*` 替代原始 key
- 多目标路由：不同服务地址挂到同一端口不同路由（`/localai`、`/gemini`）
- IP 黑白名单、失败自动重试

## 配置示例

```bash
# 代理 OpenAI + 本地 LocalAI + Gemini，三个目标一个端口
FORWARD_CONFIG='[
  {"base_url": "https://api.openai.com", "route": "/", "type": "openai"},
  {"base_url": "http://localhost:8080", "route": "/localai", "type": "openai"},
  {"base_url": "https://generativelanguage.googleapis.com", "route": "/gemini", "type": "general"}
]'
```

## 对 RelayHub 的启发

1. **多目标路由挂载**：一个端口按路径前缀分发到不同上游 —— RelayHub 的路由表可以支持"路由前缀"概念。
2. **缓存命中不重放流量**：对重复请求（如固定 prompt 的批处理）收益很大，值得做成可选插件。
3. **内存移动窗口限流**：`100/minute` 这种简单限流，Go 里用 `golang.org/x/time/rate` 就能实现，不必上 Redis。
4. 已归档说明这类"纯转发"需求已被更完整的中转站吸收，但转发层设计仍有参考价值。

---

# 模块清单表

| 模块（源码路径） | 职责 | 关键文件 |
|---|---|---|
| `app.py` | FastAPI 应用入口：路由注册、中间件装配 | `app.py` |
| `forward/` | **转发核心**：OpenAI 风格转发 + 通用转发，请求/响应处理 | `forward/` |
| `cache/` | **智能缓存**：AI 预测缓存（相同请求命中直接返回） | `cache/` |
| `config/` | 配置：`FORWARD_CONFIG` 解析、限流配置 | `config/` |
| `content/` | 内容处理（请求体变换等） | `content/` |
| `custom_slowapi.py` | 基于 slowapi 的速率限制（请求数/Token 数，内存移动窗口） | `custom_slowapi.py` |
| `decorators.py` | 路由装饰器（按 FORWARD_CONFIG 挂多目标路由） | `decorators.py` |
| `helper.py` / `console.py` | 工具 / CLI 启动 | `helper.py` |
| `webui/` | 配置管理 WebUI | `webui/` |

## 请求数据流（文字版）

1. 启动时按 `FORWARD_CONFIG` 把每个目标（`base_url` + `route` 前缀 + `type`）挂成独立路由。
2. 请求进路由 → `custom_slowapi` 限流（请求速率 + Token 速率，内存移动窗口）。
3. 查缓存：命中（相同请求）直接返回缓存内容（openai 类型还支持 `extra_body={"caching": true}` 控制）。
4. 未命中 → 转发到目标 `base_url`（openai 类型重写 key/URL，general 类型原样转发）。
5. 响应回填缓存 + 记录对话日志。
6. IP 黑白名单、自定义密钥（`fk-*`）、失败自动重试都在转发链路上处理。
