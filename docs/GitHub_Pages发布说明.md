# GitHub Pages 发布说明

用户于 2026-10-29 确认当前版本并要求上线 GitHub。

- 仓库：<https://github.com/Akasiarainsto/annota-studio>
- 网站：<https://akasiarainsto.github.io/annota-studio/>
- 发布源：`main` 分支根目录，入口 `index.html`，`.nojekyll` 跳过 Jekyll 处理。
- 形态：HTML + CSS + 原生 JavaScript 模块，所有演示媒体随仓库提供，无运行时依赖和构建步骤。

## 发布与更新

1. 在本地修改模块化源码、同步行为文档，运行适合变更的验证。
2. 若修改了 HTML、CSS 或 JavaScript，运行 `python scripts/build_offline.py` 更新离线入口。
3. 提交并推送到 `main`。GitHub Pages 根据发布源自动部署，关注仓库 Actions 中的 Pages 结果。
4. 等待部署成功后，验证线上页面、资源子路径、媒体播放、分模态 JSON 案例及提交流程，避免只根据推送成功判断已上线。

相关配置依据 GitHub 官方的[发布源说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)与 [Pages API](https://docs.github.com/en/rest/pages/pages)。

## 数据范围

公开内容为演示源码、模拟数据、随包媒体、文档与验证记录。`docs/rea_evidence.json` 是原始研究记录，已由 `.gitignore` 排除；没有上传简历 PDF、浏览器工作区备份或用户导入的素材。平台没有模型 API、账号或多人服务。

草稿存当前网站的 localStorage，用户导入媒体存 IndexedDB。页面提供静态资源，不将这些内容上传到 GitHub。网站与本地 `file://` 入口的浏览器存储相互独立；需要迁移时，先在原页面导出完整备份，再在网站恢复。备份不包含媒体本体，导入媒体需另行保留并重新关联。

预置数据是模拟场景。图片为随包测试素材和注明来源的 Unsplash 摄影；音频为合成音频与程序噪声，视频为程序动画。不能将网站表述为用户过去使用的生产系统。

## 验证记录

本地核心与流程验证见 `json_validator_verification.json`、`browser_verification.json`。线上实测保存在 `pages_verification.json`，含 URL、实际验证的应用提交、资源检查和交互结果。运行文件与媒体 Range 核对明细见 `pages_http_verification.json`；报告中的提交号对应实际完成的验证版本。

三套 JSON 操作共 12 组交互验证通过；原工作流的 14 组回归通过，其中 13 组在网站完成，另 1 组验证离线兼容性。测试包含媒体播放与跳转、分模态专项错例、目录选择、修改复检、草稿保存、提交拦截、退回和验收、独立 CER、小屏和存储保护。应用代码在补充这些验证文档时未再修改。

双人复核与双视频同步恢复后，先通过本地 59 项规则测试及 8 组专项交互，再推送发布并在正式站复测。线上 8 组专项、12 组 JSON 与 14 组原工作流均通过；24 个运行文件与源码一致，3 类媒体 Range 请求通过。专项包括同名拦截、新周期、退回/仲裁、旧记录保留、双侧播放/暂停/跳转/倍速、漂移、缓冲、结束和离页销毁。验证提交及部署运行链接见汇总报告。

浏览器测试支持通过环境变量切换至线上地址，默认仍测试本地入口。验证会使用独立浏览器上下文，不操作用户当前浏览器的草稿：

```powershell
$env:ANNOTA_BASE_URL = 'https://akasiarainsto.github.io/annota-studio/'
node tests/json-validator-browser.cjs
node tests/browser-workflow.cjs
node tests/review-sync-browser.cjs
```

线上分项结果分别写入 `pages_json_verification.json`、`pages_workflow_verification.json` 与 `pages_review_sync_verification.json`，不会覆盖原本地结果。双人复核与同步播放的规则和专项范围见《双人复核与双视频同步》。脚本中的浏览器运行时路径对应开发验证环境，其他机器需配置其本地 Playwright 与 Edge 路径；网站运行无需这些工具。

GitHub Pages 不会自动把各浏览器的数据汇总，也不提供真实的人员权限与服务端校验。结构规则通过仍需人工复核内容质量。
