export interface Article {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  date: string;
  year: string;
  category: string;
  categorySlug: 'tutorial' | 'ai' | 'tools' | 'development' | 'notes';
  tags: string[];
  readTime: string;
  excerpt: string;
  content: {
    lead: string;
    sections: {
      heading?: string;
      body: string[];
      code?: {
        language: string;
        filename?: string;
        snippet: string;
      };
      quote?: string;
      table?: {
        headers: string[];
        rows: string[][];
      };
      callout?: {
        type: 'note' | 'tip' | 'warning';
        text: string;
      };
    }[];
  };
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: 'android' | 'web' | 'ai' | 'tools' | 'systems' | 'opensource' | 'notes';
  categoryLabel: string;
  year: string;
  featured: boolean;
  tagline: string;
  description: string;
  techStack: string[];
  githubUrl: string;
  liveUrl?: string;
  coverImage?: string;
  imageTheme: {
    bgColor: string;
    accentColor: string;
    type: 'mobile' | 'browser' | 'terminal' | 'grid' | 'ai' | 'photo';
  };
  overview: string;
  features: string[];
  developmentNotes: string;
  challengesSolutions?: {
    challenge: string;
    solution: string;
  }[];
}

export const PROFILE = {
  name: '松屿',
  englishName: 'SONG ISLE',
  role: 'Developer / Designer / Builder / Open Source',
  tagline: '松屿 builds useful things.',
  siteIntro: '写代码，做产品，探索有趣的技术与设计。喜欢极简、高效和有温度的数字体验。',
  currently: {
    text: 'Building small tools for a brighter day.',
    building: 'SONG ISLE (个人技术内容与数字空间系统)',
    learning: 'AI × Application Development (端侧与应用实践)',
    exploring: 'Developer Tools / AI / Web & Android',
    date: '2026.09',
  },
  basedIn: 'Chongqing, China',
  contact: {
    github: 'https://github.com/Songbreezegit',
    x: 'https://x.com/song_breezed',
    email: 'dogfishgcordialf@gmail.com',
    bilibili: 'https://space.bilibili.com',
  },
};

export const PROJECTS: Project[] = [
  {
    id: 'lizhang',
    slug: 'lizhang',
    title: 'LizhangApp',
    subtitle: '礼金记账',
    tagline: '一款专为人情往来与礼金支出定制的 Android 原生应用',
    category: 'android',
    categoryLabel: 'Android / Compose',
    year: '2024',
    featured: true,
    description: '基于 Jetpack Compose 构建的 Android 记账应用，注重交互细节与全本地离线隐私保护，杜绝人情对账糊涂账。',
    techStack: ['Android', 'Kotlin', 'Jetpack Compose', 'Room Database', 'Material 3', 'MVI'],
    githubUrl: 'https://github.com/Songbreezegit/lizhang',
    liveUrl: '',
    imageTheme: {
      bgColor: '#1E293B',
      accentColor: '#22C55E',
      type: 'mobile',
    },
    overview: '中国传统人情往来频繁，礼金记录通常采用纸质礼簿或通用记账软件。LIZHANG 聚焦于“人”与“事”的交集，让每一笔礼尚往来清晰可溯。',
    features: [
      '人情收送双向账本：清晰记录收礼金额与送礼支出明细',
      '人情关系谱系：自动汇总特定亲朋好友的历史往来记录',
      '100% 离线优先：全本地 Room 数据库存储，完全不依赖外部网络',
      '快速检索与统计：支持按事由、时间、人物一键模糊筛选与对账',
      '本地备份与导出：支持标准加密数据包导出与恢复',
    ],
    developmentNotes: '完全基于 Kotlin 与 Jetpack Compose 声明式 UI 体系开发，遵循现代 Android 架构指南（MVI / Clean Architecture）。',
    challengesSolutions: [
      {
        challenge: '人情往来关系在多人共同出资或多次往复时的数据结构扁平化难题',
        solution: '重构数据库关联表，将事件、账目条目与关联人三元解耦，支持灵活归属。',
      },
    ],
  },
  {
    id: 'online-exam',
    slug: 'online-exam',
    title: '在线考试与评测系统',
    subtitle: '高校评测平台',
    tagline: '高校在线考试与作业自动评测系统，包含实时防作弊监测与多维度分析',
    category: 'web',
    categoryLabel: 'Web / Fullstack',
    year: '2024',
    featured: true,
    description: '高校在线考试与作业自动评测系统，包含实时权限隔离、防作弊检测、自动判题与多维度成绩分析。',
    techStack: ['Vue 3', 'Spring Boot', 'MySQL', 'Redis', 'Docker', 'ECharts'],
    githubUrl: 'https://github.com/Songbreezegit',
    liveUrl: '',
    imageTheme: {
      bgColor: '#0F172A',
      accentColor: '#38BDF8',
      type: 'browser',
    },
    overview: '为高校计算机课程定制的教学考试平台，支持万人级高并发答卷提交、代码题目实时沙箱运行与成绩雷达图分布分析。',
    features: [
      '自动化判题引擎：支持多语言代码提交并在隔离容器中安全评测',
      '智能防作弊机制：监听切屏次数、焦点丢失及多端登录报警',
      '可视化成绩画像：动态生成班级知识点掌握度与分数段分布图',
      '高并发高可用：基于 Redis 缓存令牌桶限流与分布式锁设计',
    ],
    developmentNotes: '前端采用 Vue 3 组合式 API + TypeScript，后端采用 Spring Boot 微服务架构，配合 Docker 沙箱保证判题安全性。',
  },
  {
    id: 'dev-tools',
    slug: 'dev-tools',
    title: '开发者常用工具集',
    subtitle: '效率工具库',
    tagline: '个人日常高频使用的开发与效率工具集合，包含格式转换与自动化脚本',
    category: 'tools',
    categoryLabel: 'CLI / Tools',
    year: '2024',
    featured: true,
    description: '个人常用开发工具集，包含 API 测试、格式转换、Regex 正则调试与日常效率脚本。',
    techStack: ['TypeScript', 'Node.js', 'Rust', 'Tailwind CSS', 'CLI'],
    githubUrl: 'https://github.com/Songbreezegit',
    liveUrl: '',
    imageTheme: {
      bgColor: '#18181B',
      accentColor: '#A1A1AA',
      type: 'terminal',
    },
    overview: '日常开发中频繁需要进行时间戳转换、JWT 解析、Base64 编解码与 Cron 表达式验证。本工具集聚合了最常用的离线纯前端小工具。',
    features: [
      '毫秒级纯本地运行，不上传任何敏感开发数据',
      '支持终端 CLI 与桌面 Web 两种操作形态',
      '内置常用正则表达式生成与交互式高亮测试',
      '一键生成 mock 数据与 TypeScript 类型定义',
    ],
    developmentNotes: '核心算法采用 Rust 编译为 WebAssembly，保障大型文本处理时的零卡顿与高吞吐。',
  },
  {
    id: 'ai-lab',
    slug: 'ai-lab',
    title: 'AI Lab & 实验探索',
    subtitle: 'Agent 架构实践',
    tagline: '基于大语言模型与 Agent 架构的实验性应用探索，专注端侧与工作流智能',
    category: 'ai',
    categoryLabel: 'AI / Experiment',
    year: '2025',
    featured: true,
    description: '基于大语言模型与 Agent 架构的实验性应用探索，专注轻量级本地自动化与智能助手。',
    techStack: ['Python', 'Gemini API', 'LangChain', 'FastAPI', 'Ollama', 'RAG'],
    githubUrl: 'https://github.com/Songbreezegit',
    liveUrl: '',
    imageTheme: {
      bgColor: '#1E1B2E',
      accentColor: '#9381FF',
      type: 'ai',
    },
    overview: '探索大模型在个人知识管理与自动化编码中的应用落地。测试本地量化小模型与云端前沿模型的混合作业模式。',
    features: [
      '多模型路由调度：本地小模型负责初筛，云端大模型负责复杂推理',
      'Markdown 语义切片 RAG 引擎，代码片段命中率提升 40%',
      '工具调用（Function Calling）与任务规划循环自动化',
    ],
    developmentNotes: '基于 Python 异步协程池与 SSE 流式推送协议，提供低延迟打字机式对话体验。',
  },
  {
    id: 'open-source',
    slug: 'open-source',
    title: '开源贡献与社区代码',
    subtitle: 'GitHub 开源',
    tagline: '积极参与开源社区建设，持续维护个人开源工具库与提交实用 PR',
    category: 'opensource',
    categoryLabel: 'Open Source',
    year: '2024',
    featured: true,
    description: '在 GitHub 上的开源贡献与个人代码库维护，分享好用的脚手架、组件与中文技术文档。',
    techStack: ['GitHub', 'TypeScript', 'Kotlin', 'Rust', 'Git'],
    githubUrl: 'https://github.com/Songbreezegit',
    liveUrl: 'https://github.com/Songbreezegit',
    imageTheme: {
      bgColor: '#0B132B',
      accentColor: '#4ADE80',
      type: 'grid',
    },
    overview: '热爱开源精神，坚持将日常探索中有价值的代码进行解耦与开源。包括通用 Hooks 库、轻量 CLI 工具和模板项目。',
    features: [
      '遵循规范的 Git Commit 消息与自动化语义发版 CI',
      '提供详尽的中英文双语使用文档与交互式 Demo',
      '及时响应社区 Issue 与合并高质量 Pull Request',
    ],
    developmentNotes: '坚持单元测试覆盖率 > 85%，采用 GitHub Actions 自动化执行跨平台矩阵测试。',
  },
  {
    id: 'fuji-photo',
    slug: 'fuji-photo',
    title: '富士色彩与摄影笔记',
    subtitle: '生活切片与胶片',
    tagline: '记录技术之外的真实生活切片，光影与街头观察。用镜头捕捉生活的细微瞬间',
    category: 'notes',
    categoryLabel: 'Photography / Notes',
    year: '2024',
    featured: true,
    description: '胶片与摄影记录、技术之外的生活切片。捕捉山城重庆的立体光影与安静街巷。',
    techStack: ['Fujifilm X-T', 'Film Simulation', 'Lightroom', 'Editorial'],
    githubUrl: 'https://github.com/Songbreezegit',
    liveUrl: '',
    coverImage: '/assets/work/work-project-cover-fuji.webp',
    imageTheme: {
      bgColor: '#2E2822',
      accentColor: '#F59E0B',
      type: 'photo',
    },
    overview: '代码是逻辑的世界，摄影是感知的世界。通过镜头定格瞬时的光线、烟火气与安静角落，为漫长的编码生活提供呼吸感。',
    features: [
      '经典 Classic Chrome 与 Classic Neg 配色调优记录',
      '山城重庆立体城市风貌与夜色倒影辑录',
      '极简构图与留白视觉探索',
    ],
    developmentNotes: '采用纯前端轻量画廊实现，支持 WebP 无损压缩与按需渐进加载。',
  },
  {
    id: 'plantly',
    slug: 'plantly',
    title: 'Plantly',
    subtitle: '绿植养护助手',
    tagline: '极简清新的个人室内绿植养护与浇水提醒小工具，关注植物的每一次抽芽',
    category: 'web',
    categoryLabel: 'Web / React',
    year: '2025',
    featured: false,
    description: '极简植物养护记录与提醒小工具，陪伴桌面上的每一抹绿色生长。',
    techStack: ['React', 'TypeScript', 'Tailwind CSS', 'IndexedDB', 'PWA'],
    githubUrl: 'https://github.com/Songbreezegit',
    liveUrl: '',
    imageTheme: {
      bgColor: '#064E3B',
      accentColor: '#34D399',
      type: 'browser',
    },
    overview: '办公室和家里的绿植经常因忘记浇水而枯萎，或因浇水过频而烂根。Plantly 以极简的日历和提醒机制，让植物护理变得轻松可控。',
    features: [
      '自适应浇水周期算法，随季节气温智能调整',
      '植物健康生长相册与叶片变化对比',
      '支持 PWA 本地离线安装与桌面角标提醒',
    ],
    developmentNotes: '采用轻量 IndexedDB 作为端侧存储引擎，支持多设备一键导入导出。',
  },
  {
    id: 'orbit',
    slug: 'orbit',
    title: 'Orbit',
    subtitle: '专注时钟与白噪音',
    tagline: '极简番茄钟、沉浸式雨声与波形声效，营造不被打扰的深度工作心流',
    category: 'tools',
    categoryLabel: 'Web / Audio',
    year: '2025',
    featured: false,
    description: '极简白噪音与专注时钟，纯粹的时间流逝动效，屏蔽外部噪音，保持心流。',
    techStack: ['React', 'Web Audio API', 'Canvas API', 'TypeScript'],
    githubUrl: 'https://github.com/Songbreezegit',
    liveUrl: '',
    imageTheme: {
      bgColor: '#1E293B',
      accentColor: '#38BDF8',
      type: 'terminal',
    },
    overview: '在快节奏的信息流轰炸下，深度的单任务心流体验尤为珍贵。Orbit 去除所有繁杂统计，只保留纯粹的时间与声音。',
    features: [
      '基于 Web Audio API 的程序化自然白噪音合成器（雨滴、篝火、粉红噪波）',
      '流畅的环形天体轨道倒计时可视化',
      '全局快捷键启停与极简全屏沉浸模式',
    ],
    developmentNotes: '不依赖大体积音频文件，使用数学函数实时合成声波，打包体积不足 50KB。',
  },
  {
    id: 'flowy',
    slug: 'flowy',
    title: 'Flowy',
    subtitle: '思维整理大纲',
    tagline: '轻量级大纲折叠与思维导图双向切换工具，帮助理清复杂思绪',
    category: 'tools',
    categoryLabel: 'Tool / Canvas',
    year: '2025',
    featured: false,
    description: '极简大纲笔记与思维导图可视化工具，让思绪像溪流一样自然流淌。',
    techStack: ['TypeScript', 'Canvas API', 'Markdown', 'Vite'],
    githubUrl: 'https://github.com/Songbreezegit',
    liveUrl: '',
    imageTheme: {
      bgColor: '#111827',
      accentColor: '#F472B6',
      type: 'grid',
    },
    overview: '写长篇文章或设计系统架构前，需要一个没有摩擦力的思考画布。Flowy 支持大纲文本与图形节点的瞬时双向转换。',
    features: [
      'Tab / Shift-Tab 键盘驱动极速录入',
      '无限缩放平移的 Infinite Canvas 渲染',
      '标准 Markdown 树形大纲导入导出',
    ],
    developmentNotes: '自主实现轻量级节点碰撞检测与贝塞尔连接线渲染算法，性能极度轻快。',
  },
];

export const ARTICLES: Article[] = [
  {
    id: 'think-before-code',
    slug: 'think-before-code',
    title: '做产品之前先想清楚问题',
    subtitle: '探讨真实需求与代码实现的边界，拒绝伪需求陷阱',
    date: '2026.09.02',
    year: '2026',
    category: '思考',
    categorySlug: 'notes',
    tags: ['思考', '产品设计', '需求分析', '极简'],
    readTime: '3 min',
    excerpt: '很多时候我们急于写代码，却忽视了真实需求到底是什么。工具的本质是解决具体问题，而不是展示技术的复杂度。',
    content: {
      lead: '很多开发者（包括我自己）常有一种冲动：看到一个新框架或新技术，立刻想做一个项目来用上它。但如果产品本身解决的问题是虚假的，无论代码写得多么优雅，最终也只是一座无人问津的玩具。',
      sections: [
        {
          heading: '一、什么是真实的问题？',
          body: [
            '真实问题往往具有以下三个特征：在特定场景下有明确的痛点、现有方案成本过高或体验过于繁琐、解决后能带来实实在在的效率提升或心理满足。',
            '例如在开发礼金记账 LIZHANG 时，痛点非常具体：婚丧嫁娶时手写纸质礼簿字迹潦草、后续回礼时翻找极其繁琐。解决这个问题不需要区块链或复杂的机器学习，只需要一个离线、快速搜索、能按人物汇总的本地数据库。',
          ],
          quote: '“先找到钉子，再去挑选最适合的锤子；而不是举着锤子满世界找钉子。”',
        },
        {
          heading: '二、给功能做减法',
          body: [
            '当你想为一个工具增加第 10 个功能时，不妨先问问自己：去掉前 3 个功能，这个工具是否依然好用？',
            '克制是最好的设计。每一个增加的功能，都会增加用户的认知负荷与日后的维护成本。保持核心链路极简，才是产品长久生命力的保障。',
          ],
        },
      ],
    },
  },
  {
    id: 'frontend-motion',
    slug: 'frontend-motion',
    title: '最近在学的前端动画',
    subtitle: '从微交互到页面层级，如何建立克制且自然的动画节奏',
    date: '2026.08.28',
    year: '2026',
    category: '前端',
    categorySlug: 'development',
    tags: ['前端', '动画', 'CSS', 'UI/UX', '交互设计'],
    readTime: '5 min',
    excerpt: '从微交互到页面层级，克制且平滑的过渡往往比过度花哨的 3D 效果更有温度。动画应该服务内容，而不是抢夺注意。',
    content: {
      lead: '现代 Web 动画的审美正在从“炫耀能力”转向“润物无声”。优秀的动效应该像现实世界中的物理规律一样，让人感觉自然、可预测、符合直觉。',
      sections: [
        {
          heading: '一、动画的三种层级',
          body: [
            '1. 反馈层 (Feedback)：耗时 100~150ms。按钮点击、开关切换、焦点移动。必须快而果断。',
            '2. 过渡层 (Transition)：耗时 200~300ms。下拉菜单展开、卡片悬停浮起、标签切换。采用平滑缓动。',
            '3. 意境层 (Atmosphere)：耗时 3~5s 的低频微动。如徽章的微妙起伏、呼吸微光，带来生命感。',
          ],
          code: {
            language: 'css',
            filename: 'motion.css',
            snippet: `/* 经典的高级感减速曲线 */
--ease-editorial: cubic-bezier(0.22, 1, 0.36, 1);

/* 卡片悬停微浮 */
.card-hover {
  transition: transform 220ms var(--ease-editorial), box-shadow 220ms var(--ease-editorial);
}
.card-hover:hover {
  transform: translateY(-4px);
}`,
          },
        },
        {
          heading: '二、严禁为了动而动',
          body: [
            '永远不要让一个页面上的所有元素都在同时运动。那不是科技感，那是视觉灾难。静态时安静，交互时响应，这才是好的界面。',
          ],
        },
      ],
    },
  },
  {
    id: 'security-habit',
    slug: 'security-habit',
    title: '安全不是功能，是习惯',
    subtitle: '端侧加密、敏感数据脱敏与权限最小化开发原则',
    date: '2026.08.15',
    year: '2026',
    category: '安全',
    categorySlug: 'development',
    tags: ['安全', '离线优先', '隐私', '本地化', '架构'],
    readTime: '4 min',
    excerpt: '离线优先、本地数据存储、敏感信息脱敏与权限最小化原则。安全不是后期打补丁，而是从第一行代码就要种下的直觉。',
    content: {
      lead: '很多时候开发者把安全视为“上线前做个渗透测试”或者“加个 HTTPS”。但对于个人工具或独立应用而言，最好的安全是：压根不收集不必要的数据。',
      sections: [
        {
          heading: '一、离线即是最强的防御',
          body: [
            '如果一个工具不需要云端同步也能满足用户核心需求，那就坚决做成纯本地应用。数据保留在用户自己的设备沙盒中，不用担心云端泄露，也省去了服务器安全维护的庞大精力。',
          ],
        },
        {
          heading: '二、最小权限原则',
          body: [
            '在 Android 或 Web 开发中，只申请当前功能必须的权限。一个记账工具绝不申请通讯录、相册与地理位置权限。干净的应用更容易赢得用户的长期信赖。',
          ],
        },
      ],
    },
  },
  {
    id: 'thought-fragments',
    slug: 'thought-fragments',
    title: '思考记录碎片',
    subtitle: '记录一些平时闪现的灵感、踩坑经验与技术选型的权衡判断',
    date: '2026.08.01',
    year: '2026',
    category: '随笔',
    categorySlug: 'notes',
    tags: ['随笔', '碎片', '灵感', '思考'],
    readTime: '2 min',
    excerpt: '记录一些平时闪现的灵感、踩坑经验与技术选型的权衡判断。好的构想往往诞生于散步或洗澡的瞬间。',
    content: {
      lead: '灵感像抓不住的蝴蝶，如果不在出现的瞬间将其记在便签上，往往几分钟后就会忘得一干二净。这里收录了一些工作与生活中的碎片所感。',
      sections: [
        {
          body: [
            '• 代码的可读性高于编写时的快感：多写几个清晰的变量名，比用一行晦涩的三元嵌套要对未来的自己负责得多。',
            '• 技术栈不要追赶每一个浪潮：精通一套趁手的工具，能够帮你把 80% 的想法快速落地，剩下的 20% 再去探索新工具也不迟。',
            '• 偶尔从屏幕前走开：很多在工位前卡了两个小时的 Bug，往往在走出房间吹吹晚风的时候豁然开朗。',
          ],
        },
      ],
    },
  },
  {
    id: 'white-space-design',
    slug: 'white-space-design',
    title: '我喜欢的网页留白感',
    subtitle: '恰到好处的边距、呼吸感的网格与柔和的字体排版',
    date: '2026.07.22',
    year: '2026',
    category: '设计',
    categorySlug: 'notes',
    tags: ['设计', '留白', '排版', '极简美学'],
    readTime: '4 min',
    excerpt: '恰到好处的边距、呼吸感的网格与柔和的衬线标题，能让阅读变得舒缓而专注。留白不是空白，而是内容的呼吸空间。',
    content: {
      lead: '走进一家精致的独立书店，你会发现书本摆放得疏密有致，墙面有大片的留白；而在廉价的特卖场里，货架被塞得满满当当。数字界面也是一样的道理。',
      sections: [
        {
          heading: '一、留白的层次感',
          body: [
            '留白不是空无一物，而是建立信息层级的无形标尺。大留白区分区块，中留白区隔组件，微留白区隔段落与行距。',
            '当界面有了足够的呼吸空间，用户的注意力才能自然而然地聚焦在核心内容上。',
          ],
        },
        {
          heading: '二、色彩的克制',
          body: [
            '背景用柔和的暖白或深邃的暗灰，文字用高对比度的深黑与次级灰，强调色只在关键操作和品牌徽章上出现。整洁干净的色彩系统能够极大地缓解视觉疲劳。',
          ],
        },
      ],
    },
  },
  {
    id: 'small-ideas',
    slug: 'small-ideas',
    title: '一些没必要发长文的小想法',
    subtitle: '短小的代码技巧、命令行别名配置，以及那些只有几十行却极好用的小脚本',
    date: '2026.07.10',
    year: '2026',
    category: '碎片',
    categorySlug: 'notes',
    tags: ['碎片', '脚本', '命令行', '技巧'],
    readTime: '2 min',
    excerpt: '短小的代码技巧、命令行别名配置，以及那些只有几十行却极好用的小脚本。不需要长篇大论，管用就好。',
    content: {
      lead: '不是所有的知识都需要写成一篇三千字的大文章。很多时候，一个精巧的 Bash 别名、一行正则表达式，就能解决每天重复的机械动作。',
      sections: [
        {
          body: [
            '• Git 快速查看最近分支：配置 git alias.recent，一秒定位最近协作分支。',
            '• 快速清理本地 node_modules：使用 npx npkill，直观选择并清理磁盘中陈旧庞大的依赖包。',
            '• 轻量图片压缩：用 CLI 版 squoosh-cli 批量把 PNG 压制成高效 WebP。',
          ],
        },
      ],
    },
  },
  {
    id: 'knowledge-base',
    slug: 'knowledge-base',
    title: '如何建立自己的知识库',
    subtitle: '拒绝收藏夹吃灰，以写促学，用纯文本与版本管理打造可持续知识系统',
    date: '2026.06.28',
    year: '2026',
    category: '方法',
    categorySlug: 'notes',
    tags: ['方法', '知识管理', 'Markdown', '学习'],
    readTime: '6 min',
    excerpt: '拒绝收藏夹吃灰。以写促学，用纯文本 Markdown 与版本管理打造可持续的知识系统。',
    content: {
      lead: '许多人热衷于折腾各种复杂的双链笔记软件，花费大量时间配置插件、画脑图，但几个月过去，真正沉淀下来的原创内容却寥寥无几。',
      sections: [
        {
          heading: '一、用自己的语言复述',
          body: [
            '如果仅仅是把网上的文章剪藏进软件，那只是让你的硬盘装满了知识，而不是你的大脑。只有当你合上参考资料，用自己的语言把原理、步骤与踩坑点完整敲击出来，这个知识才真正属于你。',
          ],
        },
        {
          heading: '二、格式越简单，寿命越长久',
          body: [
            '纯文本 Markdown 文件加 Git 仓库，是历经几十年考验最健壮的数字资产组织形态。无论未来什么工具兴衰更替，纯文本在任何时代任何系统上都能随时打开并全文搜索。',
          ],
        },
      ],
    },
  },
  {
    id: 'stay-curious',
    slug: 'stay-curious',
    title: '保持好奇，持续学习',
    subtitle: '技术日新月异，最重要的不是掌握每种框架，而是保有探索未知的热情',
    date: '2026.06.14',
    year: '2026',
    category: '态度',
    categorySlug: 'notes',
    tags: ['态度', '成长', '好奇心', '探索'],
    readTime: '3 min',
    excerpt: '技术日新月异，最重要的不是掌握每种框架，而是保有探索未知的热情与动手的乐趣。',
    content: {
      lead: '前端从 jQuery 到 React，移动端从 Java 到 Kotlin Compose，AI 从专家系统到大语言模型。技术的名词永远在变，但解决实际问题的底层逻辑和探索未知的纯粹乐趣从未改变。',
      sections: [
        {
          heading: '一、像初学者一样思考',
          body: [
            '保持新手心态（Beginners Mind）。不要因为过去积累了一些经验就固步自封。面对新工具，带着好奇心动手试一试，往往会发现意想不到的新视角。',
          ],
        },
        {
          heading: '二、做自己真正喜欢的东西',
          body: [
            '在繁忙的日常开发之外，给自己留一点时间和空间，去写一个或许不赚钱但自己真心觉得很有趣、很酷的小玩意。这种心流体验是最好的充电方式。',
          ],
        },
      ],
    },
  },
  {
    id: 'clear-life',
    slug: 'clear-life',
    title: '记录，让生活更清晰',
    subtitle: '当把所思所想变成清晰的文字或代码时，杂乱的思路也就逐渐有了轮廓',
    date: '2026.05.30',
    year: '2026',
    category: '生活',
    categorySlug: 'notes',
    tags: ['生活', '记录', '写作', '随感'],
    readTime: '3 min',
    excerpt: '当把所思所想变成清晰的文字或代码时，杂乱的思路也就逐渐有了轮廓。生活也是一门需要迭代的工程。',
    content: {
      lead: '脑海中的杂念往往像一团乱麻，但在纸上或屏幕上一行行写下来之后，你会发现很多困惑和焦虑其实并没有想象中那么复杂。',
      sections: [
        {
          heading: '一、文字具有定型力量',
          body: [
            '写作是思考的高保真渲染。很多时候你以为自己想明白了，只有在试着向别人讲清楚或者写成文字时，才会暴露逻辑中的断点。',
          ],
        },
        {
          heading: '二、生活也是持续迭代的工程',
          body: [
            '像维护一个长期项目一样对待自己的生活与健康：设定清晰的边界、定期回顾反思、及时清理债务、永远对美好事物保持期待。',
          ],
        },
      ],
    },
  },
];

export const ABOUT_DATA = {
  greeting: '你好，我是松屿',
  role: 'Developer · Designer · Builder',
  bio: '一名专注于现代 Web 与移动端开发的个人开发者。热衷于把复杂的事情理顺，把朴素的功能做精致。喜欢做干净好用的工具，也喜欢生活中的小细节。',
  location: '中国 · 重庆 (Chongqing, China)',
  whatIDo: [
    { title: 'Android & Web Development', desc: '构建高响应、稳定可靠的端侧与全栈现代化应用' },
    { title: 'UI / UX & Interaction Design', desc: '探索克制有温度的排版、微动效与留白美学' },
    { title: 'Open Source & Developer Tools', desc: '写能为开发者解决实际痛点的开源工具与脚本' },
    { title: 'Continuous Writing & Learning', desc: '保持好奇，持续记录技术笔记与生活切片' },
  ],
  techStack: [
    { category: 'Frontend', items: ['TypeScript', 'React 19', 'Next.js', 'Tailwind CSS', 'Vite'] },
    { category: 'Mobile', items: ['Android', 'Kotlin', 'Jetpack Compose', 'Room', 'Material 3'] },
    { category: 'Backend & Systems', items: ['Node.js', 'Python', 'Rust', 'FastAPI', 'SQLite / Redis'] },
    { category: 'Design & Tools', items: ['Figma', 'Git', 'Neovim', 'Ghostty', 'Markdown'] },
  ],
  now: [
    { label: 'Building', value: 'SONG ISLE 数字空间与系列个人开源小工具' },
    { label: 'Learning', value: '端侧 LLM Agent 编排与高性能微动效系统' },
    { label: 'Living', value: '手冲咖啡、富士街头摄影、重庆火锅与慢走' },
  ],
  path: [
    { year: '2022', event: '写下第一行 Hello World，对用代码创造事物产生浓厚兴趣' },
    { year: '2023', event: '深入现代前端与 Android 生态，探索声明式 UI 与系统架构' },
    { year: '2024', event: '开发上线 LIZHANG 礼金记账等多款独立工具，沉淀工程规范' },
    { year: '2026', event: '构建松屿 (SONG ISLE)，持续输出高价值笔记与实用作品' },
  ],
};

export const CONTACT_DATA = {
  email: 'dogfishgcordialf@gmail.com',
  github: 'https://github.com/Songbreezegit',
  githubUser: '@Songbreezegit',
  x: 'https://x.com/song_breezed',
  xUser: '@song_breezed',
  bilibili: 'https://space.bilibili.com',
  bilibiliUser: '松屿 (Bilibili)',
  status: 'Open for freelance, interesting open-source collabs & discussions.',
};

