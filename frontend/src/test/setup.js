import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { clearDatabase } from '../db/reportRepository.js';

beforeEach(async () => {
  try {
    await clearDatabase();
  } catch {
    // Ignore initial clean errors
  }
});
