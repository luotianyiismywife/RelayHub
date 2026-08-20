# AutoTeam

> **ChatGPT Team 账号自动轮转管理**（1.2k star）：Codex 额度监控、自动换号、邮箱注册、CPA/Sub2API 认证同步。
> 代表 sub2api 生态里的"号池运营自动化"环节。

## 项目卡片

| 项 | 值 |
|---|---|
| 仓库 | [cnitlrt/AutoTeam](https://github.com/cnitlrt/AutoTeam) |
| Star | ~1.2k |
| 语言 | Python |
| 协议 | MIT |
| 默认分支 | dev |

## 核心能力

- ChatGPT Team 账号自动轮转管理
- Codex 额度监控、自动换号
- 邮箱注册自动化
- CPA / Sub2API 认证同步
- 号池导入导出

## 对 RelayHub 的启发

1. **自动换号触发器**：额度阈值/失败次数触发换号 —— 对应普通中转站的"渠道熔断 + 自动切换"，思路通用。
2. **认证同步**：CPA ↔ Sub2API 格式互转是社区刚需，写插件时保留格式转换函数。
3. 号池运营类工具和网关核心解耦 —— RelayHub 可以把这类做成独立插件，不污染内核。

---

# 模块清单表

| 模块（源码路径） | 职责 | 关键文件 |
|---|---|---|
| `manager.py` | **核心管理器**：账号生命周期（添加/轮转/状态跟踪） | `manager.py` |
| `accounts.py` `account_ops.py` | 账号模型 + 操作（额度查询、状态更新） | `accounts.py` |
| `chatgpt_api.py` `chatgpt_transport.py` | **ChatGPT 官网协议调用**（Team 账号、Codex 授权） | `chatgpt_api.py` |
| `codex_auth.py` | Codex 授权（PAT/凭证生成） | `codex_auth.py` |
| `cpa_sync.py` `sub2api_sync.py` | **CPA / Sub2API 格式同步**（导出/导入） | `cpa_sync.py` |
| `auth_storage.py` | 账号凭证存储 | `auth_storage.py` |
| `invite.py` | Team 邀请码处理 | `invite.py` |
| `signup_profile.py` `cloudmail.py` `cloudflare_temp_email.py` | **邮箱注册自动化**（临时邮箱/Cloudflare 邮箱） | `signup_profile.py` |
| `playwright_probe.py` | 浏览器探测（验证码/风控） | `playwright_probe.py` |
| `api.py` `web/` | HTTP API / Web 管理界面 | `api.py` |
| `setup_wizard.py` | 首次配置向导 | `setup_wizard.py` |

## 请求数据流（文字版）

1. 管理界面/API 触发账号操作（添加账号 / 查询额度 / 换号）。
2. `manager` 选账号 → `chatgpt_api` 用账号凭证调官网接口（Team 额度、Codex 授权状态）。
3. 额度监控：低于阈值 → 触发换号（`account_ops` 轮转到下一个可用账号）。
4. 新账号注册：`signup_profile` + 邮箱模块自动注册 → `invite` 处理邀请 → 进号池。
5. 导出：`cpa_sync`/`sub2api_sync` 把号池转成 CPA/sub2api 格式文件，供 sub2api/chatgpt2api 导入使用。
