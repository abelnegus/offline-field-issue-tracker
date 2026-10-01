import { describe, it, expect } from 'vitest';
import {
  saveReport,
  getReport,
  getAllReports,
  getPendingReports,
  getFailedReports,
  updateSyncStatus,
  saveHistory,
  getReportHistory,
} from '../db/reportRepository.js';

describe('IndexedDB Report Repository', () => {
  it('saves and retrieves a report locally', async () => {
    const reportData = {
      id: 'test-uuid-101',
      category: 'water_point',
      description: 'Leakage observed at main valve.',
      location: 'Valve Station A',
      priority: 'high',
      status: 'submitted',
      reportedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const saved = await saveReport(reportData);
    expect(saved.id).toBe('test-uuid-101');
    expect(saved.syncStatus).toBe('pending');

    const fetched = await getReport('test-uuid-101');
    expect(fetched).not.toBeNull();
    expect(fetched.description).toBe('Leakage observed at main valve.');
  });

  it('queries reports by sync status index', async () => {
    await saveReport({
      id: 'rep-pending',
      category: 'equipment',
      description: 'Faulty motor',
      location: 'Pump House',
      priority: 'medium',
      status: 'draft',
      syncStatus: 'pending',
    });

    await saveReport({
      id: 'rep-failed',
      category: 'safety',
      description: 'Broken fence',
      location: 'Perimeter',
      priority: 'low',
      status: 'submitted',
      syncStatus: 'failed',
      syncError: 'Network Error',
    });

    const pendingList = await getPendingReports();
    expect(pendingList.some((r) => r.id === 'rep-pending')).toBe(true);

    const failedList = await getFailedReports();
    expect(failedList.some((r) => r.id === 'rep-failed')).toBe(true);
  });

  it('updates sync status without altering existing report fields', async () => {
    await saveReport({
      id: 'rep-update-status',
      category: 'other',
      description: 'Test report',
      location: 'Site 1',
      priority: 'low',
      status: 'draft',
      syncStatus: 'pending',
    });

    await updateSyncStatus('rep-update-status', 'failed', 'Timeout error (504)');
    const updated = await getReport('rep-update-status');

    expect(updated.syncStatus).toBe('failed');
    expect(updated.syncError).toBe('Timeout error (504)');
    expect(updated.description).toBe('Test report');
  });

  it('saves and retrieves local history timeline sorted by timestamp', async () => {
    const reportId = 'history-test-uuid';
    const t1 = new Date(Date.now() - 2000).toISOString();
    const t2 = new Date(Date.now() - 1000).toISOString();

    await saveHistory({
      reportId,
      eventType: 'REPORT_CREATED',
      toStatus: 'draft',
      timestamp: t1,
      source: 'local',
      details: 'Created draft',
    });

    await saveHistory({
      reportId,
      eventType: 'STATUS_CHANGED',
      fromStatus: 'draft',
      toStatus: 'submitted',
      timestamp: t2,
      source: 'local',
      details: 'Submitted report',
    });

    const historyList = await getReportHistory(reportId);
    expect(historyList.length).toBe(2);
    expect(historyList[0].eventType).toBe('REPORT_CREATED');
    expect(historyList[1].eventType).toBe('STATUS_CHANGED');
  });
});
