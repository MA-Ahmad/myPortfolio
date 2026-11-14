import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';
import memoryQueue from '@opennextjs/cloudflare/overrides/queue/memory-queue';

// Pages with `revalidate` (home, blog, blog posts, Theme Studio, themes) are cached in R2
// (binding NEXT_INC_CACHE_R2_BUCKET). A stale page is served while the memory queue re-renders it
// through the WORKER_SELF_REFERENCE service binding; without a queue OpenNext never re-renders.
// The site only uses time-based revalidation (no revalidateTag/revalidatePath), so no tag cache.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: memoryQueue
});
