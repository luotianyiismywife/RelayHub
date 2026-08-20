# LiteLLM

> **开源 AI 网关的事实标准**（56.8k star）：Python SDK + Proxy Server 双层设计，100+ 供应商统一 OpenAI 格式。
> 它的 **ARCHITECTURE.md 是全网最好的 AI 网关架构文档**，翻译层设计是插件化的教科书。

## 项目卡片

| 项 | 值 |
|---|---|
| 仓库 | [BerriAI/litellm](https://github.com/BerriAI/litellm) |
| Star | ~56.8k |
| 语言 | Python（网关）+ 少量 Rust（litellm-rust 高性能路由） |
| 协议 | MIT（核心）+ 企业版商用 |
| 架构文档 | [ARCHITECTURE.md](https://github.com/BerriAI/litellm/blob/main/ARCHITECTURE.md) |
| 官方文档 | [docs.litellm.ai](https://docs.litellm.ai/) |
| 价格表 | [model_prices_and_context_window.json](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) |

## 双层架构

```mermaid
flowchart TD
    Client[OpenAI SDK / Anthropic SDK / HTTP]
    Client -->|POST /v1/chat/completions| Proxy[AI Gateway proxy/]
    Proxy --> Auth[user_api_key_auth<br/>虚拟 Key + 预算 + 限流]
    Auth --> Hooks[hooks/<br/>max_budget_limiter / parallel_request_limiter]
    Hooks --> Router[router.py<br/>负载均衡/回退/冷却]
    Router --> SDK[LiteLLM SDK litellm/]
    SDK --> Handler[llms/custom_httpx/llm_http_handler]
    Handler --> Transform[llms/{provider}/chat/transformation.py<br/>transform_request / transform_response]
    Transform --> Upstream[100+ LLM API]
    SDK --> Cost[cost_calculator<br/>completion_cost tokens×price]
    Cost --> Logging[litellm_logging]
    Logging --> DB[(PostgreSQL spend logs)]
```

## 关键设计：翻译层（Translation Layer）

每个供应商一个 `transformation.py`，实现统一的 `BaseConfig`：

```python
class ProviderConfig(BaseConfig):
    def transform_request(self, model, messages, optional_params, litellm_params, headers):
        # OpenAI 格式 → 供应商格式
        return {"messages": transformed_messages, ...}

    def transform_response(self, model, raw_response, model_response, logging_obj, ...):
        # 供应商格式 → OpenAI 格式
        return ModelResponse(choices=[...], usage=Usage(...))
```

> `BaseLLMHTTPHandler` 调用这些方法，**加新供应商永远不需要改 handler 本身** —— 这正是插件化的核心思想。

## 成本核算流程（计费插件的范本）

1. 响应返回 → `update_response_metadata()` → `_response_cost_calculator()`
2. `completion_cost()` 用 `model_prices_and_context_window.json` 计算
3. 成本写入 `response._hidden_params["response_cost"]`，并加响应头 `x-litellm-response-cost`
4. `async_success_handler()` → `DBSpendUpdateWriter` 排队 → 后台任务 60s 批量写 PostgreSQL

## 路由层能力（router.py）

- TPM/RPM（每分钟 token/请求数）跟踪，超限自动冷却（cooldown）
- `router_strategy/`：lowest_latency / simple_shuffle 等路由算法
- DualCache：内存 + Redis 双层缓存
- 失败自动重试 + 回退（fallback）到其他 deployment

## 对 RelayHub 的启发

1. **翻译层隔离**：`transform_request/transform_response` 一一对应 → RelayHub 的"供应商适配插件"就长这样。
2. **统一价格表 JSON**：`model_prices_and_context_window.json` 维护所有模型价格 —— RelayHub 的计费插件可以直接用这份数据（或裁剪子集）。
3. **TPM/RPM 跟踪 + 冷却**：渠道限流的正确粒度，值得内置进内核。
4. **成本进响应头**（`x-litellm-response-cost`）：方便客户端自查，成本很低的功能。
5. **Python 的性能代价**：LiteLLM 需要常驻进程 + DB + Redis 才能跑出性能；RelayHub 用 Go 单文件是更轻的路线，但架构思想全盘适用。

---

# 模块清单表

| 模块（源码路径） | 职责 | 关键文件 |
|---|---|---|
| `litellm/`（SDK 核心） | **底层 LLM 调用库**：`completion()`/`acompletion()` 入口、供应商识别、HTTP 编排、翻译层 | `main.py`, `utils.py`, `llms/custom_httpx/llm_http_handler.py` |
| `litellm/llms/{provider}/` | **翻译层**：每家一个 `transformation.py`，实现 `transform_request/transform_response` | `llms/anthropic/chat/transformation.py` 等 |
| `litellm/proxy/` | **AI Gateway**：FastAPI 端点、虚拟 Key 认证、预算/限流 hooks、spend 记录 | `proxy_server.py`, `auth/`, `hooks/` |
| `litellm/proxy/management_helpers/` | 后台任务：批量写 spend、预算重置、deployment 同步、key 轮换 | `budget_reset_job.py`, `key_rotation_manager.py` |
| `litellm/router.py` | **路由层**：负载均衡、TPM/RPM 跟踪、冷却、fallback | `router.py`, `router_strategy/` |
| `litellm/caching/` | 缓存：DualCache（内存+Redis）、LLM 响应缓存 | `dual_cache.py`, `redis_cache.py` |
| `litellm/models/` + `repositories/` | 数据层：Pydantic 模型 + Repository CRUD（gateway 和 SDK 共用） | `models/`, `repositories/` |
| `litellm/cost_calculator.py` | 成本计算：`completion_cost(tokens × price)` | `cost_calculator.py` |
| `litellm/integrations/` | 可观测性回调（Langfuse/Datadog 等） | `integrations/` |
| `model_prices_and_context_window.json` | **统一价格表**：所有模型的价格/上下文窗口 | 根目录 |
| `litellm-rust/` | 高性能路由的 Rust 实现（实验） | `litellm-rust/` |
| `ui/` | 管理后台（React） | `ui/litellm-dashboard/` |

## 请求数据流（文字版）

1. 客户端 → `proxy_server.py` 的 `/v1/chat/completions` 端点。
2. `user_api_key_auth()` 校验虚拟 Key（缓存命中走 Redis，miss 查 PostgreSQL）。
3. hooks 检查预算（`max_budget_limiter`）和并发限制（`parallel_request_limiter`）。
4. `route_request()` → `router.py` 选 deployment（负载均衡策略 + TPM/RPM 冷却判断）。
5. SDK `litellm.acompletion()` → `get_llm_provider()` 识别供应商 → `llm_http_handler` 发起 HTTP。
6. `transform_request()` 转供应商格式 → 上游 → `transform_response()` 转回 OpenAI 格式。
7. 成本核算：`cost_calculator.completion_cost()` → 写入 `response._hidden_params["response_cost"]` → 加响应头。
8. 异步：`async_success_handler()` → `DBSpendUpdateWriter` 排队 → 后台 60s 批量写 PostgreSQL。
