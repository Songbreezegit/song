import { useId } from 'react';
import { inspectPublishTime, publishZones, type TimeChoice } from '../../../lib/distributionPublishTime';
import type { PublishStatus } from '../../../types/distributionPublish';
import { DistributionField } from './DistributionChrome';
import { publishStatusLabels } from './publishModel';

export interface PublishTimeDraft {
  date: string;
  time: string;
  timezone: string;
  offset: TimeChoice | '';
}

export function PublishStatusBadge({ status }: { status: PublishStatus }) {
  return <span className="admin-status-badge publish-status" data-status={status}>{publishStatusLabels[status]}</span>;
}

export function PublishZoneField({ id, value, onChange, label = '时区', help }: {
  id: string; value: string; onChange: (value: string) => void; label?: string; help?: string;
}) {
  const listId = useId();
  return <DistributionField id={id} label={label} help={help}>
    <input id={id} className="admin-input" list={listId} value={value} onChange={event => onChange(event.target.value)}
      aria-describedby={help ? id + '-help' : undefined} maxLength={100} required spellCheck={false} />
    <datalist id={listId}>{publishZones.map(zone => <option key={zone} value={zone} />)}</datalist>
  </DistributionField>;
}

export function PublishTimeFields({ value, onChange, allowZoneChange = true, actual = false }: {
  value: PublishTimeDraft; onChange: (value: PublishTimeDraft) => void; allowZoneChange?: boolean; actual?: boolean;
}) {
  const id = useId();
  let timeError = '';
  let options: ReturnType<typeof inspectPublishTime> | null = null;
  if (value.date && value.time && value.timezone) {
    try { options = inspectPublishTime(value.date, value.time, value.timezone); }
    catch (error) { timeError = (error as Error).message; }
  }
  const set = (patch: Partial<PublishTimeDraft>) => onChange({ ...value, offset: '', ...patch });
  return <>
    <div className="publish-fields">
      <DistributionField id={id + '-date'} label={actual ? '实际发布日期' : '计划日期'}>
        <input id={id + '-date'} className="admin-input" type="date" value={value.date} required onChange={event => set({ date: event.target.value })} />
      </DistributionField>
      <DistributionField id={id + '-time'} label={actual ? '实际发布时间' : '计划时间'}>
        <input id={id + '-time'} className="admin-input" type="time" value={value.time} required onChange={event => set({ time: event.target.value })} />
      </DistributionField>
      {allowZoneChange ? <PublishZoneField id={id + '-zone'} value={value.timezone} onChange={timezone => set({ timezone })}
        help="更改时区后，日期和时间按所选时区解释。" /> :
        <p className="publish-timezone">报告时区 <strong>{value.timezone}</strong></p>}
    </div>
    {timeError && <p className="publish-validation" role="alert">{timeError}</p>}
    {options?.repeated && <DistributionField id={id + '-offset'} label="本地时间出现两次" help="选择实际使用的 UTC 偏移。">
      <select id={id + '-offset'} className="admin-select" value={value.offset}
        onChange={event => set({ offset: event.target.value as TimeChoice | '' })}>
        <option value="">选择 UTC 偏移</option>
        <option value="earlier">第一次 UTC{options.earlier.offset}</option>
        <option value="later">第二次 UTC{options.later.offset}</option>
      </select>
    </DistributionField>}
  </>;
}
