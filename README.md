# @nathan-adk/dsh-rea-lazy

REA 在 DeepSeek Harness（DSH）里的**按需启动配置层** —— DSH 侧专用。让 REA 的 263 个工具保持可搜索，但 `rea` 进程平时不运行、不烧后台 token。

## 工作原理（v1.1.0 起自动探测）

插件激活时自动探测本机 REA，按以下优先级：

1. 环境变量 `REA_COMMAND` —— 手动指定完整命令（最高优先级）
2. PATH 上的 `rea` 命令（标准 `npm install -g rea-agents` 安装）
3. 本机 `rea-agents/scripts/rea.mjs`（用当前 Node 运行时启动）

探测到后把 REA 注册到 `@kirkchinese/dsh-capability-catalog`，配置：
- `catalogTtlMs`: 10 年 —— 目录缓存一旦生成就永不因陈旧而重新发现
- `idleDisconnectMs`: 5 分钟 —— 调用完空闲即断开
- `enabled: true` —— 工具留在目录里可搜索

**没有硬编码路径，任何电脑都能用。** 目录缓存由首次发现自动生成（会短暂启动一次 rea），之后不再自动启动。

## 沿用了哪些上游项目

本包是薄配置层，不改、不重新分发上游：

- [REA](https://github.com/morluto/rea) 的 `rea mcp` 标准输入输出接口（使用者自行安装 `rea-agents`）
- [`@kirkchinese/dsh-capability-catalog`](https://github.com/kirkchinese/dsh-capability-catalog) 的懒加载能力目录（search / describe / call）
- [`@kirkchinese/dsh-rea`](https://github.com/kirkchinese/dsh-capability-catalog) 整理的 14 个能力族与工具匹配规则（内联在引导插件中，源自其 MIT 授权的 `families.yml`）

上游项目均按其各自 MIT 许可授权，版权归各自作者。

## 对 REA 的影响 / 删除声明

- 不修改 REA 仓库、npm 包或运行时文件
- 不自动常驻：缓存命中后 `rea mcp` 只在真正 `capability_call` 工具时启动，空闲 5 分钟断开
- 缓存写在 DSH 数据目录（`$DSH_HOME/capability-catalog`），不碰 REA 安装目录
- 卸载本包只是移除这一行插件配置，可逆、无残留

**如果本包对 REA 或你的环境造成任何影响，或希望我们停止发布/删除相关内容，可直接联系 GitHub: Nathan-ADK，我们会立即配合处理或下架。**

## 安装

前置：先装能力目录 `@kirkchinese/dsh-capability-catalog`（本包依赖它的服务）。REA 可装可不装到 PATH —— 本包会自动探测；若探测不到，设 `REA_COMMAND` 即可。

```sh
dsh plugin add @nathan-adk/dsh-capability-catalog
dsh plugin add @nathan-adk/dsh-rea-lazy
# 可选：REA_COMMAND="node /path/to/rea.mjs mcp"
```

## 排障

- 目录里看不到 REA 工具 → 确认能力目录已装；若自动探测失败，设 `REA_COMMAND` 后重启 DSH。
- 首次使用会短暂启动一次 rea 建立目录缓存（属预期）；此后不再自动启动。

## 许可

MIT —— 仅覆盖本配置层；上游 REA 与能力目录归各自作者所有。
