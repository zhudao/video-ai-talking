# 安全说明

## 支持范围

本项目是本机工具，没有云端账号体系。安全问题主要指：

- 密钥被写进仓库、日志或 `data/`
- 本机 HTTP 接口被绑到非本机地址
- 路径穿越导致读到你未选择的文件
- 参考视频、配音或人脸素材被误提交到公开仓库 / Issue

请把问题发到 [本仓库 Issues](https://github.com/yizhi-chengzi/video-ai-talking/issues)，并避免在公开帖子里贴出真实 Key、Token、参考视频或人脸截图。

## 本地使用建议

- 不要把 `localStorage` 里的配置分享给别人
- 不要把 `data/` 目录提交到 git（里面可能有对口型中间片和成片）
- 不要把服务监听改成 `0.0.0.0` 后再暴露到公网
- 日志应对 `apiKey`、`dashscopeApiKey`、`videoretalkApiKey`、`accessToken` 打码
- 出片时参考视频和配音会离开本机，发往阿里百炼 VideoRetalk；只上传你有权处理的内容
