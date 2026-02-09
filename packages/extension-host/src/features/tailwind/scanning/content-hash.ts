// packages/extension/tailwind/scanning/content-hash.ts
// compute stable content hashes for Tailwind scan caching

import * as crypto from 'crypto';

// compute SHA-1 hash of content for cache key validation
// use SHA-1 for parity w/ TailwindProcessor.buildCacheKey()
export function computeContentHash(content: string): string {
  return crypto.createHash('sha1').update(content, 'utf8').digest('hex');
}
