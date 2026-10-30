# Annota 标序

音频、视频、图片标注工作台，包含本地演示和真实账号的团队协作试用版。保留白灰底、紫蓝强调和深色媒体画布。预置场景模拟 Dolphin 语音、Seedance 视频、Seedream 图文作业，不包含用户以往项目的客户数据。

- 在线工作台：https://akasiarainsto.github.io/annota-studio/
- 团队协作：https://akasiarainsto.github.io/annota-studio/team.html
- 源码：https://github.com/Akasiarainsto/annota-studio

## 两种使用方式

本地工作台：打开网站首页，或解压完整交付包后双击 `打开演示.html`，保留 `assets/`。运行离线版不需要 Node、账户或网络。草稿存 localStorage `annota_studio_v1`，导入媒体存 IndexedDB `annota_media_v1`；不会自动上传团队项目。清理浏览器数据会删除本地内容，JSON 备份不含媒体二进制。

团队协作试用：打开 `team.html`，注册邮箱和密码、创建项目。负责人在“项目看板”生成单次加入码并指定角色；成员用独立账号登录后输入加入码。项目、媒体、任务、独立复核和计时保存在服务端，显示姓名不作为权限凭据。操作和统计口径详见 [团队协作使用说明](docs/团队协作使用说明.md)。

当前未开启邮箱归属验证，也未提供找回密码页面；认证服务仍采用共享发信配置。正式业务使用前需配置自己的 SMTP 并完成邮件验证/找回密码流程，不能将试用版称作已完成生产邮件体系。见 [Neon Auth 上线要求](https://neon.com/docs/auth/production-checklist)。

## 已实现

- 音频：真实波形、拖选/调整分段、逐段试听、倍速/循环、转写和说话人/语种/方言/场景属性。音文对齐指人工时间片段与文字对应，不含自动 ASR 或强制对齐模型。
- 视频：时间分段、七项 Dense Caption、目标框关键帧与线性插值。模型评测保留 A/B 同步播放、暂停、跳转、倍速、漂移校正、缓冲和离页销毁。
- 图片：Caption、标签、目标框、移动、坐标调整、删除和撤销。
- 音视频：一键创建 3–10 秒整数长度片段，尾部不足时拒绝截短；音频重叠先提示处理。导出真实 PCM WAV / WebM 文件。视频按播放速度重编码，需保持页面前台；取消或切入后台中止编码。视频不承诺帧级精确。推荐新版 Edge/Chrome。双击文件版导出随包媒体时需重新选择同名原文件，本地导入和云端 Blob 可以直接读取；文件名一致不能证明内容完全相同。
- 分模态 JSON/JSONL：三个字段契约、25 个专项案例、原文行列定位、修改复检、CSV/JSON 报告、图片文件清单核对。编辑即时检查，提交前前端与服务端复用规则。草稿允许不完整，不合格数据禁止提交。
- 团队项目：真实账号和角色、单次加入码、任务分配、难度设置、私有媒体、跨设备保存、乐观版本冲突保护。单文件最大 100 MB。
- 分层质检：按媒体/难度/负责人抽样，冻结修订、提交周期、随机种子和清单；两位真实账号独立判断。齐备前隐藏对方意见，双通过验收、双不合格自动退回、分歧交由非自提的管理者仲裁。过期修订不能继续投票。
- Kappa：显示有效配对数、Po、Pe、混淆矩阵和 κ=(Po−Pe)/(1−Pe)，无样本或 Pe=1 时明确不可计算。仲裁不改写原始判断。
- 项目看板：分配、进度、工时、标注/复核人效、返工率，按媒体筛选；数据来自服务端实际提交、复核和计时。短时试用折算值不代表稳定人效。
- 三个环节分开：标注制作数据、质检检查人工记录、模型评测判断原始输出。CER 只使用未改写 ASR 和独立参考。

## 架构与开发

前端为 HTML/CSS/原生 JavaScript，GitHub Pages 提供页面。团队 API 使用 Neon Function、托管认证、Postgres 与私有 S3。开发和线上试用采用独立数据库分支与 Auth URL；开发验收账号不迁移。浏览器只存公开服务 URL，数据库/存储凭据由服务端环境注入。

入口：`index.html` 本地工作台；`team.html` 项目/抽检/看板；`team_task.html` 云端任务。`src/operations-core.js` 管抽样和统计；`src/cloud-task-store.js` 管保存队列和版本；`server/*-service.js` 按项目、任务、质检、计时、媒体划分；`server/schema.sql` 为幂等建表脚本。

开发和重建需要 Node 与锁定依赖：

```sh
npm ci --ignore-scripts
npm run build:cloud
node scripts/build-offline.mjs
npm test
python tests/preview_server.py 8768
```

`build:cloud` 生成浏览器认证 SDK、WebM 元数据修复库和 `.server_build/index.mjs`。健康接口返回源码指纹以核对部署；ZIP 根入口须为 `index.mjs`。`src/team-config.js` 仅存公开 URL。交付排除 `node_modules/`、`.server_build/`、`.env*`、原始 REA 记录。生成后的双击版无需安装依赖。

```sh
node tests/browser-workflow.cjs
node tests/json-validator-browser.cjs
node tests/review-sync-browser.cjs
node tests/clip-export-browser.cjs
```

浏览器脚本使用开发机已有 Playwright/Edge，其他机器需调整路径。设置 `ANNOTA_BASE_URL` 复测网站。多人开发验证见 `docs/team_verification.json`，线上验收单独保存。部署步骤见 [GitHub Pages 发布说明](docs/GitHub_Pages发布说明.md)。

## 数据与结果边界

语音为合成普通话和程序噪声，视频为程序动画，橙子图为程序绘图；笔记本摄影来自 Unsplash 公开素材 photo-1496181133206-80ce9b88a853。不能将它们称作真实方言、生产模型输出或用户过去项目的客户样本；新系统不能证明用户过去已经上线此系统。

格式校验不替代内容、语义、审美或合规复核，不能由此推算“节省 80% 人力”。本地姓名复核仍是流程模拟；团队版本才由真实账号和服务端检查执行隔离。
