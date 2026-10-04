# SONG ISLE 深浅色圆形展开切换

开发分支：`feat/theme-circular-transition`。基线：`c7bc246ed5843aff836828eb5bdeb559d0879c2f`（最新 `origin/main`）。

## 实现

`ThemeProvider` 持有主题状态和独立的切换控制器。点击 Navbar 或 404 的 Moon / Sun 按钮时，使用按钮 `getBoundingClientRect()` 的几何中心作为圆心；键盘激活使用相同位置。调用方未提供圆心时，使用当前 viewport 中心。

最大半径使用切换瞬间的 CSS 像素计算：

```ts
x = rect.left + rect.width / 2;
y = rect.top + rect.height / 2;
radius = Math.hypot(
  Math.max(x, window.innerWidth - x),
  Math.max(y, window.innerHeight - y),
) + 2;
```

`document.startViewTransition()` 的更新回调通过 `flushSync()` 同步完成 React 状态、`html.dark` 和 `song_theme` 存储更新。等待 `ready` 后，仅对 `::view-transition-new(root)` 使用 Web Animations API，执行 `circle(0px …)` 到 `circle(radiuspx …)` 的展开，时长 `420ms`，easing 为 `cubic-bezier(0.4, 0, 0.2, 1)`，fill 为 `both`。

旧快照始终保持不透明并置于底层，新快照在上层揭示。关闭浏览器默认 cross-fade 和根快照组动画，两种切换方向使用同一规则。没有页面缩放、位移或额外图标动效。

快照捕获期间临时添加 `.theme-transitioning`，只抑制现有 Header、CTA、笔记按钮、语言按钮的主题颜色过渡；CTA 的 transform、卡片 hover、Hero、pointer shift 和 reveal 动效继续保留。`ready` 后恢复原有颜色过渡。

初始存储主题在 `useLayoutEffect` 中于首次 React 绘制前应用，不创建 View Transition。存储读取失败时默认浅色，写入失败不影响主题切换。

## 回退和并发

不支持 View Transition / Web Animations，或开启 `prefers-reduced-motion: reduce` 时，直接同步切换主题。API 启动、快照或伪元素动画失败时保留正常的主题更新并清理临时状态。

从快照开始到 `transition.finished` 期间忽略重复请求，不积压切换任务。只锁主题切换，不设置全页面 `pointer-events: none`。Provider 卸载时取消活动动画并阻止延迟回调更新旧页面。

## 修改文件

| 文件 | 用途 |
| --- | --- |
| `src/context/ThemeContext.tsx` | 同步主题提交、首次恢复、控制器生命周期 |
| `src/context/ThemeContextDefinition.ts` | 可选圆心类型和 Context API |
| `src/context/themeTransition.ts` | 存储、View Transition、半径、动画、回退和重复请求保护 |
| `src/components/Navbar.tsx` | 传入主页按钮中心 |
| `src/components/NotFoundPage.tsx` | 传入 404 按钮中心 |
| `src/index.css` | 快照层级、关闭默认淡化、临时颜色过渡抑制 |
| `tests/theme-transition.test.ts` | 状态和存储、几何、回退、并发、失败和取消测试 |
| `tests/e2e/theme-transition.spec.ts` | 多语言、页面、设备、键盘、首帧和真实截图测试 |
| `tests/security-browser/theme-transition.spec.ts` | 现有生产 CSP 下的双向动画测试 |
| `docs/theme-circular-transition.md` | 实现与验证记录 |

`public/_headers`、页面布局和色板、后台和数据库配置保持原样。

## 验证方法

使用已安装的 Microsoft Edge `154.0.4258.53`（Playwright channel `msedge`）。新增 E2E 页面测试使用本地未配置后端的服务；CSP 和既有回归使用受控 HTTP 数据，不写入生产数据库。

覆盖 zh / en / ja，首页、Work、Notes、About、Contact、404，PC 和手机，两种切换方向、偏离按钮中心的点击和键盘 Enter。额外验证超宽屏、16:9、4:3、手机横屏和 1.5 倍像素密度，圆心和半径始终使用 viewport CSS 像素。

真实截图测试在 PC / 手机、主页 / 404 的两个方向，暂停原生动画并采样 0ms、126ms、420ms 位置。比较不透明背景像素，断言 0ms 保持旧主题，中间帧圆内等于新主题、圆外等于旧主题，终点覆盖 viewport；避开圆边界的抗锯齿像素。截图保存在对应 `test-results` 目录并作为 Playwright 附件。

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
| `npm test` | 109 项通过（新增主题测试 19 项） |
| `npm run build` | TypeScript 与 Vite 生产构建通过 |
| `npm run test:e2e` | 90 项通过、1 项既有可选真实封面测试跳过；新增主题测试 53 项全部通过 |
| `npm run test:security` | 10 项通过，包含新增的主页 / 404、Report-Only / Enforced CSP 测试 4 项 |
| 新增测试文件单独 TypeScript 检查 | 通过 |
| `git diff --check` | 通过 |

真实截图的圆内 / 圆外像素检查在 PC 和手机、主页和 404、深浅色双向均通过。首次保存深色恢复、API 不支持、减少动态效果、存储不可用和快速连点测试均通过。

原生 API 时序参考：[ViewTransition.ready](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition/ready)；React 同步提交参考：[flushSync](https://react.dev/reference/react-dom/flushSync)。
