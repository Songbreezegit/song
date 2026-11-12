import { fetchDistributionAccounts, getDistributionPost } from '../../../services/distributionService';
import { fetchDistributionVariants } from '../../../services/distributionVariantService';

export const variantWorkspacePath = (postId: string) => `/admin/distribution/posts/${postId}/variants`;

export async function loadVariantWorkspace(postId: string) {
  const [source, accounts, variants] = await Promise.all([
    getDistributionPost(postId), fetchDistributionAccounts(), fetchDistributionVariants(postId),
  ]);
  if (!source) throw new Error('内容源不存在或当前无权访问。');
  return { source, accounts, variants };
}
