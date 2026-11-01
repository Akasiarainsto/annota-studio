# 已发布的面试演示版

网址：https://akasiarainsto.github.io/annota-studio/

源码在 main；静态发布在 gh-pages 根目录。当前版本 3.0.0-demo.1，不购买服务器或付费托管。旧站的源提交保留为 pre-interview-rebuild-20261101 标签。Node.js / SQLite 本地版与既有数据库保留，没有把本机作业数据库、登录会话或导入素材上传到 GitHub。

线上校验已完成：66 个运行文件与发布分支 Git 对象逐字节匹配；音频、视频、图片 3 个 HTTP Range 请求通过；19 组浏览器场景全部通过，其中三模态完整流程 11 组、JSON/撤销/拖选 4 组、复核更正 2 组、数据隔离与重置 2 组。业务与 API 的 18 项测试通过。详细来源、时间与版本见 evidence/pages_verification_summary.json，其余四份 pages_*_report.json 为线上浏览器结果，pages_http_report.json 为文件与媒体核对结果。

线上角色是演示角色，不是真实账号认证；数据保存在此浏览器，不同浏览器和设备不共享。首次访问会建立四条教学任务，后续保存、查询不重复下载初始任务。清除站点数据或确认重置会删除本浏览器的演示记录。面试前可从登录页重置，按 docs/PAGES_DEMO.md 的路线演练。

后续修改：运行 node scripts/build-pages.mjs，验证 dist 后更新 gh-pages；保留源码与发布提交的对应关系，确认 Pages 构建完成，并用 scripts/verify-pages.py 和 ANNOTA_BASE_URL 指向公网地址运行浏览器测试后报告成功。
