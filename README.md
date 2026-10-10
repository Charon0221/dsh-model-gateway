# DeepSeek Gateway（深桥）

第三方 DeepSeek Chat Completions 网关插件，npm 包名 `dsh-deepseek-gateway`，支持 **DSH 0.2 及以上**（最低 `0.2.0-rc.2`）。它为每个网关注册独立的 LLM provider，同时保留官方 DeepSeek provider。

支持流式文本、`reasoning_content`、原生工具调用和工具结果连续对话；显式声明 `image` 的模型支持 dsh 附件转 data URL 图片输入。推理档位固定为 `off`、`low`、`high`、`max`，默认 `high`。插件只发送官方 Chat Completions 字段，网关拒绝字段时会返回明确错误。

## 安装

```powershell
npm install
npm run build
npm pack
dsh plugin --profile web add .\dsh-deepseek-gateway-0.2.0.tgz
```

**其他电脑的 DeepSeek Harness 桌面端：** 在“设置 → 插件 → 添加插件”的输入框粘贴：

```text
https://github.com/Charon0221/dsh-deepseek-gateway#v0.2.0
```

仓库包含构建产物，无需在目标电脑上编译 TypeScript。也可以下载 [v0.2.0 安装包](https://github.com/Charon0221/dsh-deepseek-gateway/releases/download/v0.2.0/dsh-deepseek-gateway-0.2.0.tgz)，输入该文件的本地完整路径。安装后按桌面端提示重启，再到 Models 页添加第三方网关；每台电脑单独配置凭据。插件声明 `platform: web` 与官方 Models UI 一致，供桌面端的 Web 渲染页面加载。不修改 dsh 源码。

如旧版安装失败，请移除旧版后使用上面的 **v0.2.0 标签地址**重新安装；不要授予版本检查豁免。旧版 v0.1.0 面向 DSH 0.1，不能安装在 0.2 桌面端。

本地开发链接：先 `npm run build`，再运行 `dsh plugin --profile web link D:\git\dsh-deepseek-gateway`。更新源码后重新构建并重启 profile。公开 GitHub 仓库包含 Host 和浏览器入口，安装命令也可使用：

```powershell
dsh plugin --profile web add github:Charon0221/dsh-deepseek-gateway#v0.2.0
```

## 配置

在 Models 页点击“添加第三方 DeepSeek”，页面通过 DSH 0.2 配置编辑服务保存到当前 profile 的 patch。[examples/senjix.yml](examples/senjix.yml) 是字段说明，不能直接作为启动 patch。启动时使用 [examples/senjix.patch.yml](examples/senjix.patch.yml)，例如 `dsh --profile web --patch D:\git\dsh-deepseek-gateway\examples\senjix.patch.yml`。API Key 只通过 dsh 凭据服务或启动环境变量读取；示例中的 `SENJIX_API_KEY` 是凭据引用，不是密钥。

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
      reasoningEffort: high
```

模型列表发现调用 `GET {baseURL}/models`；发现失败仍可手工填写。模型能力不会由目录自动推断，图片能力必须在模型条目中勾选 `inputModalities: [text, image]`。第一版不支持音频、视频、OCR、图像生成或 Files API。

配置在下一次请求生效，进行中的调用保留端点、凭据和能力快照。无效外部更新保留最后有效配置。默认上下文容量为 262144，输出上限 32768，内联图片累计上限 20 MiB。

| 配置字段 | 默认值 / 用途 |
| --- | --- |
| `displayName` | 提供方 ID |
| `baseURL` | 必填，API 根地址，插件拼接 `/chat/completions` 与 `/models` |
| `apiKeyEnv` | 提供方 ID 大写、连字符转下划线后加 `_API_KEY` |
| `headers` | 额外请求头，禁止覆盖鉴权及协议字段，设置描述中脱敏 |
| `models` | 必填，至少一个模型；`id`、`name`、`description`、`contextWindow`、`maxTokens`、`inputModalities` |
| `reasoningEffort` | `high`；`off` 发送禁用 thinking 且省略 effort，其他值启用 thinking |
| `defaultContextWindow` / `maxTokens` | 262144 / 32768；可在模型条目覆盖；是回退值，须按服务商真实容量填写 |
| `streamIdleTimeoutMs` | 300000，连接、附件准备及 SSE 无活动超时；注释心跳重置超时 |
| `maxInlineRequestImageBytes` | 20971520，按 base64 大小计算，超限按最旧图片先移除 |
| `maxImagesPerRequest` | 600 |
| 模型 `imagePixelBudget` / `imageMaxBytes` | 640000 像素 / 1048576 字节，`low` 表示 512×512 像素 |
| `retryPolicy` | dsh 默认 normal 策略；可设 `mode: normal`、`maxRetries`、`retryableCodes` 和 `backoff` |

图片超限时返回 DSH 0.2 标准 `IMAGE_OFFLOAD_REQUIRED`，由 dsh 压缩流程将最旧图片标记为卸载后重试。附件保留，后续请求将已卸载图片表示为可读占位符。工具结果截图按官方规则附在后续用户消息中，原工具结果仍使用 `tool_call_id` 关联。工具执行、权限审批与 MCP 接入由 dsh 管理。默认重试交给 dsh `llm-retry` 插件，适配器自身不偷偷重发。

页面保存使用 revision 防并发覆盖；配置写入成功而密钥失败时，只重试密钥写入。编辑表单只修改已展示字段，保留额外头及重试设置。删除网关保留凭据；可在网关编辑器中单独删除可写凭据，环境变量凭据需从启动环境移除。

## 开发与验证

```powershell
npm test
npm run typecheck
npm run build
```

真实网关验收需自行设置 `SENJIX_API_KEY` 后执行 `npm run test:live`；脚本不会输出或保存密钥。深极云算公开目录目前把目标模型标为文本，因此图片能力应保持未勾选，图片协议使用模拟网关或显式视觉模型验收。详见 [VALIDATION.md](VALIDATION.md)。

## 版本边界

插件以 DSH `0.2.0-rc.2` 的设置、附件和工具消息接口为开发与验收基线，声明接受后续 0.2+ 版本，拒绝 0.1。未来 DSH 若再次引入不兼容接口，仍需适配和重新验收，版本范围不等于已实测所有未来版本。插件对第三方始终使用 Chat Completions；DSH 官方模型的 Messages API 不会被混入第三方请求。

