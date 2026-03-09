# Women's Day - 历史女性导师匹配器

一个妇女节主题的 AI Web 应用：用户输入自己的职场/生活困境，系统会匹配一位最契合的历史女性导师，并生成鼓励与建议。

## 项目结构

- `frontend/`: 前端页面（静态资源）
- `backend/`: Node.js + Express 后端（提供 API，并托管前端）

## 运行环境

- Node.js 18+
- npm
- 至少一个可用的大模型 API Key：
  - Gemini (`GEMINI_API_KEY`)
  - 或 Claude (`ANTHROPIC_API_KEY`)

## 快速开始

1. 进入后端目录并安装依赖：

```bash
cd backend
npm install
```

2. 配置环境变量（在 `backend/` 下创建 `.env`）：

```env
PORT=3000
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
# 如果使用 Claude：
# LLM_PROVIDER=claude
# ANTHROPIC_API_KEY=your_anthropic_api_key
# CLAUDE_MODEL=claude-sonnet-4-5
```

支持的 Gemini 模型（后端白名单）：

- `gemini-3-pro-preview`
- `gemini-3-flash-preview`
- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `gemini-2.5-flash-lite`

说明：

- 页面已提供下拉选择器，提交时会将所选模型通过 `gemini_model` 传给后端。
- 若请求中未传或传了不在白名单内的模型，后端会自动回退到 `GEMINI_MODEL`（且仅当它在白名单内）或默认 `gemini-2.5-flash`。

3. 启动项目（开发模式）：

```bash
npm run dev
```

4. 打开浏览器访问：

- [http://localhost:3000](http://localhost:3000)

## 其他运行方式

生产模式：

```bash
cd backend
npm start
```

## 健康检查

启动后可访问：

- `GET /health`
- 示例：`http://localhost:3000/health`

返回示例：

```json
{
  "ok": true,
  "provider": "gemini"
}
```

## 常见问题

- `AI 服务暂时不可用`：检查 API Key 是否正确、额度是否充足。
- `解析结果失败`：模型返回内容未通过 JSON 校验，重试即可。
- 页面打不开：确认后端是否已启动并监听 `PORT`（默认 `3000`）。
