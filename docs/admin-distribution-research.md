# 内容分发调研与 M2–M4 方案

调研日期：2026-11-09。以下按调研时仓库默认分支的固定提交记录，阅读数据结构和工作流实现。松屿 M1 的 UI、TypeScript、SQL、测试均为本仓库独立实现，没有拷贝第三方源码、UI、图片或引入这些项目的运行依赖。

## 五个项目的结论

| 项目 / 固定提交 | 许可证 | 已核对的实现 | 对松屿的启发与边界 |
| --- | --- | --- | --- |
| Postiz `4b7b9901abfcd81c88dc3534fb0a9540af8e0bd3` | AGPL v3 | Integration、Post、关联分组及发布状态；平台抽象 | 账号、内容、任务应分层。仅研究模型思想，未引入 AGPL 源码 |
| AiToEarn `5723de436173a92e5c17989a4032cd9a7b2b1d27` | MIT | 账号 schema、内容 overrides、渠道能力接口、发布状态服务 | 独立平台覆盖稿、媒体能力与发布状态机；M1 只做业务账号资料 |
| social-auto-upload `3847fff01f5434a8a32829833163cd6723cabc59` | MIT | 前端账号 store、按平台组织 uploader、媒体/排期校验 | 能力与验证按平台集中管理。其账号文件/浏览器会话方式不进入松屿 M1 |
| PostBot `d795495c6c94e3297ed7f4b9291fe74b9b17d320` | Apache-2.0 | 平台元信息注册、按文章/动态/视频划分 publisher、内容 reader | 先按平台能力定义扩展接口；不移植浏览器扩展注入或登录态逻辑 |
| Easel `5c12e42e9019d276368130b52385b770749ffa6f` | Apache-2.0 | 内容日历条目、人工发布与回填流程 | 排期、审核、导出与实际发布分别记录；人工确认也要标明证据来源 |

### Postiz

[Prisma schema](https://github.com/gitroomhq/postiz-app/blob/4b7b9901abfcd81c88dc3534fb0a9540af8e0bd3/libraries/nestjs-libraries/src/database/prisma/schema.prisma) 中 Integration 保存平台标识，Post 关联 integration、分组、父子内容和发布日期/状态。[平台抽象](https://github.com/gitroomhq/postiz-app/blob/4b7b9901abfcd81c88dc3534fb0a9540af8e0bd3/libraries/nestjs-libraries/src/integrations/social.abstract.ts) 集中处理平台相关错误和媒体边界。松屿选择更明确的“规范内容源 → 平台版本 → 发布尝试”三层，避免把多平台编辑结果混在同一正文中。

### AiToEarn

[账号 schema](https://github.com/yikart/AiToEarn/blob/5723de436173a92e5c17989a4032cd9a7b2b1d27/project/aitoearn-backend/libs/channel-db/src/schemas/account.schema.ts) 区分账号的平台/身份和状态。[内容覆盖结构](https://github.com/yikart/AiToEarn/blob/5723de436173a92e5c17989a4032cd9a7b2b1d27/project/aitoearn-backend/apps/aitoearn-server/src/core/channels/publish/schemas/publish-content.schema.ts) 允许独立标题、媒体和封面覆盖；[平台接口](https://github.com/yikart/AiToEarn/blob/5723de436173a92e5c17989a4032cd9a7b2b1d27/project/aitoearn-backend/apps/aitoearn-server/src/core/channels/platforms/platforms.interface.ts) 分离认证、能力和内容处理。[状态服务](https://github.com/yikart/AiToEarn/blob/5723de436173a92e5c17989a4032cd9a7b2b1d27/project/aitoearn-backend/apps/aitoearn-server/src/core/channels/publish/tasks/publish-state.service.ts) 明确区分等待、队列、平台排期、人工操作和完成，这支持松屿后续采用有前置状态条件的转换。

### social-auto-upload

[账号 store](https://github.com/dreammis/social-auto-upload/blob/3847fff01f5434a8a32829833163cd6723cabc59/sau_frontend/src/stores/account.js) 映射平台类型、账号名、状态及文件路径。[BaseVideoUploader](https://github.com/dreammis/social-auto-upload/blob/3847fff01f5434a8a32829833163cd6723cabc59/uploader/base_video.py) 集中验证文件类型和发布日期。其 uploader 目录按平台拆分。松屿只借鉴集中验证和平台模块边界，不沿用其会话文件模型，也不将本地时间校验等同于成功发布。

### PostBot

[平台元信息](https://github.com/gitcoffee-os/postbot/blob/d795495c6c94e3297ed7f4b9291fe74b9b17d320/src/media/meta/index.ts) 使用平台键集中注册信息；[publisher 入口](https://github.com/gitcoffee-os/postbot/blob/d795495c6c94e3297ed7f4b9291fe74b9b17d320/src/media/publisher/index.ts) 调用共享发布包并保留浏览器执行边界；[reader 入口](https://github.com/gitcoffee-os/postbot/blob/d795495c6c94e3297ed7f4b9291fe74b9b17d320/src/media/adapter/index.ts) 处理内容读取。它适合作为内容/平台适配边界参考，未据此推断数据库或日历模型。

### Easel

[日历逻辑](https://github.com/ZJU-REAL/Easel/blob/5c12e42e9019d276368130b52385b770749ffa6f/skills/shared/scripts/calendar_ops.py) 使用类型、平台、日期、状态、来源和链接描述条目。[人工发布说明](https://github.com/ZJU-REAL/Easel/blob/5c12e42e9019d276368130b52385b770749ffa6f/docs/manual-publishing.md) 将人工审核、复制/导出、官网提交、回填确认分开。松屿后续应保存“人工报告”和“平台验证”的证据差别，M1 不移植其 AI/自动发布功能。

许可证原文：[Postiz](https://github.com/gitroomhq/postiz-app/blob/4b7b9901abfcd81c88dc3534fb0a9540af8e0bd3/LICENSE)、[AiToEarn](https://github.com/yikart/AiToEarn/blob/5723de436173a92e5c17989a4032cd9a7b2b1d27/LICENSE)、[social-auto-upload](https://github.com/dreammis/social-auto-upload/blob/3847fff01f5434a8a32829833163cd6723cabc59/LICENSE)、[PostBot](https://github.com/gitcoffee-os/postbot/blob/d795495c6c94e3297ed7f4b9291fe74b9b17d320/LICENSE)、[Easel](https://github.com/ZJU-REAL/Easel/blob/5c12e42e9019d276368130b52385b770749ffa6f/LICENSE)。本次没有第三方源码使用，因此未新增转载许可证/NOTICE；以后若复用源码，必须重新核对具体文件及依赖的许可证、兼容性和归属要求，不能仅按仓库名称推断。

## M2：平台版本与素材适配

新增 `distribution_variants`：UUID、`post_id` FK、`account_id` FK、平台标识快照、标题/正文/标签覆盖、内容类型、版本号、更新时间。一个源可对应多个账号版本；平台稿独立保存，源更新只提示“有新版本”，不自动覆盖人工改稿。

媒体通过 `distribution_variant_media` 关联已存在素材及裁切/转码描述。原稿选择继续留在当前 `distribution_post_media`。平台能力注册表描述字数、素材类型/数量、封面和标签限制，复用当前 `DistributionPreparationAdapter` 的准备阶段契约；该接口没有 publish 或凭据字段。

复制产生新 UUID；导出固定源和版本快照，包含格式、素材清单及来源，不能包含 Token。标签管理如需复用再引入规范标签表；迁移现有 tags 数组时保留兼容读取。

## M3：日历、人工确认与发布历史

新增 `distribution_publish_tasks`、`distribution_publish_logs`。任务引用具体 variant **版本快照**，保存计划时间、时区、模式、人工审核、幂等键、状态和重试信息；日志记录尝试、错误、外部作品标识/链接、操作者与证据来源。计划时间统一存 timestamptz，按用户时区呈现。

推荐状态区分 `planned → awaiting_confirmation → manually_reported`；接入官方 API 后另有 `queued → processing → submitted → platform_scheduled / published / failed / unknown`。`scheduled_at` 到达只改变“应处理”视图，不触发发布成功。复制/导出/打开官网均不更改已发布状态。人工回填标记为未经平台验证，失败、超时和未知结果不可盲目重发，先查询平台结果避免重复。

官方 OAuth、加密 Token、刷新、撤销、平台限流和 webhook 验签由独立可信服务实现。Worker/队列运行在浏览器之外，使用最小权限、领取租约、幂等提交和有界重试。发布接口再次验证管理员 MFA/审核授权；后台浏览器只提交业务指令和查询状态，不持有平台密钥。上线前单独评审授权模型、Token 轮换和队列恢复。

## M4：推广目标与表现

需要跨内容组织推广活动时新增 `distribution_campaigns`，保存目标、项目、活动时间范围与归因配置，再给源添加可空 campaign FK。推广链接使用受控参数生成器，记录点击事件的粒度和去重口径。

新增平台表现快照表，按 variant、account、指标日期、平台来源唯一；分别保存曝光、阅读/播放、互动、链接访问和下载。平台口径与时区必须记录，不能把不同平台的播放数直接当成同一人数，也不能把无法获取的值当作零。前台公开站点统计与分发私有表现分开授权，需要聚合时提供受限只读接口。

M2–M4 均为技术规划，本次没有创建这些未来表、接入平台或实现真实发布。
