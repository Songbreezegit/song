import { useEffect } from 'react';
import { recordAnalyticsEvent, type AnalyticsEvent } from '../services/analyticsService';

interface PublicAnalyticsObservation {
  section: string;
  pageReady: boolean;
  detailRequest: string | null;
  detailReady: boolean;
  contentType: 'article' | 'project' | null;
  contentId: string | null;
}

// One tracker per public document, not per React mount. Its state is memory-only
// and is never a visitor id. StrictMode, route remounts, translations, appearance
// changes and content refetches cannot duplicate an already observed opening.
export function createPublicAnalyticsTracker(send: (event: AnalyticsEvent) => Promise<boolean> = recordAnalyticsEvent) {
  let previousSection: string | null = null;
  let previousDetailRequest: string | null = null;
  let detailCounted = false;
  const submit = (eventType: AnalyticsEvent['eventType'], contentId: string | null) => {
    try {
      const eventId = crypto.randomUUID();
      // Collection failure never blocks the public page. The read-side dashboard
      // independently reports unavailable/not-enabled states instead of fake zeroes.
      void send({ eventId, eventType, contentId }).catch(() => {});
    } catch {
      // Unsupported crypto APIs and synchronous integration failures must also
      // leave the public page usable.
    }
  };
  const observe = (observation: PublicAnalyticsObservation) => {
    if (observation.pageReady && observation.section !== previousSection) {
      previousSection = observation.section;
      submit('page_view', null);
    }
    if (observation.detailRequest !== previousDetailRequest) {
      previousDetailRequest = observation.detailRequest;
      detailCounted = false;
    }
    if (observation.detailRequest && observation.detailReady && observation.contentId && observation.contentType && !detailCounted) {
      detailCounted = true;
      submit(observation.contentType === 'article' ? 'article_click' : 'project_click', observation.contentId);
    }
  };
  return Object.assign(observe, { leavePublic: () => {
    previousSection = null;
    previousDetailRequest = null;
    detailCounted = false;
  } });
}

const observePublicAnalytics = createPublicAnalyticsTracker();

export function usePublicAnalytics({ section, pageReady, detailRequest, detailReady, contentType, contentId }: PublicAnalyticsObservation) {
  useEffect(() => () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const stillPublic = ['zh', 'en', 'ja'].includes(parts[0] || '') && parts.length <= 2
      && (parts.length === 1 || ['work', 'notes', 'about', 'contact'].includes(parts[1] || ''));
    if (!stillPublic) observePublicAnalytics.leavePublic();
  }, []);
  useEffect(() => {
    observePublicAnalytics({ section, pageReady, detailRequest, detailReady, contentType, contentId });
  }, [section, pageReady, detailRequest, detailReady, contentType, contentId]);
}
