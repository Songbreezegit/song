export const LIZHANG_RELEASE = Object.freeze({
  versionName: '1.0.0',
  versionCode: 25,
  minAndroidVersion: '8.0',
  downloadUrl: 'https://lizhang.songisle.xyz/download/',
});

// 后台项目使用 UUID，本地数据使用语义 ID；下载入口按稳定的 slug 匹配。
export function getProjectRelease(project: { slug: string } | null) {
  return project?.slug === 'lizhang' ? LIZHANG_RELEASE : undefined;
}
