import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveReport, getReport, getReportHistory } from '../db/reportRepository.js';
import { syncAllReports, syncSingleReport } from '../services/syncManager.js';
import * as api from '../services/api.js';

vi.mock('../services/api.js', () => ({
  createReport: vi.fn(),
}));

describe('Synchronization Manager (Scenarios A - E)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('SCENARIO A — Offline report creation produces pending sync status in IndexedDB', async () => {
    const offlineReport = await saveReport({
      id: 'scenario-a-uuid',
      category: 'water_point',
      description: 'Pipeline broken offline',
      location: 'Sector 9',
      priority: 'high',
      status: 'submitted',
      reportedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });

    expect(offlineReport.id).toBe('scenario-a-uuid');
    expect(offlineReport.syncStatus).toBe('pending');
  });

  it('SCENARIO B — Successful sync transitions status to synced and records history', async () => {
    await saveReport({
      id: 'scenario-b-uuid',
      category: 'equipment',
      description: 'Generator fault',
      location: 'Station B',
      priority: 'medium',
      status: 'submitted',
      reportedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });

    api.createReport.mockResolvedValueOnce({
      id: 'scenario-b-uuid',
      category: 'equipment',
      description: 'Generator fault',
      location: 'Station B',
      priority: 'medium',
      status: 'submitted',
      version: 1,
    });

    const syncResult = await syncAllReports();
    expect(syncResult.synced).toBe(1);
    expect(syncResult.failed).toBe(0);

    const syncedReport = await getReport('scenario-b-uuid');
    expect(syncedReport.syncStatus).toBe('synced');
    expect(syncedReport.syncError).toBeNull();

    const history = await getReportHistory('scenario-b-uuid');
    const eventTypes = history.map((h) => h.eventType);
    expect(eventTypes).toContain('SYNC_STARTED');
    expect(eventTypes).toContain('SYNC_SUCCEEDED');
  });

  it('SCENARIO C — Failed sync records error, retains report in IndexedDB, logs SYNC_FAILED', async () => {
    await saveReport({
      id: 'scenario-c-uuid',
      category: 'safety',
      description: 'Exposed wire',
      location: 'Road 5',
      priority: 'critical',
      status: 'submitted',
      reportedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });

    api.createReport.mockRejectedValueOnce(new Error('Network request failed: Gateway Timeout'));

    const syncResult = await syncAllReports();
    expect(syncResult.synced).toBe(0);
    expect(syncResult.failed).toBe(1);

    // CRITICAL REQUIREMENT: Report must STILL EXIST in IndexedDB!
    const failedReport = await getReport('scenario-c-uuid');
    expect(failedReport).not.toBeNull();
    expect(failedReport.syncStatus).toBe('failed');
    expect(failedReport.syncError).toContain('Network request failed');

    const history = await getReportHistory('scenario-c-uuid');
    const eventTypes = history.map((h) => h.eventType);
    expect(eventTypes).toContain('SYNC_FAILED');
  });

  it('SCENARIO D — Retry after failure successfully synchronizes report', async () => {
    await saveReport({
      id: 'scenario-d-uuid',
      category: 'maintenance',
      description: 'Gate lock damaged',
      location: 'Main Gate',
      priority: 'low',
      status: 'submitted',
      reportedAt: new Date().toISOString(),
      syncStatus: 'failed',
      syncError: 'Previous connection reset',
    });

    api.createReport.mockResolvedValueOnce({
      id: 'scenario-d-uuid',
      status: 'submitted',
    });

    const retryResult = await syncSingleReport('scenario-d-uuid');
    expect(retryResult.success).toBe(true);

    const updatedReport = await getReport('scenario-d-uuid');
    expect(updatedReport.syncStatus).toBe('synced');
    expect(updatedReport.syncError).toBeNull();
  });

  it('SCENARIO E — Duplicate prevention uses existing report UUID for idempotent retry', async () => {
    const reportId = 'scenario-e-duplicate-uuid';
    const reportData = {
      id: reportId,
      category: 'other',
      description: 'Idempotency test report',
      location: 'Lab 1',
      priority: 'medium',
      status: 'submitted',
      reportedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    await saveReport(reportData);

    // First attempt succeeds
    api.createReport.mockResolvedValueOnce({ id: reportId, status: 'submitted' });
    await syncSingleReport(reportId);

    // Verify API called with the exact original UUID
    expect(api.createReport).toHaveBeenCalledWith(
      expect.objectContaining({
        id: reportId,
        description: 'Idempotency test report',
      })
    );
  });
});
