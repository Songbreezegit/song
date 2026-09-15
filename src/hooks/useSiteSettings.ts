import { useState, useEffect, useCallback } from 'react';
import type { SiteSettingsRecord } from '../types/database';
import { fetchSiteSettings } from '../services/siteService';

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettingsRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSiteSettings();
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('获取站点设置失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchSiteSettings()
      .then((data) => {
        if (active) {
          setSettings(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err : new Error('获取站点设置失败'));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return { settings, loading, error, refresh: loadSettings };
}
