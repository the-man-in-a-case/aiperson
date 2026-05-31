# aiperson · WPS AI 数字人加载项

一个 WPS Office（演示文稿）的加载项，给老师两种数字人能力：

- **形态一 · 离线视频**：上传角色图 + 输入要说的话 + 选情绪 → 生成数字人视频 → 一键插入幻灯片。用于课前介绍、重点讲解。
- **形态二 · 实时互动**：配置角色"边界"（人设 / 白名单 / 黑名单 / 必答要点 / 拒答话术）后启动 2D 角色，放映模式下与学生实时对话。用于课堂辩论、答疑补充。

后端全栈接入**火山引擎**：
- 豆包大模型（火山方舟）— LLM
- OmniHuman（视觉智能）— 图生数字人视频
- 大模型语音合成 TTS — 配音
- RTC 实时互动数字人 — 实时音视频

## 仓库结构

```
aiperson/
├── packages/
│   ├── shared/      # 跨端共享的 types 与边界 prompt 拼装
│   ├── server/      # Fastify 后端代理，封装火山 API
│   └── wps-addin/   # WPS 加载项前端（React + Vite）
├── docs/
│   └── boundary-spec.md
└── .env.example
```

## 快速开始

```bash
# 0. 安装依赖（需要 Node 20+ 和 pnpm 9+）
corepack enable
pnpm install

# 1. 配置火山引擎凭据
cp .env.example .env
# 把 ARK_API_KEY / VOLC_ACCESS_KEY_ID / VOLC_SECRET_ACCESS_KEY / VOLC_TTS_APPID
# / VOLC_TTS_TOKEN / VOLC_RTC_APP_ID / VOLC_RTC_APP_KEY 填进去

# 2. 启动后端 + 加载项（并行）
pnpm dev
# 后端: http://localhost:8787  /health 可看到各产品是否已配齐
# 加载项: http://localhost:5173  浏览器直接打开即可调试 UI

# 3. 在 WPS 中加载
# 把 packages/wps-addin/manifest.xml 上传到 WPS 开放平台
# 或者用 WPS 加载项调试器指向本地清单文件
```

## 火山引擎需要开通的产品

| 产品 | 用途 | 控制台 |
|---|---|---|
| 火山方舟 | 豆包大模型推理 | https://console.volcengine.com/ark |
| 视觉智能 · OmniHuman | 图生数字人视频 | https://console.volcengine.com/ai/console/cv |
| 语音技术 · 大模型 TTS | 文本转语音 | https://console.volcengine.com/speech |
| 实时音视频 RTC | 实时数字人传输 | https://console.volcengine.com/rtc |

⚠️ 各 API 的 `Action`、`Version`、`req_key` 取值随版本变化，全部以 env 配置暴露，遇到 400 时先核对 `.env` 与火山控制台文档。

## API 概览

| 路由 | 方法 | 用途 |
|---|---|---|
| `/health` | GET | 健康检查 + 凭据自检 |
| `/video/generate` | POST | 提交数字人视频生成任务 |
| `/video/task/:taskId` | GET | 轮询生成进度 |
| `/live/start` | POST | 创建实时会话，返回 RTC 房间凭据 |
| `/live/stop` | POST | 结束实时会话 |
| `/chat/stream` | POST (SSE) | 边界约束下的流式对话 |

## 边界设计

详见 [docs/boundary-spec.md](docs/boundary-spec.md)。

## 凭据自检与所需产品

`GET /health` 返回的 `checks` 字段表示该能力是否已就绪：

| 字段 | env 依赖 | 不就绪时影响 |
|---|---|---|
| `ark` | `ARK_API_KEY` | 形态二的"文本通道"无法回复 |
| `visual` | `VOLC_ACCESS_KEY_ID` + `VOLC_SECRET_ACCESS_KEY` | 形态一 OmniHuman 1.5（`Action=CVSubmitTask`, `req_key=jimeng_realman_avatar_picture_omni_v15`）和形态二智能体启动都用这对 AK/SK |

**形态一 重要前置**：OmniHuman 服务端会从你的 `PUBLIC_BASE_URL` 抓 image_url / audio_url。
本地开发时把 8787 端口用 ngrok / cloudflared 暴露到公网，然后把 `.env` 的
`PUBLIC_BASE_URL` 设成那个公网域名。否则 Volc 抓不到本地 /media 资源会 504。
| `tts` | `VOLC_TTS_APPID` + `VOLC_TTS_TOKEN` | 形态一无声；形态二智能体无法说话 |
| `rtc` | `VOLC_RTC_APP_ID` + (`VOLC_RTC_APP_KEY` 或 `VOLC_RTC_TEST_TOKEN`) | 形态二无法进 RTC 房间，仅文本通道可用 |

> RTC token：服务端实现了完整的 V3 协议（`packages/server/src/volc/rtc-token-v3.ts`，按 [火山官方 Node 参考](https://github.com/volcengine/rtc-aigc-demo/blob/main/Server/token.js) 1:1 移植，HMAC 已对照真实测试 token 验证通过）。配 `VOLC_RTC_APP_KEY` 后每个 session 动态签发；未配置时回退到 `VOLC_RTC_TEST_TOKEN`（房间 / 用户也固定为 `VOLC_RTC_TEST_ROOM` / `VOLC_RTC_TEST_USER`）。
>
> CLI：`pnpm --filter @aiperson/server run token gen myroom myuser` 直接生成，`run token verify <token>` 校验签名。

## 路线图

- [x] WPS 加载项骨架 + taskpane UI
- [x] 后端代理 + 火山引擎签名 V4
- [x] 形态一：图生视频（OmniHuman 1.5）+ TTS + 任务轮询 + 插入幻灯片
- [x] 形态二：边界 DSL + 流式对话 + 双层过滤（文本通道）
- [x] 形态二：`@volcengine/rtc` 前端集成 + RTC AIGC 智能体启停（音视频通道）
- [x] 生产级 RTC V3 token 生成器（对照火山官方参考实现 1:1 移植，HMAC 已验证）
- [ ] 角色形象训练 / 风格化（接入 SDXL LoRA 或火山即梦）
- [ ] 课件知识库 RAG（向量化老师上传的讲义）
- [ ] 学生端独立移动应用（脱离 WPS 单独答疑）

## 开发约定

- 不要在仓库里提交 `.env` 或任何含 SK 的文件。
- 加载项前端在 WPS 内通过 `window.wps` 调用 JS API，在浏览器里自动降级（视频改为新窗口打开）。
- 后端在 Node 20+ 上跑 Fastify；所有火山调用走 `packages/server/src/volc/*`。
