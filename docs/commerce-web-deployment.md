# 网页真实平台共逛

## 已实现的链路

商城和一起吃的现有平台入口，在网页环境使用 `WebCommerceWorkspace.vue`，Android/iOS 的原生 `CommerceWorkspace` 保持原行为。

网页连接独立共逛服务 → 可信服务账号登录 → 独立平台浏览器 → 用户操作真实平台 → 读取非私密页面 → 角色比较并提出受权限约束的操作建议 → 用户执行建议 → 共同候选、愿望、比较、分享 → 单笔平台订单页面记录。

页面是真实浏览器截图，通过短轮询传输，支持点击、触控滑动、滚动、中文输入、全选、删除、回车和平台 JavaScript 提示框。语音输入复用原聊天真实音视频配置与录音/转写服务，转写后由用户核对发送，不直接购买。不是 iframe，不继承用户本地 Chrome/Edge 登录，不启动或改动本地 Vite。

目前连接方式是浏览器；四个平台的实际登录、结算和网页支付能力均必须使用指定账号逐项验证。角色只接收脱敏商品文字和结构化商品信息，不接收截图、密码、验证码、地址或 Cookie。当前订单来源是页面读取，支付状态保持未知，不冒充接口核验。搜索、规格和加购建议只有点击后才执行，提交订单和支付由用户直接在真实平台操作。

## 部署

部署包：`commerce-gateway/`、`docker-compose.commerce.yml`、`deployment/Caddyfile.commerce`。需要 Node、Playwright Chromium、PostgreSQL，以及 HTTPS 反向代理。Docker 使用 Playwright 官方镜像，版本与包锁定一致，以非 root 用户运行并开启 Chromium sandbox；宿主机必须支持其 sandbox，不允许用关闭 sandbox 作为运行办法。

1. 在服务器上复制 `commerce-gateway/.env.example` 为 `.env`，配置数据库 URL。
2. 使用 `npm run password` 生成服务口令哈希，写入 `COMMERCE_USERS`。不要使用平台购物密码，口令至少12个字符。
3. 生成32字节随机密钥（base64）配置 `COMMERCE_ENCRYPTION_KEY`。数据库所有记录、浏览器登录状态和操作结果以 AES-256-GCM 加密；密钥应通过部署系统的秘密管理保存，轮换需迁移加密数据。
4. `COMMERCE_ALLOWED_ORIGINS` 填实际粘人精网页来源，如 `https://your-site.example`。只能列出信任来源，不支持 `*`。
5. 按 [Playwright Docker 指引](https://playwright.dev/docs/docker)下载其[官方 seccomp 配置](https://github.com/microsoft/playwright/blob/main/utils/docker/seccomp_profile.json)到部署主机，设置 `COMMERCE_SECCOMP_PROFILE` 为绝对路径。该配置用于非 root Chromium sandbox，不用 `privileged`、`seccomp=unconfined` 或关闭 sandbox 代替。部署主机设置 `COMMERCE_DB_PASSWORD`，与 `.env` 内 DATABASE_URL 的密码一致；由部署人员执行 `docker compose -f docker-compose.commerce.yml up -d --build`。
6. 反向代理让 `/commerce-api/*` 指向服务，并保留 Origin、Cookie 和响应头。建议与前端同源。代理必须使用 HTTPS；不要把公网端口直接指向未加密的 Node HTTP。
7. 页面连接设置默认 `/commerce-api`，也可填写已部署服务的 HTTPS 地址。连接口令和 CSRF 令牌不写 localStorage。

若前端仍在 Netlify，可将 `/commerce-api/*` 代理到后台 HTTPS 域名（按自己的部署域名配置 Netlify），无需替换现有 music functions 或修改既有路由。不能直接把 Playwright 进程放进短时 serverless function。

跨站直连需显式设置 `COMMERCE_COOKIE_SAMESITE=None`，Origin 白名单与 CORS 完整配置；浏览器可能阻止第三方 Cookie。网页会在登录后检查 Cookie 可用性，失败则提示，不使用 localStorage bearer token 绕开。优先同源代理。

本地开发由用户自行运行所需服务；客户端可连接信任的 HTTPS 服务或 localhost 地址。仅新增连接入口，没有新增 Vite 插件、测试路由或自动启动逻辑。

## 账号与隔离

服务用户名通过服务器预配置，与本地聊天账号 ID 不同。服务 Cookie 是 HttpOnly、Secure，写操作同时要求 Origin 白名单、客户端头和内存 CSRF。账号切换关闭网页共逛并退出服务，未绑定的新本地账号不会自动继承另一个账号的连接。

角色切换只切换本地对话、偏好和服务器共同清单筛选，不创建新的平台浏览器；角色权限重置为陪我看。真实平台登录按服务用户和平台隔离。每个用户、平台同时最多一条活动浏览器连接，用 PostgreSQL advisory lock 防止跨实例同时操作；当前部署保持一个 gateway replica，会话不能无状态迁移到另一个实例。

平台登录持久化需用户明确勾选。平台凭据只在服务器浏览器和加密数据库中。清除当前平台登录会删除该平台保存状态；不宣称退出官方所有设备。浏览器无用户 profile 复用，无项目目录 Cookie/profile 文件。

## 操作和交易边界

用户平台操作使用画面标识、时效和页面修订检查，动作开始即消费标识。角色操作使用后台最后一次观察的 token、目标元素、实际标签、遮挡和权限检查。角色无任意脚本、任意 URL 或购买提交权限。

每个动作有唯一 requestId，执行前写 PostgreSQL。结果丢失/超时记为 unknown，重复同一标识不重放；已完成结果可以读取。页面点击只记录为尝试，不等于已加购、付款或创建订单。用户确认下单与付款是在平台界面进行。程序不自动点击/重试购买、不接受聊天输出的已付款声明。

页面解析只能识别支持的详情结构，读取失败保持未知。共同清单不自动改平台购物车；数量和愿望状态只影响候选。跨平台候选估算不含未识别价格、优惠与运费，结算分别在原平台完成。

订单读取要求订单详情 URL 和唯一明确订单号，记录来源 page-observation，付款状态 unknown。不会用商品页、多个订单列表或一般价格文本证明支付成功。页面结构或平台支付限制变化需人工验证。

## 网络和运行

平台顶层导航限 HTTPS 官方域名，子资源必须解析到公网地址；拒绝私网/loopback、下载、任意端口和任意用户 URL。WebSocket 同样经过检查。部署宿主机还必须设置出站网络限制，屏蔽私网/云元数据，防止 DNS 重绑定等网络层问题。域名跳转未支持时明确停止，不伪装设备或绕过平台验证。

默认最多8条活动会话，15分钟没有实际浏览操作/读取自动释放。数据库租约丢失时关闭对应浏览器。服务退出只关闭自己的浏览器。闲置后台轮询不会录像，不记录操作正文。错误日志只有事件ID和错误类别，不含请求、平台URL、凭据或个人数据。

长期记录默认按最近200条返回；备份数据库需同时保护密钥与访问权限。用户导出接口只返回候选及订单记录，不包含登录状态、数据库凭据和服务 Cookie。普通粘人精备份仍保存原偏好、对话、页面摘要，不新增平台凭据。

## 需要外部条件或尚未实现的方案内容

- 美团消费者 OAuth、商品、预览、订单接口，京东交易合作：需要获批应用、真实接口权限和对应文档契约；当前不虚构接口适配或把 OAuth 当浏览器登录。官方接口确认、结算金额核验、付款/履约查询仍未接通。
- 四个平台真实账号的完整登录/规格/加购/结算/支付验证；出现必须打开APP的流程不能算纯网页通过。
- 页面商品解析根据明确选择器提取，暂不覆盖外卖菜单逐菜品结构或所有平台页面变体。保留页面讨论和摘要入口。
- 自动物流/降价/到货通知、多人实时共享、远程画面 WebRTC 编码：本次未接通，不展示假通知或假权限按钮。
- PostgreSQL 与 HTTPS 服务需要实际部署。没有部署信息和平台授权，代码交付不等于公网可用或真实交易验收完成。

## 检查

`node --test commerce-gateway/test/*.test.mjs` 检查后台策略、用户隔离、权限、加密和不重放；`npx tsx scripts/test-commerce-web.ts` 检查网页客户端、账号连接与原生入口保留；原有 commerce/mall 专项测试检查原行为。

真实用户验收使用用户指定账号与购买授权，在独立会话中分别覆盖320/375/390px、平台切换、角色切换、直接操作、输入/滑动、角色建议、清单、退出、登录过期和支付取消/超时。不得使用假平台数据报告真实支付通过。
