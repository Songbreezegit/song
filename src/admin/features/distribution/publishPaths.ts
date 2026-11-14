export const publishCalendarPath = '/admin/distribution/calendar';
export const publishHistoryPath = '/admin/distribution/history';
export const publishTaskPath = (id: string) => publishCalendarPath + '/' + id;
export const newPublishTaskPath = (params: Record<string, string>) => publishCalendarPath + '/new?' + new URLSearchParams(params);
