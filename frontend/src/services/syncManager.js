import {
  getUnsyncedReports,
  getReport,
  updateSyncStatus,
  saveHistory,
} from '../db/reportRepository.js';
import { createReport as apiCreateReport } from './api.js';

let isSyncing = false;
const syncListeners = new Set();

export function subscribeToSyncEvents(callback) {
  syncListeners.add(callback);
  return () => syncListeners.delete(callback);
}

function notifySyncListeners(eventData) {
  syncListeners.forEach((listener) => {
    try {
      listener(eventData);
    } catch (e) {
      console.error('Error in sync listener:', e);
    }
  });
}

export function isSyncingInProgress() {
  return isSyncing;
}

export async function syncSingleReport(reportId) {
  const report = await getReport(reportId);
  if (!report) {
    throw new Error('Report not found in local database.');
  }

  if (report.syncStatus === 'synced') {
    return { status: 'already_synced', report };
  }

  return processReportSync(report);
}

async function processReportSync(report) {
  await updateSyncStatus(report.id, 'syncing', null);
  await saveHistory({
    reportId: report.id,
    eventType: 'SYNC_STARTED',
    fromStatus: report.status,
    toStatus: report.status,
    timestamp: new Date().toISOString(),
    source: 'local',
    details: 'Synchronization attempt started.',
  });

  notifySyncListeners({ type: 'SYNC_SINGLE_STARTED', reportId: report.id });

  try {
    const response = await apiCreateReport(report);

    const updatedReport = await updateSyncStatus(report.id, 'synced', null);
    await saveHistory({
      reportId: report.id,
      eventType: 'SYNC_SUCCEEDED',
      fromStatus: report.status,
      toStatus: report.status,
      timestamp: new Date().toISOString(),
      source: 'local',
      details: 'Report successfully synchronized with server.',
    });

    notifySyncListeners({ type: 'SYNC_SINGLE_SUCCESS', reportId: report.id, response });
    return { success: true, report: updatedReport };
  } catch (err) {
    const errorMessage = err.message || 'Network request failed';

    const failedReport = await updateSyncStatus(report.id, 'failed', errorMessage);
    await saveHistory({
      reportId: report.id,
      eventType: 'SYNC_FAILED',
      fromStatus: report.status,
      toStatus: report.status,
      timestamp: new Date().toISOString(),
      source: 'local',
      details: `Sync failed: ${errorMessage}`,
    });

    notifySyncListeners({ type: 'SYNC_SINGLE_FAILED', reportId: report.id, error: errorMessage });
    return { success: false, report: failedReport, error: errorMessage };
  }
}

export async function syncAllReports() {
  if (isSyncing) {
    return { status: 'in_progress', message: 'Synchronization is already running.' };
  }

  isSyncing = true;
  notifySyncListeners({ type: 'SYNC_ALL_STARTED' });

  let syncedCount = 0;
  let failedCount = 0;
  const results = [];

  try {
    const unsyncedReports = await getUnsyncedReports();

    for (const report of unsyncedReports) {
      const res = await processReportSync(report);
      results.push(res);
      if (res.success) {
        syncedCount++;
      } else {
        failedCount++;
      }
    }

    const summary = {
      total: unsyncedReports.length,
      synced: syncedCount,
      failed: failedCount,
      results,
    };

    notifySyncListeners({ type: 'SYNC_ALL_COMPLETED', summary });
    return summary;
  } finally {
    isSyncing = false;
  }
}
