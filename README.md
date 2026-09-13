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
