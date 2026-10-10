# dsh-deepseek-gateway

第三方 DeepSeek Chat Completions 网关插件，兼容 dsh `0.1.5-rc.2`。它为每个网关注册独立的 LLM provider，同时保留官方 DeepSeek provider。

支持流式文本、`reasoning_content`、原生工具调用和工具结果连续对话；显式声明 `image` 的模型支持 dsh 附件转 data URL 图片输入。推理档位固定为 `off`、`low`、`high`、`max`，默认 `high`。插件只发送官方 Chat Completions 字段，网关拒绝字段时会返回明确错误。

## 安装

```powershell
npm install
npm run build
npm pack
dsh plugin --profile web add .\dsh-deepseek-gateway-0.1.0.tgz
```

也可以在 dsh Models 设置页通过插件安装对话框输入 GitHub 仓库地址或本地 `.tgz`。安装后重启对应 profile。插件不修改 dsh 源码。

## 配置

在 Models 页点击“添加第三方 DeepSeek”，或将 [examples/senjix.yml](examples/senjix.yml) 合并到 profile patch。API Key 只通过 dsh 凭据服务或启动环境变量读取；示例中的 `SENJIX_API_KEY` 是凭据引用，不是密钥。

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

## 开发与验证

```powershell
npm test
npm run typecheck
npm run build
```

真实网关验收需自行设置 `SENJIX_API_KEY` 后执行 `npm run test:live`；脚本不会输出或保存密钥。深极云算公开目录目前把目标模型标为文本，因此图片能力应保持未勾选，图片协议使用模拟网关或显式视觉模型验收。详见 [VALIDATION.md](VALIDATION.md)。

## 版本边界

插件固定以 dsh `0.1.5-rc.2` 的 Chat Completions 适配器为兼容基线。dsh 新版 Messages API 不会被插件自动混用；升级 dsh 后请重新运行协议和安装验收。

