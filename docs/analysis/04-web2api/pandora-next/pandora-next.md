# pandora-next（已下架，仅存档）

> **"网页转 API"赛道的祖师爷**：把 ChatGPT 网页版逆向成 API 的开创者，一度 20k+ star。
> 2024 年被 GitHub 封禁下架（违反 ToS），后续项目（如 gpt4free、sub2api）都受它启发。

## 项目卡片

| 项 | 值 |
|---|---|
| 仓库 | [pandora-next/deploy](https://github.com/pandora-next/deploy)（已禁用） |
| 状态 | ❌ 已被 GitHub 下架 |
| 历史 star | ~20k+ |
| 语言 | Go |
| 历史意义 | 网页转 API 逆向路线的开创者 |

## 为什么记录它

1. **逆向类目的生命周期警示**：pandora-next 被封 → gpt4free 多次被 DMCA → sub2api 现在也处于灰区。**RelayHub 只做学习参考，不做逆向能力**。
2. **架构遗产**：它的"守护进程 + Web 面板 + 账号池"结构被后来的项目继承。
3. 想研究它的源码需要从互联网档案馆或 fork 找，GitHub 官方已不可达。

## 对 RelayHub 的启发

1. **认清边界**：逆向类项目的法律/ToS 风险是结构性的，不适合作为长期依赖。
2. **学到的东西要抽象成通用能力**：账号池调度、多入口协议、鉴权管理这些概念与渠道管理同构，可以安全地用在 RelayHub 的插件设计里。
