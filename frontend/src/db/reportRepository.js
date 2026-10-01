import { getDB } from './database.js';

export async function saveReport(report) {
  const db = await getDB();
  const now = new Date().toISOString();
  const reportToSave = {
    ...report,
    id: report.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    createdAt: report.createdAt || now,
    updatedAt: now,
    syncStatus: report.syncStatus || 'pending',
    syncError: report.syncError || null,
  };
  await db.put('reports', reportToSave);
  return reportToSave;
}

export async function getReport(id) {
  const db = await getDB();
  return (await db.get('reports', id)) || null;
}

export async function getAllReports() {
  const db = await getDB();
  const reports = await db.getAll('reports');
  return reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getPendingReports() {
  const db = await getDB();
  return db.getAllFromIndex('reports', 'syncStatus', 'pending');
}

export async function getFailedReports() {
  const db = await getDB();
  return db.getAllFromIndex('reports', 'syncStatus', 'failed');
}

export async function getUnsyncedReports() {
  const pending = await getPendingReports();
  const failed = await getFailedReports();
  // Filter unique reports in case of index overlap
  const reportMap = new Map();
  [...pending, ...failed].forEach((r) => reportMap.set(r.id, r));
  return Array.from(reportMap.values());
}

export async function updateReport(report) {
  const db = await getDB();
  const existing = await db.get('reports', report.id);
  const updated = {
    ...existing,
    ...report,
    updatedAt: new Date().toISOString(),
  };
  await db.put('reports', updated);
  return updated;
}

export async function updateSyncStatus(id, syncStatus, syncError = null) {
  const db = await getDB();
  const report = await db.get('reports', id);
  if (!report) return null;
  report.syncStatus = syncStatus;
  report.syncError = syncError;
  report.updatedAt = new Date().toISOString();
  await db.put('reports', report);
  return report;
}

export async function saveHistory(event) {
  const db = await getDB();
  const historyEvent = {
    id: event.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    reportId: event.reportId,
    eventType: event.eventType,
    fromStatus: event.fromStatus || null,
    toStatus: event.toStatus || null,
    timestamp: event.timestamp || new Date().toISOString(),
    source: event.source || 'local',
    details: event.details || null,
  };
  await db.put('history', historyEvent);
  return historyEvent;
}

export async function getReportHistory(reportId) {
  const db = await getDB();
  const historyList = await db.getAllFromIndex('history', 'reportId', reportId);
  return historyList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export async function clearDatabase() {
  const db = await getDB();
  await db.clear('reports');
  await db.clear('history');
}

export async function seedDemoData() {
  const existing = await getAllReports();
  if (existing.length > 0) return; // Do not overwrite if data exists

  const now = new Date();

  const demoReports = [
    {
      id: '11111111-1111-4111-a111-111111111111',
      category: 'water_point',
      description: 'Main borewell pump leaking heavily at Sector 4 water point.',
      location: 'Sector 4 Water Point, North Ridge',
      priority: 'high',
      status: 'draft',
      reportedAt: new Date(now.getTime() - 3600000 * 2).toISOString(),
      syncStatus: 'pending',
      syncError: null,
    },
    {
      id: '22222222-2222-4222-a222-222222222222',
      category: 'equipment',
      description: 'Solar power inverter displaying Fault Code E-04.',
      location: 'Substation B, West Field',
      priority: 'medium',
      status: 'submitted',
      reportedAt: new Date(now.getTime() - 3600000 * 5).toISOString(),
      syncStatus: 'pending',
      syncError: null,
    },
    {
      id: '33333333-3333-4333-a333-333333333333',
      category: 'service_interruption',
      description: 'Main pipeline pressure drop affecting downstream supply.',
      location: 'Distribution Station 12',
      priority: 'critical',
      status: 'assigned',
      reportedAt: new Date(now.getTime() - 3600000 * 24).toISOString(),
      syncStatus: 'synced',
      syncError: null,
    },
    {
      id: '44444444-4444-4444-a444-444444444444',
      category: 'safety',
      description: 'Exposed high-voltage wire damaged during storm.',
      location: 'Access Road Maintenance Hole 3',
      priority: 'critical',
      status: 'submitted',
      reportedAt: new Date(now.getTime() - 3600000 * 1).toISOString(),
      syncStatus: 'failed',
      syncError: 'Network request failed: Gateway Timeout (504)',
    },
  ];

  for (const report of demoReports) {
    await saveReport(report);
    await saveHistory({
      reportId: report.id,
      eventType: 'REPORT_CREATED',
      toStatus: report.status,
      timestamp: report.reportedAt,
      source: 'local',
      details: 'Initial report creation (Demo Data)',
    });
  }
}
