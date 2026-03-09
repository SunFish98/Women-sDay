import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const PROVIDER = process.env.LLM_PROVIDER || 'gemini'; // 'gemini' or 'claude'

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../frontend')));

// Simple in-memory rate limiting
const rateLimitMap = new Map();
function rateLimit(ip, limit = 20, windowMs = 60000) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + windowMs;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count <= limit;
}

const SYSTEM_PROMPT = `你是一位充满智慧与慈悲的历史女性导师匹配者。当一位现代女性向你倾诉她的职场或生活困境时，你要从历史上最具影响力的女性中，选出与她处境最有精神共鸣的那一位，并用那位历史女性的声音给予她力量与建议。

候选人物池（从中选择最合适的一位，也可以选择池外的其他历史女性）：
- 中国：武则天（权力与偏见）、李清照（才华被低估）、秋瑾（勇于突破）、林徽因（兼顾才艺与家庭）、张爱玲（情感智慧）、花木兰（责任与身份）、居里夫人（虽是波兰人，在中国家喻户晓）
- 西方：Marie Curie（被忽视/坚持科研）、Frida Kahlo（在痛苦中创作）、Rosa Parks（尊严与拒绝不公）、Virginia Woolf（精神健康、自我空间）、Ada Lovelace（冒充者综合症、超前思维）、Simone de Beauvoir（哲学自我认知）、Eleanor Roosevelt（公众压力、韧性）、Harriet Tubman（领导他人、自由）、Malala Yousafzai（勇于发声）、Cleopatra（政治智慧）

匹配原则（按情感内核匹配，而非关键词）：
- "工作没意义/价值感" → Marie Curie 或 林徽因
- "被领导打压/职场权力" → 武则天 或 Rosa Parks
- "冒充者综合症/自我怀疑" → Ada Lovelace 或 Virginia Woolf
- "疲惫/身心俱疲" → Frida Kahlo
- "被忽视/不被重视" → Marie Curie 或 秋瑾
- "感情困惑" → 张爱玲 或 Simone de Beauvoir
- "想要改变/突破" → 秋瑾 或 Harriet Tubman

输出格式：仅输出合法 JSON，不要 markdown 代码块，不要任何解释，直接以 { 开头：
{
  "name": "姓名（中文人物用中文，西方人物用中英文，如 '居里夫人 Marie Curie'）",
  "name_en": "英文名或拼音",
  "era": "朝代或年代描述，中文，如 '中国唐朝，约624-705年'",
  "avatar_emoji": "一个最能代表她的 emoji（如 👑 皇帝、🔬 科学家、🎨 艺术家）",
  "avatar_color": "她的头像背景色，十六进制颜色值，契合其气质（如 #8B1A1A 武则天）",
  "historical_context": "1-2句中文：她曾面临的与用户相似的处境",
  "quote": "她的真实名言或精神相符的话，中文人物用中文，西方人物可用中文译文，不超过50字",
  "quote_attribution": "— 姓名",
  "personal_advice": "3-4句中文，以她的口吻直接对用户说话，用'你'称呼，结合她自己的经历给予具体的力量与建议，末句要振奋人心",
  "wisdom_tags": ["标签1", "标签2", "标签3"]
}`;

async function callGemini(problem) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: `今天是国际妇女节。一位现代女性的困境是："${problem}"\n\n请为她匹配最合适的历史女性导师，用那位导师的声音给予她智慧与力量。` }] }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 900 },
  });

  return result.response.text();
}

async function callClaude(problem) {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const msg = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 900,
    temperature: 0.8,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `今天是国际妇女节。一位现代女性的困境是："${problem}"\n\n请为她匹配最合适的历史女性导师，用那位导师的声音给予她智慧与力量。` }],
  });

  return msg.content[0].text;
}

function parseJSON(text) {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}

const REQUIRED_FIELDS = ['name', 'name_en', 'era', 'avatar_emoji', 'avatar_color', 'quote', 'quote_attribution', 'personal_advice', 'wisdom_tags'];

app.post('/api/match', async (req, res) => {
  const ip = req.ip || 'unknown';
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: '请求太频繁，请稍后再试' });
  }

  const { problem } = req.body;
  if (!problem || typeof problem !== 'string') {
    return res.status(400).json({ error: '请输入你的困境' });
  }
  const trimmed = problem.trim();
  if (trimmed.length < 5 || trimmed.length > 300) {
    return res.status(400).json({ error: '请输入 5-300 字的内容' });
  }

  let rawText;
  try {
    rawText = PROVIDER === 'claude' ? await callClaude(trimmed) : await callGemini(trimmed);
  } catch (err) {
    console.error('LLM error:', err.message);
    return res.status(502).json({ error: 'AI 服务暂时不可用，请稍后重试' });
  }

  let data;
  try {
    data = parseJSON(rawText);
  } catch {
    // Retry once
    try {
      rawText = PROVIDER === 'claude' ? await callClaude(trimmed) : await callGemini(trimmed);
      data = parseJSON(rawText);
    } catch (err) {
      console.error('JSON parse error:', rawText);
      return res.status(500).json({ error: '解析结果失败，请重试' });
    }
  }

  for (const field of REQUIRED_FIELDS) {
    if (!data[field]) {
      return res.status(500).json({ error: '返回数据不完整，请重试' });
    }
  }

  res.json({ success: true, data });
});

app.get('/health', (_, res) => res.json({ ok: true, provider: PROVIDER }));

app.listen(PORT, () => {
  console.log(`\n🌸 历史女性导师匹配器 启动成功`);
  console.log(`   访问地址: http://localhost:${PORT}`);
  console.log(`   AI 提供商: ${PROVIDER.toUpperCase()}\n`);
});
