# Women's Day - 历史女性导师匹配器

一个妇女节主题的 AI Web 应用：用户输入自己的职场/生活困境，系统会匹配一位最契合的历史女性导师，并生成鼓励与建议。

## 项目结构

- `frontend/`: 前端页面（静态资源）
- `backend/`: Node.js + Express 后端（提供 API，并托管前端）
- `backend/data/women_profiles.json`: 本地人物资料数据库（Wikipedia 同步结果）

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

3. （可选）同步 100 位女性的 Wikipedia 资料到本地数据库：

```bash
npm run sync:wikipedia
```

> 后端在检测到数据库为空时，也会自动尝试初始化同步。

4. 启动项目（开发模式）：

```bash
npm run dev
```

5. 打开浏览器访问：

- [http://localhost:3000](http://localhost:3000)

## 健康检查

启动后可访问：

- `GET /health`
- 示例：`http://localhost:3000/health`

返回示例：

```json
{
  "ok": true,
  "provider": "gemini",
  "profile_count": 100
}
```

## 常见问题

- `AI 服务暂时不可用`：检查 API Key 是否正确、额度是否充足。
- `解析结果失败`：模型返回内容未通过 JSON 校验，重试即可。
- `fetch failed`（同步 Wikipedia 时）：通常是当前环境网络限制，建议在可访问外网的环境执行同步。
- 页面打不开：确认后端是否已启动并监听 `PORT`（默认 `3000`）。
