import { useCallback, useRef } from 'react';
import { useBeforeUnload, useBlocker, type BlockerFunction } from 'react-router-dom';
import { changePublishTask } from '../../../services/distributionPublishService';
import type { PublishCommand, PublishTask } from '../../../types/distributionPublish';
import { useAdminAction } from '../../hooks/useAdminAction';

export function usePublishTaskAction(dirty: boolean) {
  const action = useAdminAction('操作失败，请重试。');
  const saving = action.pendingKey === 'task';
  const protect = dirty || saving;
  const shouldBlock = useCallback<BlockerFunction>(({ currentLocation, nextLocation }) =>
    protect && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search), [protect]);
  const blocker = useBlocker(shouldBlock);
  const departureApproved = useRef(false);
  const requests = useRef(new Map<string, string>());

  useBeforeUnload(useCallback(event => {
    if (protect) {
      event.preventDefault();
      event.returnValue = '';
    }
  }, [protect]));

  const submit = (command: PublishCommand, onSuccess: (task: PublishTask) => void, message: string) =>
    action.run('task', () => {
      const fingerprint = JSON.stringify(command);
      const id = requests.current.get(fingerprint) ?? crypto.randomUUID();
      requests.current.set(fingerprint, id);
      return changePublishTask(id, command);
    }, { onSuccess, successMessage: message });
  const blockedNavigation = blocker.state === 'blocked' ? {
    stay: blocker.reset,
    leave: () => { departureApproved.current = true; blocker.proceed(); },
  } : null;

  return { ...action, submit, saving, blockedNavigation, blocker, departureApproved };
}
