# one-api 上游插件

> kind：`Upstream-api-balance`（API Key + 余额计费）
> 平台：one-api / new-api 系中转站
> **定位：展示"中转站作为上游"怎么写插件**（中转站套中转站场景）

## 文件

| 文件 | 说明 |
|---|---|
| `upstream.yaml` | 上游定义（含 pass_headers / strip_headers 多级代理示例） |
| `http.yaml` | 状态码 → 动作映射（rotate/cooldown/retry/passthrough，无 402） |
| `models.ts` | 模型列表（标准 OpenAI 格式，透传） |
| `quota.ts` | 余额查询（one-api 内部接口 /api/user/self，quota→金额） |
| `convert.ts` | 协议转换 + usage 归一化（extract_usage） |
| `package.json` | 插件元数据 |

## 平台要点

- **作为上游的中转站**：OpenAI 兼容标准，协议/认证全标准
- **唯一定制点**：余额接口（one-api 用 `/api/user/self`，quota 是 token 数）
- **多级代理**：`pass_headers` 透传链路追踪头，`strip_headers` 剥离内部头
- **汇率**：one-api 默认 1 USD = 500000 quota（按部署配置调整）

## 对比：为什么这个插件这么简单

| 与 tokenrhythm 对比 | one-api（中转站） |
|---|---|
| 协议 | 标准（无怪癖） |
| convert_request | 不需要（透传） |
| list_models | 标准格式 |
| 唯一 ts | quota_balance（内部接口） |

**中转站作为上游 = 最省心的插件场景**——它自己就是网关，对外标准。
