# SONG ISLE 深色视觉系统与圆形主题切换

开发分支：`feat/theme-circular-transition`。视觉系统最初基线：`c7bc246ed5843aff836828eb5bdeb559d0879c2f`（2026-10-04 的 `origin/main`）。

## 色板与 Token

深色模式采用 Neutral Charcoal + Soft Sage Accent：背景以中性炭黑和低饱和深灰分层，Sage 用于导航状态、标题强调、图标、射线、状态线及交互强调。浅色模式保持原有有效值。

所有基础颜色和旧 token 别名统一在 `src/index.css` 的 `:root` / `.dark` 中。`home-calibration.css` 只消费这些 token，将各 section 的 `--section-tint` 映射到对应背景；保留原有 16% / 82% 渐变结构。`App.css` 不再声明插画反色规则。

| Token / 区域 | 原深色 | 新深色 |
| --- | --- | --- |
| 页面 / Home / `paper` | `#20251F` | `#161916` |
| Work / `work` | `#252D24` | `#1A1E1A` |
| Notes | `#222820` | `#181B18` |
| About / `about` | `#252E2D` | `#1B1F1E` |
| Contact | `#252A22` | `#191C19` |
| Footer | `#23271F` | `#141714` |
| `surface-white` / `card` | `#2C342A` | `#212521` |
| `surface-sage` / `sage-soft` / `soft-green` | `#35422E` | `#273027` |
| `surface-blue` | `#303D3E` | `#252C2F` |
| `surface-yellow` | `#3E3D2C` | `#2D2A22` |
| `surface-pink` | `#403533` | `#2E2625` |
| `ink` | `#F2F3E9` | `#F1F3EE` |
| `muted` | `#B0B9AC` | `#A7AEA6` |
| 更弱文字 `ink-tertiary` | 使用 `muted` | `#889088` |
| `line` | `#3A4437` | `#343A34` |
| 次按钮边框 `line-strong` | 使用 `line` | `#3A4039` |
| `sage-primary` / `sage` | `#ACC3A8` | `#9FB59E` |
| `sage-faint` | `#252D24` | `#1E241E` |
| `blue-soft` / `soft-blue` | `#303D3E` | `#252D30` |
| `blue-faint` | `#252E2D` | `#1E2325` |
| 主 CTA 背景 / 文字 | `#F2F3E9` / `#20251F` | `#ECEEE8` / `#171A17` |

Notes 主卡改用中性 surface，About 卡片继续保留低饱和语义色；通过 1px 内描边表达边界，不改变盒模型或尺寸。次 CTA 使用深色 surface 和低对比边框，hover 只轻微改变底色。Header 沿用页面基底、暖白 Logo、muted 导航及现有细边框。

## 图片与 Filter

| 原规则 | 最终处理与理由 |
| --- | --- |
| 人物及 Work / Notes / About / Contact 插画 `invert(.9) hue-rotate(180deg) grayscale(.25)` | 删除。原 WebP 已有浅色人物、猫和自然植物，保留原色。 |
| 人物和插画容器 `#F3F5ED` 矩形底、26px 圆角 | 删除。改用中心 `#2B2F2B` 向透明淡出的弱局部径向底色，让黑色线条与炭黑分离。 |
| Logo、Loader Logo `invert(1)` | 删除。原 Logo 含 Sage 圆点，使用原 WebP 的 alpha mask，文字着暖白，圆点着 Sage；原图继续保留固有尺寸与可访问名称。 |
| Floating Badge `brightness(.85)` | 删除。保留资源自身颜色，不整体压暗。 |
| Scroll 文字 `brightness(2.5)` | 降为 `brightness(1.8)`，与其他手写文字保持同级。 |
| Divider / Notes Slogan / Work Slogan `brightness(1.8)` | 保留。仅用于原本颜色较深的手写文字和细线资源，保障炭黑上的局部可读性；不应用于人物、猫、植物或卡片。 |
| 叶片 / Work Cover 的 `blur()` | 保留既有装饰和封面层次，不作为主题颜色补救。 |
| Header / Dialog 的既有 `backdrop-filter` | 原样保留既有滚动 Header 与弹窗行为，没有新增颜色补救滤镜。 |

`html`、`body`、`#root`、`main` 均无主题滤镜。没有新增负片、整页蒙层、发光阴影或资源替换。

## 实现

`ThemeProvider` 持有主题状态和独立的切换控制器。点击 Navbar 或 404 的 Moon / Sun 按钮时，使用按钮 `getBoundingClientRect()` 的几何中心作为圆心；键盘激活使用相同位置。调用方未提供圆心时，使用当前 viewport 中心。

等待快照 `ready` 后，以快照坐标中的 CSS 像素计算圆心和最大半径。移动端快照包含可收起的浏览器地址栏，其原点和尺寸可能不同于页面 viewport；不能直接把 `getBoundingClientRect()` 和 `innerHeight` 用作快照动画几何。

切换期间临时插入一个固定在 viewport 原点、零尺寸且透明的 `.theme-transition-origin`，赋予独立 `view-transition-name: theme-origin`。读取其快照组 transform 与 DOM rect 的差值，得到 viewport 到快照的偏移；再扣除根快照组的 transform。标记无绘制内容、不参与布局，辅助技术忽略，完成、失败及卸载时均移除。标记的默认快照动画也关闭。

```ts
x = rect.left + rect.width / 2 + viewportToSnapshotX - rootSnapshotX;
y = rect.top + rect.height / 2 + viewportToSnapshotY - rootSnapshotY;
// width / height 来自 ::view-transition-group(root) 的实际计算尺寸。
radius = Math.hypot(
  Math.max(x, snapshotWidth - x),
  Math.max(y, snapshotHeight - y),
) + 2;
```

`document.startViewTransition()` 的更新回调通过 `flushSync()` 同步完成 React 状态、`html.dark` 和 `song_theme` 存储更新。等待 `ready` 后，仅对 `::view-transition-new(root)` 使用 Web Animations API，执行 `circle(0px …)` 到 `circle(radiuspx …)` 的展开，时长统一为 `520ms`，easing 为 `cubic-bezier(0.4, 0, 0.2, 1)`，fill 为 `both`。桌面、移动端和不同 viewport 都使用相同时长，不动态调整。

旧快照始终保持不透明并置于底层，新快照在上层揭示。关闭浏览器默认 cross-fade 和根快照组动画，两种切换方向使用同一规则。没有页面缩放、位移或额外图标动效。

快照捕获期间临时添加 `.theme-transitioning`，只抑制现有 Header、CTA、笔记按钮、语言按钮的主题颜色过渡；CTA 的 transform、卡片 hover、Hero、pointer shift 和 reveal 动效继续保留。`ready` 后恢复原有颜色过渡。

初始存储主题在 `useLayoutEffect` 中于首次 React 绘制前应用，不创建 View Transition。存储读取失败时默认浅色，写入失败不影响主题切换。

## 回退和并发

不支持 View Transition / Web Animations，或开启 `prefers-reduced-motion: reduce` 时，直接同步切换主题。API 启动、快照或伪元素动画失败时保留正常的主题更新并清理临时状态。

从快照开始到 `transition.finished` 期间忽略重复请求，不积压切换任务。只锁主题切换，不设置全页面 `pointer-events: none`。Provider 卸载时取消活动动画并阻止延迟回调更新旧页面。

## 修改文件

| 文件 | 用途 |
| --- | --- |
| `src/context/themeTransition.ts` | 520ms 圆形展开、移动端快照坐标转换及尺寸测量、回退与重复请求保护 |
| `src/index.css` | 基础色板、深色视觉、快照层级与关闭默认淡化；零尺寸坐标标记 |
| `src/home-calibration.css` | 移除重复色板与 Scroll 亮度覆盖；保持 section 映射及原有布局 |
| `src/App.css` | 删除插画整体反色规则 |
| `tests/theme-transition.test.ts` | 状态和存储、几何、回退、并发、失败和取消测试 |
| `tests/e2e/theme-transition.spec.ts` | 多尺寸与键盘操作；移动端地址栏坐标回归及末帧和实时页面像素衔接 |
| `tests/e2e/theme-palette.spec.ts` | 五种分辨率、三语言、色板对比度、无插画滤镜、布局保持及截图 |
| `docs/theme-circular-transition.md` | 实现与验证记录 |

2026-10-04 视觉系统调整共修改 8 个文件；2026-10-05 移动端修复修改控制器、标记 CSS、两组主题测试和本文档，共 5 个文件。Provider、按钮及 CSP 测试实现沿用先前提交。

`public/_headers`、页面布局、响应式尺寸、文案、多语言资源、后台、数据库及安全配置保持原样。

## 验证方法

使用已安装的 Microsoft Edge `154.0.4258.53`（Playwright channel `msedge`）。新增 E2E 页面测试使用本地未配置后端的服务；CSP 和既有回归使用受控 HTTP 数据，不写入生产数据库。

覆盖 zh / en / ja，首页、Work、Notes、About、Contact、404，PC 和手机尺寸，两种切换方向、偏离按钮中心的点击和键盘 Enter。额外验证超宽屏、16:9、4:3、手机横屏和 1.5 倍像素密度。原有手机用例仅设置 viewport；新增移动端回归启用 `isMobile`、触摸输入和 Pixel 5 的像素密度。

新增色板验收覆盖 `1920×1080`、`1600×900`、`1440×900`、`1280×800`、`390×844`，三语言与深浅色共 210 张 Home / Work / Notes / About / Contact / Footer / 404 截图。断言正文对比度至少 4.5:1、主标题和 CTA 至少 7:1、section 的 RGB 色差不超过 6、背景保持非纯黑；深浅色几何尺寸完全一致，页面无横向溢出，人物、插画、Badge 和 Logo 无颜色滤镜。

浅色保持检查在同一稳定 DOM 上，注入本轮之前的完整样式层叠，再与当前样式逐像素比较。五种分辨率、三语言、七个区域共 105 组比较，像素差异全部为 0，布局尺寸也与改动前基准一致。字体请求在测试中统一采用系统回退；人工复查包含中文桌面和手机首页 / Notes、日文 Work / 404、英文 About / 手机 Contact。

真实截图测试在 PC / 手机、主页 / 404 的两个方向，暂停原生动画并采样 0ms、156ms、520ms 位置。比较不透明背景像素，断言 0ms 保持旧主题，中间帧圆内等于新主题、圆外等于旧主题，终点覆盖 viewport；避开圆边界的抗锯齿像素。截图保存在对应 `test-results` 目录并作为 Playwright 附件。本机完整对照另保存在 `D:\code\PNG\song-theme-qa`。

执行命令：

```powershell
npm run lint
npm test
npm run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:e2e
npm run test:security
git diff --check
```

2026-10-04 最终结果：

| 检查 | 结果 |
| --- | --- |
| `npm run lint` | 通过 |
| `npm test` | 109 项通过（主题控制器测试 19 项） |
| `npm run build` | TypeScript 与 Vite 生产构建通过 |
| `npm run test:e2e` | 110 项通过、1 项既有可选真实封面测试跳过；主题动画测试 58 项、色板测试 15 项全部通过 |
| `npm run test:security` | 10 项通过，包含主页 / 404、Report-Only / Enforced CSP 下的双向动画测试 4 项 |
| 新增测试文件单独 TypeScript 检查 | 通过 |
| `git diff --check` | 通过 |

真实截图的圆内 / 圆外像素检查在 PC 和手机、主页和 404、深浅色双向均通过。首次保存深色恢复、API 不支持、减少动态效果、存储不可用和快速连点测试均通过。

原生 API 时序参考：[ViewTransition.ready](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition/ready)；React 同步提交参考：[flushSync](https://react.dev/reference/react-dom/flushSync)。

## 2026-10-05 移动端坐标修复

用户报告安卓 Chrome 首页顶部切换时圆心偏上、左下角漏覆盖，动画结束后页面才整体变色。根因是页面 viewport 与 View Transition 的 snapshot containing block 坐标混用；移动端可收起的地址栏属于快照区域。参考 [W3C 快照区域定义](https://www.w3.org/TR/css-view-transitions-1/#snapshot-containing-block) 与 [CSSWG 安卓 Chrome 坐标示例](https://github.com/w3c/csswg-drafts/issues/11456)。

本机没有可连接的安卓设备。使用 Chromium/Edge 的移动端模拟和原生 View Transition，通过只调整快照伪元素的区域、图像定位和标记 transform，重现地址栏造成的坐标差。页面本身的位置与尺寸保持一致，截图仍来自浏览器真实渲染；此方法验证坐标回归，不声称是真机 Chrome 地址栏测试。

新增 6 个场景：无地址栏、顶部 56px、底部 56px、顶部 56px + 底部 48px、滚动后顶部 28px、404 顶部 56px。各场景验证深浅两个方向的 0ms / 156ms / 520ms / 动画结束后截图：圆内新主题、圆外旧主题，末帧与实时页面四角及边缘像素一致，尤其检查左下角，不以动画末帧自身作为唯一参照。

旧提交 `f81a1c1` 与修复版本在相同场景对照：按钮中心为 `(301, 35.5)`，顶部 56px、底部 48px。旧实现将圆心写为 `(301, 35.5)`，屏幕中实际偏上 56px；520ms 左下角仍为浅色 `(250, 250, 247)`，结束后突变深色 `(22, 25, 22)`，最大通道差 228。修复后快照圆心为 `(301, 91.5)`，映射回屏幕与按钮重合；四角末帧与结束后差值均为 0。对照截图及数据保存在 `D:\code\PNG\song-theme-qa\mobile-*`。

本轮验证结果：`npm run lint` 和生产构建通过；`npm test` 115 项通过（控制器 25 项）；`npx playwright test tests/e2e/theme-transition.spec.ts` 64 项通过（包含新增 6 个场景）；`npm run test:security` 10 项通过；新增/修改测试的独立 TypeScript 检查与 `git diff --check` 通过。未重跑与本次几何修复无关的后台浏览器用例和完整色板截图矩阵。移动端 6 个场景的完整逐帧截图另存于 `D:\code\PNG\song-theme-qa\mobile-snapshot-frames`。
