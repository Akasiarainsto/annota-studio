# Annota 标序

面向音频、视频与图片标注的纯前端本地演示工作台。视觉采用白灰底、紫蓝强调与深色媒体画布；所有样例场景均为模拟，任务来自用户简历的工作类型，不是原项目的实际客户数据。

在线演示：<https://akasiarainsto.github.io/annota-studio/>  
源码仓库：<https://github.com/Akasiarainsto/annota-studio>

## 直接使用

解压整个文件夹，双击 **打开演示.html**。不需要联网、账户、API Key、npm 或框架。保留旁边的 assets 文件夹。

`index.html` 是模块化源入口，用于 HTTP 预览及后续 GitHub Pages。开发验证时运行 `python tests/preview_server.py 8768`，打开 http://127.0.0.1:8768/ 。该服务器支持 HTTP Range；缺少 Range 的服务器可能导致音视频无法跳转。

## 已实现

- 音频：真实幅度波形、拖选分段、逐段试听、倍速/循环、转写和说话人/语种/方言/场景属性。
- 视频：时间分段、七项 Dense Caption、归一坐标目标框关键帧与线性插值。1/30秒是演示步进，不代表视频真实帧率。
- 视频模型评测：左右 A/B 共用播放、暂停、从头播放、进度和倍速；自动校正明显时间漂移，任一侧缓冲或出错时一起暂停，按较短媒体时长结束，离开页面停止两侧。
- 图片：Caption、内容标签、框选、选择移动、坐标调整、删除和撤销。
- 共用：空白练习、媒体导入、本地草稿、提交、带理由退回、逐项验收、标注/评测分开导出、工作区JSON备份与恢复。
- 双人复核：首位记录独立意见，另一姓名确认后验收；支持退回、分歧与仲裁，每次重提开启新周期。姓名、意见、周期、修订和时间随备份保存；旧版单次复核记录保留并明确标识。详见 `docs/双人复核与双视频同步.md`。
- 分模态 JSON 校验：Dolphin 音频、Seedance 视频、Seedream 图片分别使用原对话对应的字段契约、规则与演示数据；提供 25 个专项案例、原文行列定位、修改复检、文本/问题 CSV/报告 JSON 下载。图片可选择根目录核对文件清单，校验不写入任务库。详见 `docs/分模态JSON校验与即时拦截.md`。
- 即时校验与流程拦截：编辑时提示必填项、枚举、时间及坐标问题；允许保存未完成草稿，提交质检与验收时复用对应规则，不合格任务不能进入下一状态。
- 三个独立环节：数据标注=制作数据，数据质检=检查人工记录，模型评测=判断原始模型输出。CER只使用独立参考稿与未改写的ASR原稿。

## 本地数据

结构化草稿存 localStorage，键为 `annota_studio_v1`；媒体存 IndexedDB `annota_media_v1`。不会覆盖旧工作台存储。清理浏览器数据会删除这些本地内容。JSON备份不含媒体二进制文件，跨设备需重新关联原媒体。恢复遇到同ID会创建副本，不覆盖当前任务。

## 结构

- `src/core.js`：纯业务规则、CER、轨迹插值、审核失效和标注快照。
- `src/review-workflow.js` / `src/review-view.js`：双人复核状态机、备份审计和复核界面；`src/video-comparison.js`：双视频播放与生命周期控制。
- `src/validation_rules/`：独立的音频、视频、图片规则与共用基础检查；`src/validation-adapters.js` 将工作台任务转换成对应训练格式。
- `src/json-validation.js` / `src/json-parser.js`：格式解析、问题定位与分模态校验入口；`src/json-validator.js` 管理文件校验界面，`examples/` 提供与界面一致的 JSON/JSONL 案例。
- `src/storage.js`：浏览器存储适配器。
- `src/media.js`：媒体播放、真实波形、时间选区与框交互。
- `src/views.js`：视图与字段模板；`src/app.js`：用例、事件、环节切换。
- `src/seed-data.js` / `assets/`：明确来源的模拟任务及本地媒体。
- `PRD.md` / `DESIGN.md`：执行规格与用户确认后的设计方向。
- `docs/`：竞品研究、REA证据、操作指南和验证结果。
- `tests/`：业务规则与浏览器流程验证、支持Range的本地预览服务。

## 开发验证

无需安装项目运行依赖。业务测试使用 Node.js：`node --test tests/core.test.mjs tests/json-validation.test.mjs tests/review-workflow.test.mjs`。`tests/json-validator-browser.cjs` 验证独立 JSON 校验操作，`tests/browser-workflow.cjs` 回归媒体与审核流程，`tests/review-sync-browser.cjs` 专项验证双人复核与双视频同步。浏览器验证脚本依赖此机器已有的 Playwright 和 Edge，依赖不进入站点运行包。设置 `ANNOTA_BASE_URL` 可在正式网站复测。

`打开演示.html` 为模块化源的离线合并版；修改源后运行 `python scripts/build_offline.py` 重新生成。它与标准入口使用相同逻辑，没有另一套业务实现。

## GitHub Pages 发布

用户已于 2026-10-29 确认本版并要求发布。发布目标为 `Akasiarainsto/annota-studio`，由 `main` 分支根目录提供静态页面，保留 `.nojekyll`，入口为 `index.html`。不需要框架构建或服务端运行。后续推送到发布分支后，由 GitHub Pages 更新站点。

公开仓库仅包含演示源码、模拟素材、操作文档与验证记录；原始研究记录不纳入 Git。浏览器草稿和用户自行导入的媒体不在仓库内。上线后仍是浏览器本地工作区，没有账号或多人后端。部署和检查步骤见 `docs/GitHub_Pages发布说明.md`。

本地文件地址与 HTTPS 网站使用各自的浏览器存储。迁移原草稿应先在原页面导出完整备份，再在网站“恢复”；备份不含媒体二进制，导入素材需另行重新关联。

## 数据与结果边界

语音是本机合成普通话和程序噪声，视频是程序动画，橙子图是程序绘图；新增笔记本摄影来自 Unsplash：<https://images.unsplash.com/photo-1496181133206-80ce9b88a853>。不能把这些样例当成真实方言、生产模型输出或用户过去项目的样本。

质检是同一浏览器中的流程模拟，没有真实双人权限隔离。没有自动ASR、自动OCR、自动语义质检或模型推理。JSON检查通过只说明符合声明的结构与边界规则，不代表内容准确、美观或合规。
