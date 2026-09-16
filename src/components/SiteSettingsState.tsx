import { DataState } from './DataState';
import type { SiteSettingsRecord } from '../types/database';

export interface SiteSettingsProps {
  settings: SiteSettingsRecord | null;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

export function SiteSettingsState({ settings, ...props }: SiteSettingsProps) {
  return <DataState {...props} empty={!settings} emptyMessage="站点信息尚未发布。" />;
}
