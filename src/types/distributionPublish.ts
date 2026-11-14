import type { DistributionPlatform, DistributionVariantContent, DistributionVariantMedia } from './distribution';

export const publishStatuses = ['planned', 'awaiting_confirmation', 'manually_reported', 'cancelled'] as const;
export type PublishStatus = typeof publishStatuses[number];

export interface PublishSnapshot extends DistributionVariantContent {
  variant_id: string;
  variant_version: number;
  source_version: number;
  post_id: string;
  account_id: string;
  account_name: string;
  profile_url: string;
  platform: DistributionPlatform;
  captured_at: string;
  media: (DistributionVariantMedia & { sort_order: number; original_storage_path: string; mime_type: string })[];
}

export interface PublishTaskSummary {
  id: string;
  variant_id: string;
  post_id: string;
  account_id: string;
  platform: DistributionPlatform;
  variant_version: number;
  title: string;
  account_name: string;
  scheduled_at: string;
  timezone: string;
  status: PublishStatus;
  version: number;
  published_at: string | null;
  external_url: string | null;
  updated_at: string;
}

export interface PublishTask extends PublishTaskSummary {
  content_snapshot: PublishSnapshot;
  plan_note: string;
  reported_at: string | null;
  reported_by: string | null;
  report_note: string | null;
  report_evidence: 'manual_user_report' | null;
  created_by: string;
  updated_by: string;
  created_at: string;
}

export interface PublishSchedule {
  scheduled_at: string;
  timezone: string;
  plan_note: string;
}

export interface PublishReport {
  published_at: string;
  external_url: string;
  report_note: string;
  account_id: string;
  variant_version: number;
}

type ExistingTask = { id: string; version: number };
export type PublishCommand =
  | { action: 'create'; input: PublishSchedule & { variant_id: string; variant_version: number } }
  | (ExistingTask & (
    | { action: 'reschedule'; input: PublishSchedule }
    | { action: 'refresh_snapshot'; input: { variant_version: number } }
    | { action: 'start'; input: Record<string, never> }
    | { action: 'report'; input: PublishReport }
    | { action: 'correct_report'; input: PublishReport & { reason: string } }
    | { action: 'cancel' | 'return'; input: { reason: string } }
  ));

export interface PublishEvent {
  id: string;
  task_id: string;
  task_version: number;
  event_type: 'task_created' | 'task_rescheduled' | 'task_snapshot_updated' | 'task_started' |
    'manual_reported' | 'manual_report_corrected' | 'task_returned' | 'task_cancelled';
  actor_id: string;
  request_id: string;
  old_state: PublishTask | null;
  new_state: PublishTask;
  metadata: { reason?: string; evidence?: 'manual_user_report' };
  created_at: string;
}

export type PublishEventSummary = Omit<PublishEvent, 'old_state' | 'new_state'> & {
  previous_status: PublishStatus | null;
  next_status: PublishStatus;
  previous_variant: string | null;
  next_variant: string;
};

export interface PublishFilters {
  from: string;
  to: string;
  platform: DistributionPlatform | '';
  account: string;
  status: PublishStatus | '';
  completion: '' | 'open' | 'closed';
}
