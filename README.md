# @nathan-adk/dsh-rea-lazy v2.0.0

自包含的 REA 按需能力层 —— **DeepSeek Harness 专用，单包即可，无需第三方 capability-catalog**。

## 核心（全部自研，不依赖第三方）
- **紧凑索引**：263 个 REA 工具不进系统提示词，只留约 1.8KB 的族索引（族名+数量+代表名）。对比全量 670KB schema，省 token 显著。
- **3 个元工具**：`capability_search` / `capability_describe` / `capability_call`。schema 只在 describe 时按需进上下文。
- **磁盘缓存**：工具清单缓存到 `$DSH_HOME/capability-catalog/mcp-rea.json`，缓存命中时**不启动 REA**。
- **按需 spawn**：只有真正 `capability_call` 时才连接 REA；空闲 5 分钟自动断开。零后台进程、零后台 token。
- **每日更新检查**：每 24 小时用 HTTP 元数据查询 npm 上 `rea-agents` 的最新版本（不启动 REA、不耗 token、不进上下文），发现新版本写标记并提示。工具清单的真正刷新由用户主动触发（`ctx.reaRefresh()`），保持"无需求不启动"。

## 与上游 REA 的关系
沿用 REA（https://github.com/morluto/rea）的 `rea mcp` 标准接口与 14 个能力族规则（源自上游 MIT families.yml）。不修改、不重新分发 REA。若造成影响可联系 GitHub: Nathan-ADK 删除/下架。

## 安装
```sh
dsh plugin add @nathan-adk/dsh-rea-lazy
# 可选：REA_COMMAND="node /path/to/rea.mjs mcp" 环境变量覆盖自动探测
```
自动探测顺序：REA_COMMAND → PATH 上的 rea → 本机 rea-agents/scripts/rea.mjs。

## 配置
```yaml
- id: dsh-rea-lazy
  name: '@nathan-adk/dsh-rea-lazy'
  config:
    idleDisconnectMs: 300000
    checkIntervalMs: 86400000   # 0 = 关闭每日检查
```

## 升级说明（从 v1.x）
v1.x 依赖第三方 `@kirkchinese/dsh-capability-catalog`；v2.0.0 已内置核心，请先移除第三方包再装本版，避免两套元工具冲突。

## 许可
MIT —— 仅覆盖本包；REA 与相关上游归各自作者所有。
