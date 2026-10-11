# 验收记录

以下早期记录属于 0.4.1；0.5.0 验收记录见文末。开发与安装验收基线：DSH `0.2.0-rc.2`，Node 24。仅支持 0.2+。网关支持 OpenAI Chat Completions、OpenAI Responses 和 Anthropic Messages 三种协议，并支持网关原生搜索与 DSH `ctx.web` 搜索 provider。

本地自动化验收覆盖：

- 自动化测试覆盖：SSE UTF-8 分片、推理与文本交错、分片工具参数、多工具身份、工具结果图片、尾部 usage、空响应、异常 JSON、断流、取消、超时、鉴权/限流/额度/上下文/协议错误、配置动态增删与 revision 冲突、无效更新回滚、页面发现失败与手工模型保存、模型发现鉴权与去重。
- 33 项测试通过，包括三种协议的请求与流转换、原生搜索工具替换、网关 web provider 引用归一化、发布客户端的模块加载、插槽注册与卸载清理、设置 schema 跨 Remote JSON 恢复、请求头脱敏、动态模型发现和官方模型默认值覆盖。搜索回归覆盖 Responses 完整参数事件与最终快照、并行调用与去重、参数冲突/截断/异常终止、三协议来源链接、原生搜索失败和未声明搜索函数拦截，以及模拟 HTTP 工具结果续答。
- `npm run typecheck` 和 `npm run build` 通过。
- 浏览器产物使用 dsh `window.__ModuleLoader__` 入口，Host 产物为独立 ESM。
- 独立 `DSH_HOME` 下使用 DSH `0.2.0-rc.2` 执行 `dsh plugin --profile web add <tgz>` 成功，配置树加入插件，Web profile 启动成功，浏览器 Models 页出现第三方模型网关和官方模型预设入口。
- 页面真实保存深极云算预填配置成功，编辑表单出现；聊天模型选择器列出并可选择本网关的 `DeepSeek V4.1 Flash`，显示默认推理等级“高”。验收配置不写入 API Key。
- Models 页会自动读取公开 GitHub Releases 并按 6 小时缓存比较版本；新版本显示发布页和带标签安装地址，网络失败不影响配置和模型请求。由于 DSH 0.2 插件管理器当前不支持原地升级，未实现后台卸载、替换或重启。
- 模型原生搜索按 `nativeSearch` 透传，与独立搜索桥接 `webSearch.enabled` 分开；桥接关闭时原生搜索仍可使用。需要独立桥接时显式选择 `model-gateway-web`，已有 `web.searchProvider` 配置优先于环境变量。官方 `deepseek-official` provider 不会被插件自动覆盖；原生搜索失败不会回退官方搜索。
- UI 适配回归覆盖 DSH 原生设计令牌、卡片/编辑器/模型列表/发现区域的 DOM 结构、卸载清理和无硬编码颜色检查；客户端样式使用 `--dsw-alias-*`、`--dsw-radius-*` 和 `--ds-font-family-code`。
- 使用 DSH 自身兼容性检查函数验证：拒绝 `0.1.5-rc.2`，接受 `0.2.0-rc.2`、`0.2.0`、`0.2.1-alpha.1` 和 `0.3.0`。后两项仅验证安装范围，不代表已经实测未来运行时。
- 桌面端安装使用同一 bundle patch 和官方 `web` 客户端声明。GitHub 仓库提交 `lib` 构建产物，适合通过桌面端的 GitHub URL 输入框安装。另一台机器的桌面端安装尚未实机执行；当前验证覆盖本机相同 Web 渲染模块与隔离 profile。

真实验收脚本：

```powershell
$env:SENJIX_API_KEY = '<本地环境变量>'
npm run test:live
```

脚本测试 `off/low/high/max`、原生工具请求及工具结果续答；若本地运行时有 `sharp`，还会发送 64×64 红色图片。输出只包含脱敏摘要，不保存密钥。HTTP 成功或推理文本长度不能单独证明网关真正应用了推理档位；结果应结合网关实际返回和错误信息判断。

深极云算公开模型目录当前将 `deepseek-v4.1-flash` 标记为文本模型，因此预填配置不会声明图片能力。若真实请求拒绝图片或工具，插件保留文本能力并报告网关限制；图片序列化、工具分片和推理档位协议由本地模拟测试覆盖。

本次小样本真实验收（2026-10-10，目标模型 `deepseek-v4.1-flash`，在迁移 0.2 之前执行的同一 Chat Completions 线路；0.2 消息映射通过本地协议回归测试）结果：

- `off/low/high/max` 均完成流式文本，均返回 `323`；网关也在 `off` 请求中返回了 `reasoning_content`，因此不能把“请求字段被接受”解释为网关真正关闭推理。
- 原生 `lookup_secret` 工具调用完成，参数分片合并为 `{"label":"alpha"}`；提交工具结果后模型继续回答 `alpha = 7319`。
- 64×64 红色 PNG 通过内联 data URL 识别为“红色”。这证明本次目标服务实际接受图片，配置仍要求用户显式声明图片能力，避免目录信息自动赋能。


原生搜索修复验收（2026-10-11，本地构建，未发布新版本）：

- `senjix/gpt-6.1-sol`，端点 `https://senjix.cloud/v1/responses`，HTTP 200。请求只包含本地 `web_fetch` 和服务端 `web_search_preview`，没有本地 `web_search` 函数。
- 上游返回 4 组 `response.web_search_call.in_progress/searching/completed`，并返回引用事件；解析后的最终回复包含去重的搜索来源链接，正常以 `stop` 结束。未调用官方 DeepSeek 搜索。
- 本次真实搜索未触发本地抓取，因此完整 `url` 的保留另由模拟 SSE 与真实本地 HTTP 对话回归验证。验收只证明该网关当次提供原生搜索和引用，不保证上游新闻内容准确。
- 脱敏验收摘要保存在忽略目录 `test-results/native-search-live.json`，不包含凭据。
- 已备份 desktop profile 原安装目录到 `C:/Users/Administrator/.dsh/profiles/desktop/.plugin-manager/backups/native-search-20261011/dsh-model-gateway`，将修复产物安装到该 profile 的 `node_modules/dsh-model-gateway/lib`。仓库与安装目录的 `index.js` SHA256 一致：`049921539952A93376EE6BD0ACA5AC53028E8BACADEFB61401568B7AC5E921D5`。
- 桌面端无生成任务时完成重启，`E:/DSH/DeepSeek Harness.exe` 新进程启动时间为 2026-10-11 15:23:31。新建会话的模型选择器已确认服务商显示“深极云算”，当前选择 `gpt-6.1-sol`，未更换地址或凭据。
- 初次桌面自动化受输入焦点问题影响；后续已完成桌面请求与用户手动验收，结果如下。

桌面真实验收补充（2026-10-11，深极云算 `gpt-6.1-sol`）：

- 桌面真实请求和最小接口对照均发现上游当前拒绝 `web_search_preview`，返回 HTTP 400 `Unsupported tool type: web_search_preview`；此前成功记录仅代表此前那次请求。改用服务端 `web_search` 后最小接口对照返回 HTTP 200，包含 `response.web_search_call.in_progress/searching/completed` 与引用事件，正常以 `stop` 结束。脱敏对照记录为 `test-results/native-search-recheck.json`。
- Responses 默认原生工具已改为 `web_search`，已有 `nativeSearchConfig.type` 仍可显式覆盖。重新构建、33 项测试、类型检查通过，并备份替换 desktop profile 的产物，重启桌面端。最终仓库与安装目录 `index.js` SHA256 一致：`03D35256D9FF598F385265A8D7CBBA329FC1225E7FA0E6C0895A5D755F9BB772`。
- 用户提供的桌面截图显示 15:44 搜索轮次已完成，回答 Node.js 版本并显示独立“搜索来源”链接。上方 HTTP 400 为历史失败轮次；成功轮次证明桌面已加载修复后的实现并显示来源。
- 用户随后手动请求抓取 `https://nodejs.org/en/download/current`。15:46:01 的轨迹截图显示单次 `web_fetch` 参数保留完整 URL，状态“已完成”，结果 `Fetched https://nodejs.org/en/download/current (HTTP 200)`，包含网页正文；随后助手根据工具结果回答 `Node.js — Download Node.js®`。未出现 `INVALID_ARGS`，真实抓取与工具结果续答通过。
- 用户补充的 DeepSeek V4.1 Flash 桌面轨迹显示两次 `web_fetch` 均携带完整 URL，返回 HTTP 200，随后模型根据工具结果续答。该记录验证网页抓取与工具续答；这轮没有原生搜索执行证据，因此不声明已验证该模型的原生搜索。
- 本机已验证深极云算 `gpt-6.1-sol` 原生搜索、来源显示，以及 GPT 和 DeepSeek V4.1 Flash 的完整抓取参数和工具结果续答。其他协议由模拟回归覆盖；未对其他上游或模型的原生搜索进行真实验收。

## 0.5.0 能力目录与原生控件验收（2026-10-11）

- 官方 API 文档已核对：DeepSeek pricing/vision/thinking/Responses；OpenAI 当前精确模型页和 reasoning/web-search；Anthropic overview/thinking/effort/web-search；xAI Grok 4.7 和 Responses 搜索。目录随版本维护，不运行网站抓取，不按名字前缀赋能。未能核实的旧型号和网关别名保持“未核实”。
- `deepseek-flash` 及官方明示的旧别名支持图片、工具、1M/384K；`deepseek-v4.1-flash` 不在官方接受 ID 列表中，保持未核实。实测网关能力可作为手动覆盖证据，不能把它宣传为官网能力声明。
- 40 项测试通过：新增精确型号/别名/未知默认关闭、协议限制、手动覆盖、关闭搜索保留 fetch、厂商参数映射、备份/revision/只读/重复迁移/中断恢复；真实 DSH atoms 的 Menu 键盘选择、恢复默认、保存冲突与桥接独立开关均验证。保留三协议搜索引用、工具完整参数、HTTP 工具续聊回归。类型检查与构建通过。
- desktop profile 安装包及配置备份：`.plugin-manager/backups/20261011-capabilities-v050`。通过本地 Settings API + revision 完成模型字段写入，内部迁移标记与完整 patch 备份位于 `.plugin-manager/migrations`。迁移没有修改网关地址、密钥或模型 ID。
- 实机发现 npm 自动安装 peer 会产生第二份 DSH runtime，让 ConfigEditor 丢失 root Include；已把此次新增 runtime peer 移到备份中，恢复使用桌面端共享 runtime。插件产物采用外部共享依赖。没有修改 DSH 核心。
- 真实接口：沿用 desktop 的 `https://senjix.cloud/v1/responses` 和原凭据。官方 `deepseek-flash`、`gpt-6.1-sol`、`grok-4.7` 均返回 HTTP 503：当前“国模分组×0.3”无可用渠道。原生搜索请求已发送服务端 `web_search`，但上游拒绝，因此本次不能宣称 GPT/Grok 搜索成功；没有执行官方搜索。
- 对 `deepseek-v4.1-flash` 做临时手动能力覆盖的接口探测（不改持久配置）：HTTP 200，工具调用 `lookup_secret` 参数完整为 `{"label":"alpha"}`；传回 `alpha=7319` 后续答包含 7319；64×64 红色 PNG 识别为“红色”。该网关别名的图片和工具当次可用，原生搜索仍没有官方依据。脱敏记录保存在忽略目录 `test-results/capability-live.json` 和 `capability-official-live.json`。
- 桌面端重启并加载构建后，迁移标记已确认完成。用户按 Escape 中止了 Windows 自动化；已停止 UI 操作，原生组件视觉、真实页面发现/保存、浅深色与窄屏实机验收仍待用户手动完成，不能把 jsdom 的键盘测试当成这部分实机验收。
- 本次仅推送现有 GitHub 仓库，不创建 tag 或远程 Release。

最终安装构建 `index.js` 与仓库 SHA256 相同：`58D2824C6109380EC8630F4ECA3ABB8D7393B37CB178F2A99901113163F982A2`；`client.js` 相同：`BEA45B54D340F200B482BF00568A398353F423C8EB1BD2CE58E4055166C54E32`。单模型恢复默认已回归确认清除旧高级能力字段，并保留显示名和说明。最终桌面进程启动时间 2026-10-11 18:01:41；迁移标记完成。重启后未再次改写模型能力。

待完成的手动验收：在“设置 → 模型”编辑深极云算，检查模型发现、展开能力设置、官方来源链接、单模型/批量恢复默认与保存；用键盘选择协议，并在浅色、深色和窄窗口检查布局。若要继续使用当前 `deepseek-v4.1-flash` 网关别名，请手动开启图片输入与工具调用，保存后开新会话上传红色图片并执行一次带完整 URL 的网页抓取。GPT/Grok 原生搜索需要当前分组恢复可用渠道后再验证实际搜索事件和来源；HTTP 503 不能视为通过。
