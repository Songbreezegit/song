import { describe, expect, it } from 'vitest';
import { distributionId, distributionVersion, validateDistributionAccount, validateDistributionPost } from '../src/lib/distributionValidation';
import { accountToDraft, createAccountDraft, createPostDraft, createPostEditorDraft, postToEditorDraft, serializePostEditorDraft } from '../src/admin/features/distribution/distributionForm';
import type { DistributionAccountRecord, DistributionPostRecord } from '../src/types/distribution';

const id = '11111111-1111-4111-8111-111111111111';
const account = () => ({ ...createAccountDraft(), name: '松屿' });
const post = () => ({ ...createPostDraft(), title: '产品进展' });

describe('distribution input boundary', () => {
  it('normalizes public account fields while preserving free-form content', () => {
    expect(validateDistributionAccount({ ...account(), name: ' 松屿 ', profile_url: ' https://example.com/主页 ', positioning: ' 面向独立开发者 ' }))
      .toMatchObject({ name: '松屿', profile_url: 'https://example.com/%E4%B8%BB%E9%A1%B5', positioning: '面向独立开发者' });
    const body = '<script>example()</script>\nSQL: select * from projects;\n';
    expect(validateDistributionPost({ ...post(), body }).body).toBe(body);
  });
  it.each(['javascript:alert(1)', 'data:text/html,hi', '//example.com', 'https://user:pass@example.com', 'https://example.com\\evil', 'https://example.com\n', 'not a url'])('rejects unsafe account URLs %j', profile_url => {
    expect(() => validateDistributionAccount({ ...account(), profile_url })).toThrow();
  });
  it.each([null, [], {}, { ...account(), password: 'forbidden' }, { ...account(), cookies: [] }, { ...account(), access_token: 'forbidden' }, { ...account(), name: ' ' }, { ...account(), name: 'a'.repeat(101) }, { ...account(), is_enabled: 'yes' }, { ...account(), platform: 'unsupported' }, { ...account(), project_id: 1 }])('rejects invalid or secret-bearing account payload %j', value => {
    expect(() => validateDistributionAccount(value)).toThrow();
  });
  it.each([{ ...post(), status: 'published' }, { ...post(), created_at: 'spoof' }, { ...post(), body: 'a'.repeat(100001) }, { ...post(), tags: [null] }, { ...post(), tags: ['duplicate', 'duplicate'] }, { ...post(), tags: ['a'.repeat(51)] }, { ...post(), tags: Array.from({ length: 21 }, (_, i) => String(i)) }, { ...post(), account_ids: [id, id] }, { ...post(), media_ids: ['uploads/image.png'] }, { ...post(), title: '\0' }])('rejects invalid source payload', value => {
    expect(() => validateDistributionPost(value)).toThrow();
  });
  it('validates UUID identity and positive optimistic versions', () => {
    expect(distributionId(id)).toBe(id); expect(distributionVersion(3)).toBe(3);
    for (const value of ['', 'not-id', null]) expect(() => distributionId(value)).toThrow();
    for (const value of [0, -1, '1', 1.5, Infinity]) expect(() => distributionVersion(value)).toThrow();
  });
  it('keeps server metadata out of forms and retains tag separators until serialization', () => {
    const record = { ...account(), id, version: 7, archived_at: null, created_at: 'server', updated_at: 'server' } as DistributionAccountRecord;
    expect(accountToDraft(record)).toEqual(account());
    const draft = { ...createPostEditorDraft(), title: '内容', tagsText: '设计， 开发,\n 产品 ' };
    expect(serializePostEditorDraft(draft).tags).toEqual(['设计', '开发', '产品']);
    expect(draft.tagsText).toBe('设计， 开发,\n 产品 ');
    const postRecord = { ...post(), tags: ['设计'], id, version: 1, created_at: '', updated_at: '', media_ids: [id] } as DistributionPostRecord;
    const editorDraft = postToEditorDraft(postRecord);
    editorDraft.media_ids.push('22222222-2222-4222-8222-222222222222');
    expect(postRecord.media_ids).toEqual([id]);
    expect(Object.keys(editorDraft)).not.toContain('version');
  });
});
