# Project Cover System V1

`ProjectCard` renders `ProjectCover` followed by category, title, description and the detail arrow. No project IDs, slugs or titles select a visual implementation. Existing project data and the admin schema are unchanged.

## API

```tsx
<ProjectCover
  src={project.coverImage}
  alt={project.title}
  fit="cover"
  position="center"
  blend="soft"
/>
```

- `src`: optional URL, including null; changing it resets loading/error state.
- `alt`: project name for the foreground image.
- `fit`: `cover` (default) or `contain`. Cover fills the canvas with proportional cropping; contain keeps the complete image.
- `position`: CSS object-position; defaults to center.
- `blend`: `soft` (default) or `none`.

## Layers and loading

The cover always reserves a 16:9 box. All layers are positioned inside it, so loading and errors cannot change its height.

1. Theme-aware gradient and a generic sprout placeholder.
2. Decorative background using the same URL, object-fit cover, 20px CSS blur, 1.08 scale and .58 opacity. This layer mounts after the lazy foreground loads, avoiding an eager background request for every offscreen project.
3. A subtle theme overlay.
4. The sharp foreground, faded at its outer 4% using intersecting horizontal and vertical CSS masks. The mask is applied to the image itself, including in contain mode. WebKit and standard mask declarations are provided; a browser without mask support still displays the sharp image.

The two images share a URL and browser cache; no generated blur asset or server operation is needed. A browser test verifies a single request with the normal browser cache enabled. Background and overlay are hidden from assistive technology. Missing or failed images show the generic placeholder, with no broken-image icon or repeated request loop.

## Responsive behavior and interaction

All viewport sizes retain 16:9 with no fixed heights. The existing Work grid, tablet spacing and mobile column layout are reused. Cover radius is 28px, reduced to 22px at 600px and below. Metadata descriptions remain clamped to four lines on mobile.

On fine pointers with hover, the foreground scales to 1.02, the background to 1.1, the cover lifts 2px and the arrow moves (3px, -3px). Timing is 400ms ease-out. Touch does not depend on hover, and reduced-motion disables movement. Cover tokens are centralized in `src/components/ProjectCover.css`.

## Verification

`tests/e2e/project-cover.spec.ts` exercises the exported components and the existing Work page, with temporary HTTP image fixtures rather than published test projects:

- 1440, 1280, 1024, 768, 430, 390 and 375px viewports.
- 16:9, 4:3, 3:2, square, portrait and ultrawide input images.
- Reserved loading space, failure fallback, recovery after source changes, contain mode, position and disabled blending.
- Layer accessibility, metadata separation, hover, touch, reduced motion and cache reuse.
- Existing detail navigation.

To add a local real-image visual check, set `WORK_COVER_IMAGE` to its absolute path before running `npm run test:e2e -- --grep 'covers:'`. Set `PLAYWRIGHT_CHANNEL=chrome` when using installed Chrome. The test writes screenshots at all seven widths to Playwright's ignored output directory. The image is neither added to project data nor committed.
