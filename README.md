# DSH Model Gateway

`dsh-model-gateway` 是面向深极云算的多模型网关插件，支持 DSH 0.2 及以上（最低 `0.2.0-rc.2`）。它保留现有 `llm-deepseek-gateway` 配置 namespace，以便迁移后的 profile 继续使用已有配置。

插件可发现和添加网关 `/models` 返回的模型。内置能力目录按厂商 API 文档维护（核对日期 2026-10-11），只匹配明确的官方 ID 与文档列出的别名。官方支持默认开启；不支持与未核实默认关闭，界面分别展示状态、来源和日期。手动设置可覆盖能力默认值，实际网关支持仍以上游响应为准。

每条网关路由都可以选择 `OpenAI Chat Completions`、`OpenAI Responses` 或 `Anthropic Messages`。Claude、GPT、Grok 只有在深极云算通过所选协议提供时才能使用；协议字段不会在请求间自动切换。

## 安装

在其他 DeepSeek Harness 桌面端的“设置 → 插件 → 添加插件”中输入：

```text
https://github.com/Charon0221/dsh-model-gateway#main
```

本次 0.5.0 仅更新仓库，未发布远程 Release。也可以运行 `npm pack` 后安装本地 `.tgz`；安装后重启，再到 Models 页配置。

命令行安装：

```powershell
dsh plugin --profile web add github:Charon0221/dsh-model-gateway#main
```

本地开发：

```powershell
npm install
npm run build
dsh plugin --profile web link D:\git\dsh-model-gateway
```

项目会在 Models 页检查新 Release（6 小时缓存），但 DSH 0.2 暂不支持已安装插件原地升级。更新时请按提示卸载旧版、安装新版本并重启；插件不会后台执行 pnpm 或修改 profile。

## 配置

点击“使用深极云算预填”或“添加模型网关”，填写深极云算 Base URL 和凭据引用。API Key 只通过 dsh 凭据服务或环境变量读取，不进入配置和日志。

```yaml
llm-deepseek-gateway:
  providers:
    senjix:
      displayName: 深极云算
      baseURL: https://senjix.cloud/v1
      protocol: chat-completions # 可选 responses 或 anthropic-messages
      apiKeyEnv: SENJIX_API_KEY
      models:
        - id: deepseek-flash
          inputModalities: [text, image]
          reasoningEfforts: [off, low, high, max]
          defaultReasoningEffort: high
          supportsTools: true
          defaultTemperature: 1
          nativeSearch: none
          supportsWebSearch: true
      reasoningEffort: high
      webSearch:
        enabled: false
        allowGenericFallback: true
        maxUses: 5
        timeoutMs: 30000
```

模型发现调用 `GET {baseURL}/models`，会列出深极云算当前公布的全部模型。发现失败仍可使用“添加官方预设”或手工添加模型。能力默认值仅来自内置官方目录；网关公布的未知型号不自动开启图片、工具、推理或搜索。官方 API ID `deepseek-flash` 支持图片和工具，1M 上下文与 384K 输出，内置网页搜索被官方 API 忽略，因此原生搜索关闭。`deepseek-v4.1-flash` 是未核实的网关 ID，不能因名称相似当作官方别名；需要手动设置。

模型条目支持 `contextWindow`、`maxTokens`、`inputModalities`、`reasoningEfforts`、`defaultReasoningEffort`、`supportsTools`、`defaultTemperature`、`imagePixelBudget` 和 `imageMaxBytes`。用户字段优先于官方目录默认值，官方目录优先于上游容量字段，未知模型使用安全回退值。

## 网页搜索

DSH 的网页搜索 provider 与聊天模型是两个独立扩展点。使用本插件提供的网关搜索时，在 DSH 启动环境或 Web 设置中选择：

```text
DSH_WEB_SEARCH_PROVIDER=model-gateway-web
```

模型条目声明 `nativeSearch: openai-responses`、`openai-chat` 或 `anthropic-messages` 时，聊天请求会将 DSH 的通用 `web_search` 工具替换为对应的服务端原生搜索能力；`web_fetch` 仍由 DSH 执行。原生搜索引用会作为“搜索来源”链接保留在回复中。搜索模式必须与网关协议匹配，`supportsWebSearch: false` 可关闭原生搜索。

Responses 默认使用服务端 `web_search` 类型；需要旧协议类型的上游可通过已有 `nativeSearchConfig.type` 显式覆盖。网关拒绝原生工具时直接报告错误，不自动尝试其他搜索提供方。

`webSearch.enabled` 只控制本插件注册的独立 `model-gateway-web` 搜索桥接，与模型级原生搜索是两个开关。设为 `false` 时，已声明的模型原生搜索仍可使用；无需更改官方通用搜索 provider。仅当需要让 DSH 通用搜索工具通过网关执行时，才启用桥接并显式选择 `model-gateway-web`。配置文件中的 `web.searchProvider` 优先于 `DSH_WEB_SEARCH_PROVIDER` 环境变量。

`nativeSearch: none` 且允许普通工具及网页搜索的模型继续使用 DSH 已选择的通用搜索 provider。关闭网页搜索只移除 `web_search`，保留 `web_fetch` 等已开启的普通工具。桥接仅接受已配置且协议匹配的原生搜索模型；旧字段 `allowGenericFallback` 保留兼容，但不再触发推测或备用搜索。原生搜索被拒绝、返回未声明的 `web_search` 函数或执行后没有可用来源时会明确报错，不会自动回退官方搜索或切换协议。模型支持搜索不代表第三方网关一定提供搜索；以上游响应为准。

如果已配置原生搜索仍看到官方 `DeepSeek API error (HTTP 402): Insufficient Balance`，请检查是否重启以加载新插件、模型搜索配置是否生效。安装或替换插件构建后必须重启桌面端；已运行的进程不会自动加载磁盘上的新代码。

## 开发与验证

前端改动遵守 [FRONTEND_DEVELOPMENT.md](FRONTEND_DEVELOPMENT.md)。

```powershell
npm run typecheck
npm test
npm run build
npm pack
```

向新仓库推送匹配 `vMAJOR.MINOR.PATCH` 的 tag 会由 GitHub Actions 自动检查、测试、打包并创建 Release。详见 [VALIDATION.md](VALIDATION.md)。

## 官方默认迁移与原生界面

首次加载 0.5.0 时先备份当前 profile patch，再通过 DSH Settings API 和 revision 恢复已有模型的官方能力默认值。地址、凭据引用、模型 ID、显示名、请求头、重试策略及其他非能力配置保留。内部标记与备份位于 profile 的 `.plugin-manager/migrations`，完成后重启不会再覆盖手动设置；只读配置等待可写。中断恢复不会重置后来发生的配置更改。

编辑器直接使用 DSH Button、Input、Checkbox、Switch、Menu、Modal、Tag 与图标；按连接与凭据、模型、搜索桥接分组。模型能力摘要默认展开可见，容量、推理及详细能力折叠展示，支持单模型和批量恢复官方默认。来源记录与协议矩阵仅为插件内部元数据，没有新增公共配置字段。

OpenAI 使用 `reasoning.effort` / `reasoning_effort`，关闭映射为 `none`（仅支持该档位的模型）；DeepSeek 使用各协议的兼容字段；Claude Opus 5.5 使用 adaptive thinking 和 `output_config.effort`。不再把 DeepSeek `thinking` 发给所有模型。内置协议矩阵不改变网关协议；支持 reasoning 的 GPT Chat 输出上限使用 `max_completion_tokens`，不支持的 temperature 与 stop 参数不发送。
