import type { FormEvent } from 'react';
import type { ContentStatus } from '../../types/database';

export function getEditorReturnPath(listPath: string, state: unknown): string {
  if (!state || typeof state !== 'object' || !('returnTo' in state) || typeof state.returnTo !== 'string') return listPath;
  if (state.returnTo !== listPath && !state.returnTo.startsWith(`${listPath}?`)) return listPath;
  try {
    const destination = new URL(state.returnTo, 'https://admin.invalid');
    if (destination.origin !== 'https://admin.invalid' || destination.pathname !== listPath) return listPath;
    return destination.pathname + destination.search;
  } catch {
    return listPath;
  }
}

export function getEditorSubmitStatus(event: FormEvent): ContentStatus | undefined {
  const submitter = (event.nativeEvent as SubmitEvent).submitter;
  if (!(submitter instanceof HTMLButtonElement) || submitter.name !== 'save-status') return undefined;
  return submitter.value === 'draft' || submitter.value === 'published' ? submitter.value : undefined;
}
