在线面试版使用浏览器 IndexedDB 与 Service Worker，无额外运行时依赖。角色为模拟，不连接外部认证或付费服务。

# 运行时与复用组件

前端使用原生 HTML/CSS/JavaScript，服务端使用 Node.js 24+ 内置 HTTP、crypto、fs 和 node:sqlite，不依赖外部账号或网络。当前电脑实际验证 Node.js v24.22.1。node:sqlite 的 API 在 Node 24 仍有实验状态，本地持久化已经测试；未来生产部署应单独评估数据库和迁移方案。

复用了本地旧工程的 JSON 定位解析器、WAV 编码器和浏览器 clip 导出逻辑，分别放在 core 与 services，未复用旧版布局和任务状态机。

视频 WebM 时长修复沿用旧工程已经打包的 fix-webm-duration 1.0.6（MIT）。文件位于 public/vendor/webm-duration.js；调用由 services/clip-export.js 隔离，默认关闭库日志。原许可保留为 FIX_WEBM_DURATION_LICENSE.txt，不额外在线安装依赖。

Playwright 和 Edge 仅用于开发验证，不是用户运行依赖。Python/PyAV 仅用于核对导出文件，不是应用运行依赖。
