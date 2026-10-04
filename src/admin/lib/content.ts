export function generateContentSlug(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
}

export function validateContentDraft(draft: { title: string; slug: string; sort_order: number }, label: string): void {
  if (!Number.isInteger(draft.sort_order) || draft.sort_order < -2147483648 || draft.sort_order > 2147483647) {
    throw new Error('Sort Order 必须是有效整数。');
  }
  if (!draft.title.trim()) throw new Error(`请输入${label}标题`);
  if (!draft.slug.trim()) throw new Error(`请输入${label} Slug`);
}
