# DSH Model Gateway

`dsh-model-gateway` 是面向深极云算的多模型网关插件，支持 DSH 0.2 及以上（最低 `0.2.0-rc.2`）。它保留现有 `llm-deepseek-gateway` 配置 namespace，以便迁移后的 profile 继续使用已有配置。

插件支持深极云算 `/models` 返回的全部模型。已知的 DeepSeek、GPT、Claude、Grok 模型会带入官方上下文、输出上限、图片、推理、工具和 temperature 默认值；其他模型也可以添加，未知型号默认按文本模型处理。所有能力都能在模型编辑器中覆盖，实际网关能力以用户配置和服务响应为准。

每条网关路由都可以选择 `OpenAI Chat Completions`、`OpenAI Responses` 或 `Anthropic Messages`。Claude、GPT、Grok 只有在深极云算通过所选协议提供时才能使用；协议字段不会在请求间自动切换。

## 安装

在其他 DeepSeek Harness 桌面端的“设置 → 插件 → 添加插件”中输入：

```text
https://github.com/Charon0221/dsh-model-gateway#v0.4.1
```

也可以下载 [v0.4.1 安装包](https://github.com/Charon0221/dsh-model-gateway/releases/download/v0.4.1/dsh-model-gateway-0.4.1.tgz)，输入本地完整路径。安装后按桌面端提示重启，再到 Models 页配置深极云算凭据。

命令行安装：

```powershell
dsh plugin --profile web add github:Charon0221/dsh-model-gateway#v0.4.1
```

本地开发：

```powershell
npm install
npm run build
dsh plugin --profile web link D:\git\dsh-model-gateway
```

项目会在 Models 页检查新 Release（6 小时缓存），但 DSH 0.2 暂不支持已安装插件原地升级。更新时请按提示卸载旧版、安装新版本并重启；插件不会后台执行 pnpm 或修改 profile。

## 配置

点击“添加第三方 DeepSeek”或“添加模型网关”，填写深极云算 Base URL 和凭据引用。API Key 只通过 dsh 凭据服务或环境变量读取，不进入配置和日志。

```yaml
llm-deepseek-gateway:
  providers:
    senjix:
      displayName: 深极云算
      baseURL: https://senjix.cloud/v1
      protocol: chat-completions # 可选 responses 或 anthropic-messages
      apiKeyEnv: SENJIX_API_KEY
      models:
        - id: deepseek-v4.1-flash
          inputModalities: [text]
          reasoningEfforts: [off, low, high, max]
          defaultReasoningEffort: high
          supportsTools: true
          defaultTemperature: 1
          nativeSearch: none
          supportsWebSearch: true
      reasoningEffort: high
      webSearch:
        enabled: true
        allowGenericFallback: true
        maxUses: 5
        timeoutMs: 30000
```

模型发现调用 `GET {baseURL}/models`，会列出深极云算当前公布的全部模型。发现失败仍可使用“添加官方预设”或手工添加模型。模型能力不会因为上游目录声明而强制启用，图片能力必须由用户确认。

模型条目支持 `contextWindow`、`maxTokens`、`inputModalities`、`reasoningEfforts`、`defaultReasoningEffort`、`supportsTools`、`defaultTemperature`、`imagePixelBudget` 和 `imageMaxBytes`。用户字段优先于官方目录默认值，官方目录优先于上游容量字段，未知模型使用安全回退值。

## 网页搜索

DSH 的网页搜索 provider 与聊天模型是两个独立扩展点。使用本插件提供的网关搜索时，在 DSH 启动环境或 Web 设置中选择：

```text
DSH_WEB_SEARCH_PROVIDER=model-gateway-web
```

模型条目声明 `nativeSearch: openai-responses`、`openai-chat` 或 `anthropic-messages` 时，网关会优先透传对应的原生搜索能力，并解析返回的引用。`nativeSearch: none` 或未知模型使用网关的通用搜索配置。上游拒绝搜索参数时会明确报错，不会偷偷改成另一种协议或重复执行搜索。

如果仍看到 `DeepSeek API error (HTTP 402): Insufficient Balance`，说明 DSH 仍选择了官方 `deepseek-official` 搜索 provider；请检查上述 provider 选择和网关凭据，而不是把官方 DeepSeek 密钥写入本插件配置。

## 开发与验证

前端改动遵守 [FRONTEND_DEVELOPMENT.md](FRONTEND_DEVELOPMENT.md)。

```powershell
npm run typecheck
npm test
npm run build
npm pack
```

向新仓库推送匹配 `vMAJOR.MINOR.PATCH` 的 tag 会由 GitHub Actions 自动检查、测试、打包并创建 Release。详见 [VALIDATION.md](VALIDATION.md)。
