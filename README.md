# DSH Model Gateway

`dsh-model-gateway` 是面向深极云算的多模型 Chat Completions 网关插件，支持 DSH 0.2 及以上（最低 `0.2.0-rc.2`）。它保留现有 `llm-deepseek-gateway` 配置 namespace，以便迁移后的 profile 继续使用已有配置。

插件支持深极云算 `/models` 返回的全部模型。已知的 DeepSeek、GPT、Claude、Grok 模型会带入官方上下文、输出上限、图片、推理、工具和 temperature 默认值；其他模型也可以添加，未知型号默认按文本模型处理。所有能力都能在模型编辑器中覆盖，实际网关能力以用户配置和服务响应为准。

请求继续使用第三方 OpenAI/DeepSeek Chat Completions 兼容协议，不实现 Anthropic Messages 或其他原生协议转换。Claude、GPT、Grok 只有在深极云算通过兼容接口提供时才能使用。

## 安装

在其他 DeepSeek Harness 桌面端的“设置 → 插件 → 添加插件”中输入：

```text
https://github.com/Charon0221/dsh-model-gateway#v0.3.0
```

也可以下载 [v0.3.0 安装包](https://github.com/Charon0221/dsh-model-gateway/releases/download/v0.3.0/dsh-model-gateway-0.3.0.tgz)，输入本地完整路径。安装后按桌面端提示重启，再到 Models 页配置深极云算凭据。

命令行安装：

```powershell
dsh plugin --profile web add github:Charon0221/dsh-model-gateway#v0.3.0
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
      apiKeyEnv: SENJIX_API_KEY
      models:
        - id: deepseek-v4.1-flash
          inputModalities: [text]
          reasoningEfforts: [off, low, high, max]
          defaultReasoningEffort: high
          supportsTools: true
          defaultTemperature: 1
      reasoningEffort: high
```

模型发现调用 `GET {baseURL}/models`，会列出深极云算当前公布的全部模型。发现失败仍可使用“添加官方预设”或手工添加模型。模型能力不会因为上游目录声明而强制启用，图片能力必须由用户确认。

模型条目支持 `contextWindow`、`maxTokens`、`inputModalities`、`reasoningEfforts`、`defaultReasoningEffort`、`supportsTools`、`defaultTemperature`、`imagePixelBudget` 和 `imageMaxBytes`。用户字段优先于官方目录默认值，官方目录优先于上游容量字段，未知模型使用安全回退值。

## 开发与验证

前端改动遵守 [FRONTEND_DEVELOPMENT.md](FRONTEND_DEVELOPMENT.md)。

```powershell
npm run typecheck
npm test
npm run build
npm pack
```

向新仓库推送匹配 `vMAJOR.MINOR.PATCH` 的 tag 会由 GitHub Actions 自动检查、测试、打包并创建 Release。详见 [VALIDATION.md](VALIDATION.md)。
