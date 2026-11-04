export const LIZHANG_RELEASE = Object.freeze({
  versionName: '1.0.0',
  versionCode: 25,
  minAndroidVersion: '8.0',
  downloadUrl: 'https://github.com/Songbreezegit/LizhangApp/releases/download/v1.0.0/LiZhang-v1.0.0-25-release.apk',
});

// 后台项目使用 UUID，本地数据使用语义 ID；下载入口按稳定的 slug 匹配。
export function getProjectRelease(project: { slug: string } | null) {
  return project?.slug === 'lizhang' ? LIZHANG_RELEASE : undefined;
}
