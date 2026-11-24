# @nathan-adk/dsh-rea-lazy

REA 在 DeepSeek Harness（DSH）里的**按需启动配置层** —— DSH 侧专用，目标是消除 REA 常驻进程、节省后台 token。

## 这是什么（DSH 侧解决的问题）

REA 是一个功能强大的逆向工程 MCP 工具集（263 个工具）。把它以常规 MCP 方式接入 DSH，会带来两个问题：

1. **常驻烧 token**：263 个工具的完整 schema（约 670 KB）会在每轮请求都进入系统提示词。
2. **进程常驻**：MCP 客户端可能在启动时就拉起 `rea` 进程，即使你根本没做逆向任务。

本包解决的正是这两个问题：它沿用 DSH 生态已有的**能力目录（capability catalog）**机制，把 REA 的 263 个工具变成可搜索的紧凑索引，并保证 `rea` 进程**只在你真正调用某个 REA 工具时才启动**，空闲 5 分钟自动断开。平时：没有 rea 进程、没有额外 token 消耗。

## 沿用了 REA 的哪些东西

本包是**纯配置层（configuration-only bundle）**，不含任何 REA 代码，不修改、不重新分发 REA：

- 沿用上游 [REA](https://github.com/morluto/rea) 的 `rea mcp` 标准输入输出接口（由使用者自行安装 `rea-agents`）。
- 沿用上游 [`@kirkchinese/dsh-capability-catalog`](https://github.com/kirkchinese/dsh-capability-catalog) 的懒加载能力目录（search / describe / call 三个元工具）。
- 沿用上游 [`@kirkchinese/dsh-rea`](https://github.com/kirkchinese/dsh-capability-catalog) 整理的 14 个能力族与工具匹配规则（本包的 `cordis.patch.yml` 中完整重述了这些族配置，便于独立安装；这些规则源自上游的 MIT 授权文件 `families.yml`）。
- 随包附带一份由 REA `tools/list` 生成的工具目录缓存（`catalog/mcp-rea.json`，263 个工具），使启动与空闲期间都无需连接 REA 服务。

上述上游项目均按其各自的 MIT 许可证授权，版权归各自作者所有。

## 对 REA 造成了什么影响

- **无代码修改**：不对 REA 仓库、npm 包或运行时文件做任何改动。
- **无侵入启动**：本包配置的 `rea` 服务在缓存命中且 TTL（10 年）未过期时不会被自动拉起；只有在 DSH 中真正 `capability_call` 某个 REA 工具时才启动，空闲 5 分钟自动断开。
- **独立数据**：工具目录缓存写在你机器的 DSH 数据目录（`$DSH_HOME/capability-catalog`），不写入 REA 安装目录。
- **可逆**：卸载本包只是移除这一行插件配置，不影响 REA 本身或你已有的任何数据。

**如果本包对 REA 或你的环境造成了任何影响，或者你希望我们停止发布、删除相关内容，可以直接联系我们（GitHub: Nathan-ADK），我们会立即配合处理/下架。**

## 安装

前置条件：
1. 已安装 DSH 的能力目录包：`@kirkchinese/dsh-capability-catalog`（本包依赖它）。
2. REA 可执行文件 `rea` 在你的 PATH 上（例如 `npm install -g rea-agents`）。
3. 安装本包后，**首次使用前请先让能力目录完成一次 REA 工具发现**（详见下文「首次发现」）。

```sh
dsh plugin add @nathan-adk/dsh-capability-catalog
dsh plugin add @nathan-adk/dsh-rea-lazy
```

## 首次发现（一次性）

为了让 `rea` 工具出现在能力目录里，需要生成一次与本机 `rea` 命令匹配的缓存。本包内置的缓存以 `rea mcp` 为启动身份；如果你的 `rea` 命令解析结果不同，首次搜索不到 REA 工具时，在 DSH 中触发一次能力目录的重新发现（discovery），它会自动生成匹配本机的缓存，此后不再需要。

## 工作方式

- 常驻工具只有 3 个目录元工具：`capability_search` / `capability_describe` / `capability_call`。
- 263 个 REA 工具不注册为原生工具，只在目录里有紧凑索引（族名 + 工具名 + 参数大小）。
- 工具 schema 只有在 `capability_describe` 之后才进入上下文。
- 调用链固定 search → describe → call，一次只调一项，不会一次性挂载全部工具。

## 卸载

在 DSH 插件管理里移除 `@nathan-adk/dsh-rea-lazy` 即可。如需彻底清理缓存，可删除 `$DSH_HOME/capability-catalog/mcp-rea.json`。

## 许可

MIT —— 仅覆盖本配置包本身；上游 REA 与能力目录项目归各自作者所有并遵循各自 MIT 许可。
