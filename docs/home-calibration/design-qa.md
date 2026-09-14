# Home 定向视觉优化验收

日期：2026-09-14。范围：Home、Header 尺度，以及全站背景和少量卡片表面色。

## 结果

通过本轮视觉验收，未发现阻断使用、内容裁切或横向溢出问题。不是像素级复刻：保留原有字体与真实文案，装饰使用已有资源及简单 SVG/CSS。没有生成或替换 PNG，没有修改框架与依赖。

## 1. Container / Header

Home 与 Header 使用 `min(86vw, 1400px)`，1536 宽时实测约 1321px，左右约 100px。Header 高 84px，三列 `1fr auto 1fr`；导航中心与内容视口中心差约 0.2px。Logo 174px，导航 16px / gap 44px，主题按钮 46px，Stay Curious 166 × 46px。

## 2. Title

桌面英文 `clamp(83.2px, 6.7vw, 112px)`，行高 .93，字距 -.05em；中文 1.17em。1536 下英文约 103px、中文约 120px，末行约 610px。移动端 `clamp(48px, 13.4vw, 58px)`。正文与原有文案保留。Home CTA 232 / 200px 宽、60px 高。

## 3. Illustration

桌面 `min(50.5vw, 790px)`，1440 / 1536 / 1600 下分别约 727 / 776 / 790px。1536 相对原 570px 上限扩大约 36%。插画靠右、靠下展开；负下边距用于吸收素材自带的透明尾部，完整保留人物、猫、方台和植物。没有裁切素材或缩放整个容器。Tablet 恢复容器内自适应，Mobile 94% 宽单列。

Home 实测高度约 780 / 794 / 807px（1440 / 1536 / 1600）；内容决定高度，不锁定 100vh。

## 4. Badge

桌面外框 320px，因原资源透明边距，实色可见宽约 240–260px。Now Building 保留原图的约 -10° 倾斜；Open Source 额外旋转 5°。继续使用原 6 秒、5px 浮动动画。移动端缩为 166 / 163px，不覆盖主文案。

## 5. Grid / Decoration

原网格图片扩展到整个 Home，桌面透明度 .13、手机 .10，并在上下边缘淡出。中文右上恢复 62px 的三笔 sage 射线；末行下方只覆盖 46% 的弧形手绘线。左下叶片 190px、透明度 .42、模糊 3px。Scroll 67px，继续使用静态文字与独立运动箭头；深色模式提升文字亮度。

## 6–7. 背景策略与颜色

统一基底 `#FAFAF7`。每个内容区使用基底 → 极淡区色 → 基底的纵向渐变，16% / 82% 作为主体色范围；相邻边界回到同一颜色。

| 区域 | 主体色 |
| --- | --- |
| Home | #FAFAF7 |
| Work | #F7F9F5 |
| Notes | #F9FAF7 |
| About | #F5F8F8 |
| Contact | #F9F9F5 |
| Footer | #F7F7F3 |

深色模式有独立 token，未强制使用浅色背景。

## 8. Card Surface

新增 white / sage / blue / yellow / pink、sage primary / soft / faint、blue soft / faint token。富士摄影卡片从 #E0E9F2 微调为 #E8EEF5；开发工具卡片 #E9EEE5 接入 sage surface。其他项目绿色、Notes 绿色、About 白卡及淡蓝生活卡保持原有层次，颜色经 token 统一。没有改变卡片布局、尺寸、内容或交互。

## 9. 浏览器验证

实际运行 `http://localhost:5173`，检查 1440、1536、1600、1024、768、430、390，所有断点 `scrollWidth <= clientWidth`。Windows 浏览器在 430 请求下有约 1px 的视口取整，记录保留实际值。

- Desktop：标题、插画、两枚 badge、按钮和 Status 均可见，导航居中。
- Tablet：双列布局仍可读，无文案与人物碰撞；Status 保留。
- Mobile：文案 → CTA → 插画 → Status；插画完整，状态可读，菜单跳转 Contact 后自动关闭。
- 从 Home 连续滚到 Contact / Footer，并在各区动画稳定后逐区复查；未出现明显色块分界。滚动过程中图片加载无损坏，控制台 error / warn 为空。
- 浅色 / 深色切换可用；回到浅色完成交付。
- 25% 对照见 `reference-comparison-25.png`。浏览器截图有 Windows 捕获倍率及画布空余，拼图仅去除空余画布并按 CSS 尺寸换算，没有改变页面比例。原始截图完整保留。

截图：`home-*.png`、`work.png`、`notes.png`、`about.png`、`contact.png`、`mobile-status.png`、`mobile-menu.png`、`mobile-contact.png`、`dark.png`。
尺寸证据：`responsive-metrics.json`。

## 10. Build / 范围验证

最终 `npm run build` 与 `npm run lint` 均退出 0。构建 CSS 43.90kB，JS 248.64kB。

`preservation-check.json` 证明 WorkSection、NotesSection、AboutSection、ContactSection、SiteLoader、App 与 portfolioData 七个文件均与本轮开始时 SHA256 一致。导航交互文件和原样式文件未改。实际代码改动只有 HeroSection、main 的样式导入，以及新增的 home-calibration.css。
