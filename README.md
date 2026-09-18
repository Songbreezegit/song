# 松屿 SONG ISLE · 个人技术空间与数字档案

> **品牌**：松屿 (SONG ISLE) 
> **核心定位**：个人技术内容与项目展示空间（“技术网站 × 编辑杂志 × 个人数字空间”）  
> **设计系统**：Quiet Digital · Minimal · Technical · Calm · Refined · Digital Island  
> **基础色板**：底色 `#F7F8FA` · 主字 `#111827` · 次级字 `#64748B` · 细边框 `#E5E7EB` · 强调色 `#6F88B5`

---

## 🧭 信息架构与路由

| 路由路径 | 页面定位 | 核心功能与视觉展现 |
| :--- | :--- | :--- |
| `/` | **首页 (Home)** | Hero（Logo、Quiet Editorial 标语、两大核心 CTA）、最新文章编辑列表、精选项目视觉卡片、小巧 Now 状态栏 |
| `/articles` | **文章专栏 (Articles)** | 类似技术杂志/数字档案列表，按年份（2026 -> 09.08）排版，支持分类、标签与即时搜索 |
| `/articles/:slug` | **文章详情 (Article Detail)** | 深度阅读体验，包含阅读进度指示条、排版层级、语法高亮代码块（支持一键复制）、数据对比表格、引言与上下篇导航 |
| `/projects` | **作品集 (Projects)** | 视觉主体卡片（包含 Android App 原生界面、WebGL 拓扑图、CLI 终端界面模拟）、一句话简介、技术栈胶囊、源码与外链 |
| `/projects/:slug` | **项目详情 (Project Detail)** | 完整工程规格结构：项目名称、一句话定位、Hero 视觉图、Overview 背景、核心特性列表、架构思考、挑战与解法 |
| `/about` | **关于松屿 (About)** | 真实学生/开发者个人自述（拒绝虚构工作年限与简历套话）、CURRENTLY 近况状态、个人数字空间信条、GitHub 与 Email 联系卡片 |

---

## 🌐 国际化支持 (Internationalization)

松屿 · SONG ISLE 采用显式语言前缀与模块化 i18n 架构，支持三种语言：

- **简体中文**：`zh`（路由前缀 `/zh/`，默认 SEO `zh-CN`）
- **English**：`en`（路由前缀 `/en/`，SEO `en`）
- **日本語**：`ja`（路由前缀 `/ja/`，SEO `ja`）

### 1. 路由与访问规范
- **根路径检测**：访问 `/` 会自动读取用户偏好 (`localStorage.getItem('preferred-language')`) 或浏览器语言首选，自动重定向至对应语言主页（如 `/zh/` 或 `/en/`）。
- **页面映射**：各核心页面均对应显式 URL：
  - 中文：`/zh/`, `/zh/work`, `/zh/notes`, `/zh/about`, `/zh/contact`
  - 英文：`/en/`, `/en/work`, `/en/notes`, `/en/about`, `/en/contact`
  - 日文：`/ja/`, `/ja/work`, `/ja/notes`, `/ja/about`, `/ja/contact`
- **语言切换**：点击导航栏中的语言切换器（桌面端：`中 / EN / 日`，移动端：抽屉菜单按钮）时，会保持用户当前浏览的页面与查询参数（例如从 `/zh/work?project=lizhang` 平滑切换到 `/en/work?project=lizhang`）。

### 2. 语言字典目录结构
所有界面与页面文案按模块分离，存放于 `src/locales/`：
```text
src/locales/
├── zh/    # 简体中文
│   ├── common.json  # 通用 UI、按钮、导航、Footer、404
│   ├── home.json    # 首页 Hero 与核心标语
│   ├── work.json    # 作品集 UI 与弹窗文案
│   ├── notes.json   # 笔记 UI、分类与空状态
│   ├── about.json   # 关于我、技能、经历
│   └── contact.json # 联系方式与社交链接
├── en/    # English (自然地道表达)
└── ja/    # 日本語 (現代的なWebスタイル)
```

### 3. 如何新增翻译条目
在对应模块的 JSON 文件（如 `common.json`）中添加键值对：
```json
{
  "actions": {
    "myNewButton": "按钮文本"
  }
}
```
在 React 组件中直接通过 `useI18n` 消费：
```tsx
const { t } = useI18n();
<button>{t('common.actions.myNewButton')}</button>
```

### 4. 如何扩展新语言（如 `fr`, `de` 等）
1. 在 `src/i18n/types.ts` 中的 `SupportedLanguage` 联合类型中增加对应代码。
2. 在 `src/i18n/config.ts` 中的 `SUPPORTED_LANGUAGES` 数组与 `LANGUAGE_METAS` 中注册该语言的简写、全名及 HTML/OG 属性。
3. 在 `src/locales/<lang>/` 目录下添加对应的 6 个 JSON 字典文件并在 `src/i18n/dictionaries.ts` 中引入。

### 5. Work / Notes 内容的多语言维护
- **作品 (Work)**：项目详情字段定义在 `src/data/projectTranslations.ts`，支持按 `slug` 为特定语言定制 `title`、`subtitle`、`description`、`features` 与 `developmentNotes`。调用 `resolveProject(project, lang)` 即可自动根据语言回退解析。
- **笔记 (Notes)**：支持灵活的内容回退机制（Fallback 顺序：`ja -> en -> zh`，`en -> zh`，`zh -> zh`）。对于暂未人工翻译的文章，系统会自动展示中文原文并在详情内温和提示当前语言状态，绝不触发 404。

---

## 🎨 视觉系统与排版规范

- **背景与表面**：页面主背景采用柔和素雅的 `#F7F8FA`，容器采用纯白 `#FFFFFF`，通过 1px 细发丝边框 `#E5E7EB` 划分层级，绝无厚重刺眼的投影或高饱和霓虹色。
- **冷青强调色**：使用冷蓝灰 `#6F88B5` 作为主强调色，仅在 CTA 按钮、Hover 交互与小面积指示点处克制使用，保持全站大面积中性灰的平静质感。
- **字体系统**：
  - 中文主标题：`Noto Serif SC`（优雅衬线体，人文工匠气质）
  - 正文与英文 UI：`Plus Jakarta Sans` / `Inter`（清晰、易读现代无衬线体）
  - 代码与标签：`JetBrains Mono`（紧凑等宽体）
- **极简深色 Loading 屏**：
  - 采用深色极简背景 `#0B0F17`，展示高清 Logo Symbol 与“松屿 SONG ISLE”字符。
  - 缓慢优雅缩放淡入（耗时约 900ms），随后整体平滑渐入主页面。
  - 严格剔除廉价的“Loading 63%”数字百分比与复杂陀螺仪；尊重用户的 `prefers-reduced-motion` 辅助功能设置。

---

## 🛠️ 本地运行与构建

```bash
# 进入项目目录
cd d:\code\song

# 启动本地开发服务 (支持 HMR 秒级热更)
npm run dev

# 生产环境编译构建 (TypeScript 严格检查 + Vite 优化压缩)
npm run build

# 本地预览生产构建
npm run preview
```
