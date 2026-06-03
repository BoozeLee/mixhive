import { test as teardown } from '@playwright/test';

teardown('cleanup', async () => {
  // No-op teardown — auth state file persists between runs for speed
});
