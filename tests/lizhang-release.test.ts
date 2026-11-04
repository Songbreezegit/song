import { describe, expect, it } from 'vitest';
import { PROJECTS, resolveProject } from '../src/data/portfolioData';
import { getProjectRelease } from '../src/data/projectReleases';
import { translateKey } from '../src/i18n/utils';

describe('礼账公开发行入口', () => {
  it('后台 UUID 和本地项目使用同一 APK 直链，其他作品不显示下载操作', () => {
    expect(getProjectRelease({ slug: 'lizhang' })?.downloadUrl).toBe('https://github.com/Songbreezegit/LizhangApp/releases/download/v1.0.0/LiZhang-v1.0.0-25-release.apk');
    expect(getProjectRelease({ slug: 'online-exam' })).toBeUndefined();
    expect(getProjectRelease(null)).toBeUndefined();
  });

  it('三语言均显示正式版本和原有数据范围说明', () => {
    const projects = PROJECTS.filter(project => project.slug === 'lizhang');
    expect(projects).toHaveLength(1);
    for (const language of ['zh', 'en', 'ja'] as const) {
      const project = resolveProject(projects[0], language);
      expect(project.overview).toMatch(/1\.0\.0[（ (]+25[）)]/);
      expect(project.overview).toContain('Android 8.0');
      expect(project.overview).toContain('.lizhangbackup');
      expect(project.overview).toContain('Excel / CSV');
      expect(project.overview).not.toContain('rc2');
      expect(project.githubUrl).toBe('https://github.com/Songbreezegit/LizhangApp.git');
    }
    expect(translateKey('work.modal.downloadAndroid', 'zh')).toBe('下载 Android 版');
    expect(translateKey('work.modal.downloadAndroid', 'en')).toBe('Download for Android');
    expect(translateKey('work.modal.downloadAndroid', 'ja')).toBe('Android 版をダウンロード');
  });
});
