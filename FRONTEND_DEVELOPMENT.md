# 深桥前端开发规范

本规范适用于 `src/client` 下的 DSH 浏览器端代码。目标是让插件在 DSH 桌面端保持原生设置页的视觉、交互和安全边界。

## 设计令牌

- 优先使用 DSH CSS 变量，不在组件中写硬编码颜色、阴影、圆角或边框颜色。
- 文本使用 `--dsw-alias-label-primary`、`--dsw-alias-label-secondary`、`--dsw-alias-label-tertiary` 和 `--dsw-alias-label-dimmed`。
- 容器使用 `--dsw-alias-settings-card-fill`、`--dsw-alias-settings-card-stroke`、`--dsw-alias-bg-module-platform` 和 `--dsw-alias-bg-layer-1`。
- 交互使用 `--dsw-alias-interactive-bg-hover`、`--dsw-alias-interactive-bg-hover-danger`、`--dsw-alias-button-primary-fill` 和 `--dsw-alias-button-primary-hover`。
- 状态使用 `--dsw-alias-state-error-primary`、`--dsw-alias-state-success-primary`、`--dsw-alias-state-warn-label` 和 `--dsw-alias-state-business-primary`。
- 圆角使用 `--dsw-radius-sm/md/lg/xl`；控件尺寸和间距应接近 DSH 原生 Models 页面。
- 模型 ID、provider ID 等机器标识使用 `--ds-font-family-code`。
- 变量可能在未来 DSH 版本中缺失时，必须提供低风险 fallback；fallback 不得成为主视觉。

## 结构和布局

- Models 插件区域使用约 `720px` 的最大宽度、纵向分组和 8-14px 间距。
- 重复对象使用轻量卡片；页面本身不再套多层装饰卡片。
- 每个设置卡片按“标题/状态、字段、辅助说明、操作”组织。
- 常用字段放在首屏；容量、模型能力和发现结果放在明确的分组中。
- 桌面端优先两列字段布局，`560px` 以下自动变为单列。
- 输入、选择框和主按钮必须有稳定高度，加载或错误状态不能改变布局尺寸。
- 删除、移除和清除密钥等破坏性操作使用语义危险色，并提供确认步骤。

## 控件和交互

- 保留现有 provider、settings、credentials 和 slots 接口，不在客户端绕过 Remote API。
- 普通操作使用次级按钮；主要提交使用主按钮；低频辅助操作使用 quiet/link 按钮。
- 按钮文字保持动作明确，图标只用于已有熟悉符号的工具操作。
- 加载、成功、错误和不可用状态必须分别使用 `role="status"`、`role="alert"` 或可读的辅助文本。
- 表单保存必须继续使用 revision；设置提交成功而凭据提交失败时，只允许重试凭据阶段。
- 发现模型失败时必须保留手工添加路径；不能因为目录接口不可用而阻塞配置。
- 组件卸载时必须移除插槽注册、事件订阅和注入的 `<style>` 标签。

## 凭据和数据安全

- API Key 只通过 dsh 凭据 Remote API 或启动环境变量处理。
- API Key 不得进入 React state 以外的持久数据、配置展示、日志、错误信息、测试快照或截图。
- 设置表单不能覆盖未展示的 headers、重试策略或其他高级配置。
- 凭据状态只能显示“已配置/缺失”等布尔状态，不显示密钥内容。

## 可访问性和响应式

- 为每个输入提供可见 label 或 `aria-label`；保留现有中文语义和 `role`。
- 使用 `:focus-visible` 和 DSH focus token，不移除键盘焦点指示。
- 禁用态必须同时阻止操作并提供足够对比度；不能只依赖颜色表达状态。
- 窄屏下不能出现横向溢出、按钮文字截断或字段重叠。
- 尊重 `prefers-reduced-motion: reduce`，不添加非必要动画。

## 修改和验证流程

1. 先查看 DSH 0.2 原生 Models 页面 CSS 令牌和布局，再修改插件客户端。
2. 只编辑 `src/client` 和必要的客户端测试；不要为了视觉调整修改 Host、适配器或配置协议。
3. 至少运行 `npm run typecheck`、`npm test` 和 `npm run build`。
4. 使用隔离 DSH `0.2.0-rc.2` Web profile 检查添加、编辑、删除、凭据状态、模型发现、错误和窄屏布局。
5. 检查 bundle 卸载后没有残留 style、slot 或事件监听。
6. 提交前扫描源码、构建产物、测试输出和文档，确认没有 API Key 或其他凭据。

## 版本检查

- 更新检查只能读取本插件公开 GitHub Releases 的版本、发布页和安装 spec，不得上传网关地址、模型配置、凭据状态或 API Key。
- 检查必须有超时、有限缓存和失败静默降级；网络失败不能阻塞 Models 页或模型请求。
- 版本比较只接受明确的 `vMAJOR.MINOR.PATCH` 标签，不能把分支名或格式异常的响应当作更新。
- DSH 0.2 插件管理器不支持已安装包原地升级。客户端可以提示发布页和带版本标签的安装地址，但不得直接执行 pnpm、修改 profile 文件、删除当前 bundle 或自动重启 DSH。
