import { useEffect, useRef } from 'react';

interface Props {
  stay: () => void;
  leave: () => void;
  isDirty: boolean;
  saving: boolean;
}

export function DistributionLeaveDialog({ stay, leave, isDirty, saving }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    return () => element.close();
  }, []);

  let message = '保存已完成。可以继续编辑或离开。';
  if (saving) message = '保存正在进行。离开后，已提交的请求仍可能完成。';
  else if (isDirty) message = '离开将丢失未保存的修改。';

  return (
    <dialog
      ref={dialog}
      className="admin-card distribution-leave-dialog"
      aria-labelledby="distribution-leave-title"
      aria-describedby="distribution-leave-message"
      onCancel={event => {
        event.preventDefault();
        stay();
      }}
    >
      <h2 className="admin-card-title" id="distribution-leave-title">离开编辑器？</h2>
      <p className="admin-card-description" id="distribution-leave-message">{message}</p>
      <div className="distribution-leave-actions">
        <button type="button" className="admin-btn admin-btn-secondary" onClick={stay}>继续编辑</button>
        <button type="button" className="admin-btn admin-btn-primary" onClick={leave}>确认离开</button>
      </div>
    </dialog>
  );
}
