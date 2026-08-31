# 参与贡献

谢谢你愿意改进这个本机真人口播工具。参与前请阅读 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)。

## 开发

```bash
npm install
npm test
npm run typecheck
npm run dev
```

开发时页面默认 `http://127.0.0.1:5175`，本机 API 默认 `127.0.0.1:8789`。生产构建后由 `npm start` 在 `8789` 同时提供页面和 API。

本地验证可以设 `VAT_MOCK=1`，不访问外网、不跑真实对口型。

## 原则

- 密钥只走浏览器 `localStorage` 和当次请求，不要写进仓库、`.env` 或 `data/`。
- 不要新增云端账号、登录或远程分析。
- 不要在配置里加入用户自备 OSS。首版只走百炼官方临时上传。
- 新列表接口要限制分页上限。
- 提交前跑 `npm test` 和 `npm run typecheck`。涉及 FFmpeg 的测试只测参数拼装；VideoRetalk 测试只做 mock，不要跑真实对口型。
- 不要把别人的素材、Cookie、API Key、参考视频或人脸截图提交上来。
- 不要把服务默认监听改成公网地址。
