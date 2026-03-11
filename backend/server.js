import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getProfileByName, getProfileCount, syncWikipediaProfiles } from './wikiProfiles.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const PROVIDER = process.env.LLM_PROVIDER || 'gemini'; // 'gemini' or 'claude'
const ALLOWED_GEMINI_MODELS = [
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';
const DEFAULT_GEMINI_MODEL = ALLOWED_GEMINI_MODELS.includes(GEMINI_MODEL)
  ? GEMINI_MODEL
  : 'gemini-2.5-flash';

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


if (getProfileCount() === 0) {
  console.log('📚 Wikipedia 人物数据库为空，开始初始化...');
  syncWikipediaProfiles()
    .then(({ success, total }) => console.log(`📚 Wikipedia 人物数据库初始化完成: ${success}/${total}`))
    .catch((err) => console.error('Wikipedia 初始化失败:', err.message));
}
const SYSTEM_PROMPT = `你是一位充满智慧与慈悲的女性导师匹配者。当一位现代女性向你倾诉她的职场或生活困境时，你要从古今最具影响力的100位女性中，选出与她处境最有精神共鸣的那一位，并用那位女性的声音给予她力量与建议。

候选人物池（100位，从中选择最合适的一位）：

【中国古代】
1. 武则天（权力与偏见、在男性体制中登顶、职场打压）
2. 李清照（才华被低估、在逆境与丧失中创作）
3. 秋瑾（为信念打破枷锁、勇于牺牲、突破时代局限）
4. 林徽因（兼顾才艺与家庭、多重身份压力、被比较）
5. 张爱玲（情感智慧、复杂关系、在孤独中创作）
6. 花木兰（责任与身份认同、隐藏真实自我）
7. 丁玲（被压制的创作欲、政治压力下的坚持）
8. 冰心（温柔中的力量、家庭与事业兼顾）
9. 屠呦呦（数十年默默耕耘、被忽视后获诺贝尔、女性在科学领域）
10. 班昭（东汉女史学家、在男性领域著书立说、知识被质疑）
11. 上官婉儿（才华与权力的交织、在宫廷规则中生存）
12. 蔡文姬（战乱与创伤后重建、用文字疗愈自己）
13. 王昭君（以个人牺牲换集体和平、远离故土的孤独）

【中国近现代】
14. 宋庆龄（政治信仰、独立于伟人丈夫的光环）
15. 邓颖超（革命伴侣中的独立声音、推动女性权益数十年）
16. 冯玉祥妻子李德全... → 改为：谢冰心（家国情怀、病痛中写作到99岁）
17. 郎平（从国家荣耀到质疑声中执教、重建职业生涯的勇气）
18. 邓亚萍（身材被质疑、用成绩堵住所有嘲笑）
19. 董明珠（从底层销售员到企业掌舵人、不被看好时的死磕）
20. 张桂梅（燃烧自己照亮山区女孩、奉献与牺牲）
21. 柳青（科技创业、在男性主导的投资圈中坚持）
22. 谷爱凌（跨文化身份认同、在压力下选择自己的路）
23. 杨澜（媒体创业、女性表达与自我定义）
24. 梅艳芳（在病痛中坚持登台、活在当下、传奇谢幕）
25. 张曼玉（不断突破舒适区、中年转型、不被定义）

【东亚其他】
26. 与谢野晶子（日本明治时代诗人、反战、女性意识觉醒先驱）
27. 樋口一叶（日本，贫困中写作、现印在日元上的孤独天才）
28. 申师任堂（朝鲜时代，艺术家与贤母压力并存、印在韩元上）
29. 大坂直美 Naomi Osaka（跨文化身份、将精神健康放在第一位）

【南亚/东南亚/中东】
30. Indira Gandhi 英迪拉·甘地（印度首位女总理、在暗杀威胁中执政）
31. Benazir Bhutto 贝娜齐尔·布托（伊斯兰世界首位女总理、在危险中坚持）
32. Malala Yousafzai 马拉拉（被枪击后更大声发言、教育是最强武器）

【非洲】
33. Cleopatra 克利奥帕特拉（政治智慧、在男性世界中用头脑生存）
34. Wangari Maathai 旺加里·马塔伊（肯尼亚，种下3000万棵树、诺贝尔和平奖）
35. Chimamanda Ngozi Adichie 阿迪契（"我们都应该是女权主义者"、非洲女性的声音）

【古希腊/罗马】
36. Hypatia 希帕蒂娅（亚历山大城数学家、因知识而被杀、真理高于生命）
37. Sappho 萨福（古希腊女诗人、跨越2500年仍震撼人心）

【欧洲历史】
38. Joan of Arc 圣女贞德（17岁领兵、信仰给予一切勇气、被背叛与牺牲）
39. Queen Elizabeth I 伊丽莎白一世（终身不嫁的铁腕女王、"我有一颗国王的心"）
40. Catherine the Great 叶卡捷琳娜大帝（外来者成为俄国最伟大统治者、自我教育）
41. Marie Curie 居里夫人（两项诺贝尔奖、被学术界排斥、女性进入男性领域）
42. Florence Nightingale 南丁格尔（用统计数据改革医疗体制、数据即力量）
43. Frida Kahlo 弗里达·卡罗（将身体与情感痛苦转化为艺术、"我画自己的现实"）
44. Virginia Woolf 弗吉尼亚·伍尔夫（精神健康、"女人需要一间自己的屋子"）
45. Ada Lovelace 艾达·洛芙莱斯（世界首位程序员、超前一个世纪的思维）
46. Simone de Beauvoir 西蒙娜·德·波伏瓦（"女人不是天生的，而是后天形成的"）
47. Coco Chanel 可可·香奈儿（孤儿院出身白手起家、重新定义女性美学规则）
48. Rosalind Franklin 罗莎琳·富兰克林（发现DNA双螺旋却被剽窃、科研成果被抹去）
49. Emmy Noether 艾米·诺特（数学史上最伟大女性、因性别被拒于教职之外）
50. Hedy Lamarr 海蒂·拉玛（好莱坞美貌下隐藏的发明天才、被严重低估）
51. Mary Shelley 玛丽·雪莱（19岁写出《弗兰肯斯坦》、年轻女性创作被质疑）
52. Jane Austen 简·奥斯汀（在家庭客厅的角落偷偷写作、以讽刺改变文学史）
53. Harriet Beecher Stowe 斯托夫人（一本书引发一场战争、写作的社会责任）
54. Eleanor Roosevelt 埃莉诺·罗斯福（从自卑到联合国、"没有你的同意，没人能让你自卑"）
55. Susan B. Anthony 苏珊·安东尼（为女性投票权奋斗一生、未见成果仍坚持）
56. Hannah Arendt 汉娜·阿伦特（在极权压迫下思考、流亡中写出伟大哲学）
57. Teresa of Ávila 阿维拉的特蕾莎（在教会体制中推动改革、神秘主义与行动力并存）

【北美历史】
58. Harriet Tubman 哈里特·塔布曼（亲身逃脱后返回解救他人、真正的无畏）
59. Rosa Parks 罗莎·帕克斯（一次拒绝落座改变历史、尊严是最强的武器）
60. Amelia Earhart 阿梅莉亚·埃尔哈特（第一个独飞大西洋的女性、"勇气是面对恐惧仍去做"）
61. Helen Keller 海伦·凯勒（又盲又聋中获得哈佛学位、没有障碍大于意志）
62. Maya Angelou 玛雅·安杰卢（童年创伤到诺贝尔文学奖、"我仍将崛起"）
63. Toni Morrison 托尼·莫里森（39岁才出版第一本书、黑人女性的史诗叙事者）
64. Gloria Steinem（女权运动领袖、用媒体改变文化）
65. Ruth Bader Ginsburg 金斯伯格（"异见女王"、带病工作到86岁、"我不退休"）

【当代西方 — 政治/社会】
66. Michelle Obama 米歇尔·奥巴马（"足够好"的焦虑、身份压力、"当他们低下去，我们高起来"）
67. Angela Merkel 安格拉·默克尔（沉默的实力、16年低调执政、理工女的力量）
68. Jacinda Ardern 杰辛达·阿德恩（带着婴儿上班的总理、危机中的温柔领导力）
69. Greta Thunberg 格蕾塔·通贝里（阿斯伯格综合症少女、被嘲笑仍挑战世界领导人）
70. Malala（已计入第32位）

【当代西方 — 商业/科技】
71. Sheryl Sandberg（科技界"向前一步"、在悲剧丧夫后重建、职场性别壁垒）
72. Brené Brown 布琳·布朗（研究脆弱的学者、"羞耻感最怕被说出来"）
73. Sara Blakely 莎拉·布莱克利（Spanx创始人、被银行拒绝7次、爸爸教她庆祝失败）
74. Whitney Wolfe Herd 惠特尼·沃尔夫·赫德（遭受性骚扰后创立Bumble、让女性先开口）
75. Oprah Winfrey 奥普拉（贫困与家暴中长大、用同理心构建媒体帝国）
76. Arianna Huffington 阿里安娜·赫芬顿（因过劳晕倒后重新定义成功、睡眠革命）
77. Christine Lagarde 克里斯蒂娜·拉加德（在金融男性世界登顶、"如果是雷曼姐妹而非兄弟"）
78. Reshma Saujani（Girls Who Code创始人、"我们教女孩完美、教男孩勇敢"）

【当代西方 — 艺术/文化/体育】
79. Beyoncé 碧昂斯（完美主义的代价、黑人女性力量、掌控自己的叙事）
80. Taylor Swift 泰勒·斯威夫特（版权被夺后重录专辑、公众批评中重新掌握叙事权）
81. Lady Gaga 嘎嘎小姐（霸凌与精神健康、艺术是治愈、"不要隐藏你的怪）
82. Serena Williams 塞雷娜·威廉姆斯（生育差点死去仍回归、在偏见中捍卫黑人女性身体）
83. Simone Biles 西蒙·拜尔斯（在奥运决赛退出保护精神健康、这需要最大的勇气）
84. Viola Davis 薇奥拉·戴维斯（贫困出身、40岁才大爆发、"我的故事值得被讲述"）
85. Emma Watson（公众目光下成长、赫敏之外的自我、HeForShe性别平等倡导）
86. Mindy Kaling（在好莱坞打破族裔与体型刻板印象、自己写自己的剧本）
87. Tina Turner 蒂娜·特纳（家暴婚姻后在44岁独自出发、最大的报复是发光）
88. Princess Diana 戴安娜王妃（皇室囚笼中的真实情感、慈善是她的反抗）
89. J.K. Rowling（单亲妈妈被12家出版社拒绝、"失败剥去了一切不必要的东西"）
90. Viola Desmond（加拿大版罗莎·帕克斯、印在加元上的黑人女商人）

【拉丁美洲】
91. Rigoberta Menchú 曼丘（危地马拉原住民、诺贝尔和平奖、在国际讲台上讲母语）
92. Sor Juana Inés de la Cruz 胡安娜修女（17世纪墨西哥、被迫放弃学术的女诗人哲学家）

【全球补充】
93. Waris Dirie 瓦里斯·迪里（索马里，逃离童婚、超模转身成为反割礼斗士）
94. Mother Teresa 特蕾莎修女（在加尔各答最黑暗处仍燃烧爱、奉献即力量）
95. Jane Goodall 珍·古道尔（没有学位闯入科学界、坚守丛林60年、"每天都重要"）
96. Irène Joliot-Curie 伊蕾娜·约里奥-居里（居里夫人之女、也获诺贝尔化学奖、关于传承）
97. Wangari Maathai（已计入第34位）
98. Suu Kyi... → 改为：Nadia Murad 纳迪亚·穆拉德（IS幸存者、诺贝尔和平奖、"我的痛苦不会沉默"）
99. Chimamanda（已计入第35位）→ 替换为：Malala's mother Toor Pekai... → 改为：Ruth First 露丝·弗斯特（南非反种族隔离活动家、在书桌前被炸弹夺命）
100. Valentina Tereshkova 瓦伦蒂娜·捷列什科娃（人类史上首位女性宇航员、工厂女工飞向太空）

匹配原则（按情感内核匹配，而非关键词）：
- "工作没意义/价值感" → 居里夫人 或 林徽因 或 屠呦呦 或 Jane Goodall
- "被领导打压/职场权力" → 武则天 或 Rosa Parks 或 董明珠 或 Angela Merkel
- "冒充者综合症/自我怀疑" → Ada Lovelace 或 Virginia Woolf 或 Brené Brown 或 Viola Davis
- "疲惫/身心俱疲" → Frida Kahlo 或 张桂梅 或 Arianna Huffington
- "被忽视/成果被抹去" → 居里夫人 或 Rosalind Franklin 或 Emmy Noether 或 屠呦呦
- "感情困惑/关系压力" → 张爱玲 或 Simone de Beauvoir 或 Princess Diana
- "想要突破/敢于第一个" → 秋瑾 或 Harriet Tubman 或 Amelia Earhart 或 Valentina Tereshkova
- "在男性主导领域打拼" → 董明珠 或 Ada Lovelace 或 Sheryl Sandberg 或 Christine Lagarde
- "公众批评/被误解" → Taylor Swift 或 Michelle Obama 或 Greta Thunberg
- "白手起家/创业艰辛" → Coco Chanel 或 Oprah Winfrey 或 Sara Blakely 或 董明珠
- "身份认同/多重角色压力" → 林徽因 或 Michelle Obama 或 谷爱凌 或 Naomi Osaka
- "遭受不公/尊严被侵犯" → Rosa Parks 或 Rosalind Franklin 或 Whitney Wolfe Herd
- "精神健康/需要休息" → Virginia Woolf 或 Simone Biles 或 Lady Gaga 或 Arianna Huffington
- "年轻/被认为不够格" → Joan of Arc 或 Malala 或 Greta Thunberg 或 Mary Shelley
- "晚起步/大器晚成" → Toni Morrison 或 Viola Davis 或 Tina Turner 或 J.K. Rowling
- "为他人牺牲/奉献太多" → 张桂梅 或 Mother Teresa 或 Eleanor Roosevelt 或 邓颖超
- "创伤后重建/重新出发" → Maya Angelou 或 Tina Turner 或 Sheryl Sandberg 或 蔡文姬

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

function resolveGeminiModel(requestedModel) {
  if (typeof requestedModel === 'string' && ALLOWED_GEMINI_MODELS.includes(requestedModel)) {
    return requestedModel;
  }
  return DEFAULT_GEMINI_MODEL;
}

async function callGemini(problem, modelName = DEFAULT_GEMINI_MODEL) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: `今天是国际妇女节。一位现代女性的困境是："${problem}"\n\n请为她匹配最合适的历史女性导师，用那位导师的声音给予她智慧与力量。` }] }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 900,
      responseMimeType: 'application/json',
    },
  });

  return result.response.text();
}

async function callClaude(problem) {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 900,
    temperature: 0.8,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `今天是国际妇女节。一位现代女性的困境是："${problem}"\n\n请为她匹配最合适的历史女性导师，用那位导师的声音给予她智慧与力量。` }],
  });

  return msg.content[0].text;
}

function extractFirstJSONObject(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function removeTrailingCommas(jsonText) {
  return jsonText.replace(/,\s*([}\]])/g, '$1');
}

function parseJSON(text) {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const extracted = extractFirstJSONObject(cleaned);
    if (!extracted) throw new Error('No JSON object found in model output');
    try {
      return JSON.parse(extracted);
    } catch {
      return JSON.parse(removeTrailingCommas(extracted));
    }
  }
}

function getProviderHint(errMessage = '') {
  const msg = String(errMessage).toLowerCase();
  if (!msg) return '请检查 API Key、模型名与网络连接';
  if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('permission') || msg.includes('forbidden')) {
    return 'API Key 无效或权限不足，请检查 .env 的 Key 与项目配额';
  }
  if (msg.includes('model') && (msg.includes('not found') || msg.includes('invalid'))) {
    return '模型名不可用，请检查 .env 中 GEMINI_MODEL / CLAUDE_MODEL';
  }
  if (msg.includes('quota') || msg.includes('rate') || msg.includes('429')) {
    return '调用额度不足或触发限流，请稍后重试或提升配额';
  }
  return '请检查 API Key、模型名与网络连接';
}

const REQUIRED_FIELDS = ['name', 'name_en', 'era', 'avatar_emoji', 'avatar_color', 'quote', 'quote_attribution', 'personal_advice', 'wisdom_tags'];

app.post('/api/match', async (req, res) => {
  const ip = req.ip || 'unknown';
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: '请求太频繁，请稍后再试' });
  }

  const { problem, gemini_model: requestedGeminiModel } = req.body;
  if (!problem || typeof problem !== 'string') {
    return res.status(400).json({ error: '请输入你的困境' });
  }
  const trimmed = problem.trim();
  if (trimmed.length < 5 || trimmed.length > 300) {
    return res.status(400).json({ error: '请输入 5-300 字的内容' });
  }

  const selectedGeminiModel = resolveGeminiModel(requestedGeminiModel);

  let rawText;
  try {
    rawText = PROVIDER === 'claude'
      ? await callClaude(trimmed)
      : await callGemini(trimmed, selectedGeminiModel);
  } catch (err) {
    console.error('LLM error:', err.message);
    return res.status(502).json({
      error: 'AI 服务暂时不可用，请稍后重试',
      hint: getProviderHint(err.message),
      provider: PROVIDER,
    });
  }

  let data;
  try {
    data = parseJSON(rawText);
  } catch {
    // Retry once
    try {
      rawText = PROVIDER === 'claude'
        ? await callClaude(trimmed)
        : await callGemini(trimmed, selectedGeminiModel);
      data = parseJSON(rawText);
    } catch (err) {
      console.error('JSON parse error:', rawText);
      return res.status(500).json({
        error: '解析结果失败，请重试',
        hint: '模型返回格式不稳定，已自动重试。请再次提交一次；若持续失败可切换 LLM_PROVIDER',
        provider: PROVIDER,
      });
    }
  }

  for (const field of REQUIRED_FIELDS) {
    if (!data[field]) {
      return res.status(500).json({ error: '返回数据不完整，请重试' });
    }
  }

  const profile = getProfileByName(data.name) || getProfileByName(data.name_en);
  if (profile) {
    data.wikipedia_summary = profile.summary;
    data.wikipedia_story = profile.extract;
    data.wikipedia_url = profile.wiki_url;
    data.wikipedia_image = profile.image_url;
  }

  res.json({ success: true, data });
});

app.get('/health', (_, res) => res.json({
  ok: true,
  provider: PROVIDER,
  gemini_default_model: DEFAULT_GEMINI_MODEL,
  gemini_allowed_models: ALLOWED_GEMINI_MODELS,
  profile_count: getProfileCount(),
}));

app.listen(PORT, () => {
  console.log(`\n🌸 历史女性导师匹配器 启动成功`);
  console.log(`   访问地址: http://localhost:${PORT}`);
  console.log(`   AI 模型: ${PROVIDER === 'gemini' ? DEFAULT_GEMINI_MODEL : CLAUDE_MODEL}`);
  if (PROVIDER === 'gemini') {
    console.log(`   可选 Gemini 模型: ${ALLOWED_GEMINI_MODELS.join(', ')}`);
  }
  if (PROVIDER === 'gemini' && !process.env.GEMINI_API_KEY) {
    console.log('   ⚠ 缺少 GEMINI_API_KEY');
  }
  if (PROVIDER === 'claude' && !process.env.ANTHROPIC_API_KEY) {
    console.log('   ⚠ 缺少 ANTHROPIC_API_KEY');
  }
  console.log('');
});
