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

本地核心与流程验证见 `json_validator_verification.json`、`browser_verification.json`。本次线上实测将保存在 `pages_verification.json`，含 URL、部署提交、资源检查和交互结果；该记录只有在实际验证后生成。

GitHub Pages 不会自动把各浏览器的数据汇总，也不提供真实的人员权限与服务端校验。结构规则通过仍需人工复核内容质量。
