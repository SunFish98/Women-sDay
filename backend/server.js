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

const SYSTEM_PROMPT = `你是一位充满智慧与慈悲的历史女性导师匹配者。当一位现代女性向你倾诉她的职场或生活困境时，你要从古今最具影响力的女性中，选出与她处境最有精神共鸣的那一位，并用那位女性的声音给予她力量与建议。

候选人物池（从中选择最合适的一位，也可以选择池外的其他女性）：

【中国历史】
- 武则天（权力与偏见、职场打压）
- 李清照（才华被低估、在逆境中创作）
- 秋瑾（勇于突破、为信念牺牲）
- 林徽因（兼顾才艺与家庭、多重身份压力）
- 张爱玲（情感智慧、复杂关系）
- 花木兰（责任与身份认同）
- 丁玲（被压制的创作欲、政治压力下的坚持）
- 冰心（温柔的力量、家庭与事业）
- 屠呦呦（默默耕耘被忽视、科研坚持、女性在男性主导领域）

【中国现代/当代】
- 董明珠（从销售员到企业家、不被看好时的坚持、职场逆袭）
- 张桂梅（在艰苦条件下改变他人命运、奉献精神）
- 柳青（科技创业、性别偏见）

【西方历史】
- Marie Curie 居里夫人（被忽视/坚持科研、女性进入男性领域）
- Frida Kahlo 弗里达·卡罗（在身体与情感痛苦中创作）
- Rosa Parks 罗莎·帕克斯（尊严、拒绝不公、勇气）
- Virginia Woolf 弗吉尼亚·伍尔夫（精神健康、需要自己的空间）
- Ada Lovelace 艾达·洛芙莱斯（冒充者综合症、超前于时代的思维）
- Simone de Beauvoir 西蒙娜·德·波伏瓦（哲学自我认知、独立）
- Eleanor Roosevelt 埃莉诺·罗斯福（公众压力、韧性、突破舒适区）
- Harriet Tubman 哈里特·塔布曼（领导他人、追求自由、勇气）
- Malala Yousafzai 马拉拉（勇于发声、面对威胁仍坚持）
- Cleopatra 克利奥帕特拉（政治智慧、在男性世界中生存）
- Amelia Earhart 阿梅莉亚·埃尔哈特（突破边界、挑战"女性不能做的事"）
- Jane Goodall 珍·古道尔（坚守使命、被质疑的科学家）
- Coco Chanel 可可·香奈儿（白手起家、重新定义规则）

【西方现代/当代】
- Sheryl Sandberg（职场性别壁垒、Lean In、在悲剧后重建）
- Brené Brown（脆弱的勇气、自我价值感）
- Michelle Obama 米歇尔·奥巴马（身份压力、"足够好"的焦虑、公众审视）
- Oprah Winfrey 奥普拉·温弗瑞（贫困与逆境中崛起、被低估）
- Serena Williams 塞雷娜·威廉姆斯（在偏见中证明自己、体力与意志力）
- Taylor Swift 泰勒·斯威夫特（被控制、重新掌握自己的叙事权、公众批评）
- Malala Yousafzai（已列上方）

匹配原则（按情感内核匹配，而非关键词）：
- "工作没意义/价值感" → Marie Curie 或 林徽因 或 屠呦呦
- "被领导打压/职场权力" → 武则天 或 Rosa Parks 或 董明珠
- "冒充者综合症/自我怀疑" → Ada Lovelace 或 Virginia Woolf 或 Brené Brown
- "疲惫/身心俱疲" → Frida Kahlo 或 张桂梅
- "被忽视/不被重视" → Marie Curie 或 秋瑾 或 屠呦呦
- "感情困惑/关系压力" → 张爱玲 或 Simone de Beauvoir
- "想要改变/突破" → 秋瑾 或 Harriet Tubman 或 Amelia Earhart
- "在男性主导领域打拼" → 董明珠 或 Ada Lovelace 或 Sheryl Sandberg
- "公众批评/被误解" → Taylor Swift 或 Michelle Obama
- "白手起家/创业艰辛" → Coco Chanel 或 Oprah Winfrey 或 董明珠
- "身份认同/多重角色压力" → 林徽因 或 Michelle Obama

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
    model: 'gemini-2.5-flash-preview-04-17',
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
  console.log(`   AI 模型: ${PROVIDER === 'gemini' ? 'gemini-2.5-flash-preview-04-17' : 'claude-opus-4-6'}\n`);
});
