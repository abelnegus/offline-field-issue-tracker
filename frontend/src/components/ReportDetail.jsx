import { useState, useEffect, useCallback } from 'react';
import {
  getReport,
  updateReport,
  saveHistory,
  getReportHistory as getLocalReportHistory,
} from '../db/reportRepository.js';
import { syncSingleReport } from '../services/syncManager.js';
import { updateReportStatus as apiUpdateStatus, getReportHistory as apiGetHistory } from '../services/api.js';

const CATEGORY_LABELS = {
  water_point: '💧 Water Point',
  equipment: '⚡ Equipment',
  service_interruption: '🚫 Service Interruption',
  safety: '⚠️ Safety',
  maintenance: '🔧 Maintenance',
  other: '📦 Other',
};

const VALID_TRANSITIONS = {
  draft: [{ target: 'submitted', label: '🚀 Submit Report', roles: ['field_worker', 'coordinator'] }],
  submitted: [
    { target: 'assigned', label: '📌 Assign Report', roles: ['coordinator'] },
    { target: 'rejected', label: '❌ Reject Report', roles: ['coordinator'], danger: true },
  ],
  assigned: [
    { target: 'in_progress', label: '⚙️ Move to In Progress', roles: ['coordinator'] },
    { target: 'rejected', label: '❌ Reject Report', roles: ['coordinator'], danger: true },
  ],
  in_progress: [
    { target: 'resolved', label: '✅ Mark Resolved', roles: ['coordinator'] },
    { target: 'rejected', label: '❌ Reject Report', roles: ['coordinator'], danger: true },
  ],
  resolved: [],
  rejected: [],
};

export default function ReportDetail({ reportId, role, isOnline, onClose, onReportUpdated }) {
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const loadData = useCallback(async () => {
    if (!reportId) return;
    setLoading(true);
    setActionError(null);

    try {
      // 1. Fetch local report
      const localRep = await getReport(reportId);
      setReport(localRep);

      // 2. Fetch local history
      const localHist = await getLocalReportHistory(reportId);

      // 3. If synced & online, fetch server history to enrich
      let mergedHistory = [...localHist];
      if (localRep?.syncStatus === 'synced' && isOnline) {
        try {
          const serverHist = await apiGetHistory(reportId);
          // Combine unique history entries by timestamp/event_type
          const existingKeys = new Set(localHist.map((h) => `${h.eventType}_${h.timestamp}`));
          serverHist.forEach((sh) => {
            const key = `${sh.event_type}_${sh.timestamp}`;
            if (!existingKeys.has(key)) {
              mergedHistory.push({
                id: sh.id,
                reportId: sh.report_id,
                eventType: sh.event_type,
                fromStatus: sh.from_status,
                toStatus: sh.to_status,
                timestamp: sh.timestamp,
                source: sh.source || 'api',
                details: sh.details,
              });
            }
          });
        } catch {
          // Fall back to local history
        }
      }

      mergedHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setHistory(mergedHistory);
    } catch (err) {
      setActionError(`Error loading report details: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [reportId, isOnline]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRetrySync = async () => {
    if (!report) return;
    setRetrying(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await syncSingleReport(report.id);
      if (res.success) {
        setActionSuccess('Sync succeeded! Report is now synchronized with server.');
      } else {
        setActionError(`Sync failed: ${res.error || 'Server unreachable'}`);
      }
      await loadData();
      if (onReportUpdated) onReportUpdated();
    } catch (err) {
      setActionError(`Retry attempt failed: ${err.message}`);
    } finally {
      setRetrying(false);
    }
  };

  const handleStatusTransition = async (newStatus) => {
    if (!report) return;
    setActionError(null);
    setActionSuccess(null);

    const oldStatus = report.status;
    const now = new Date().toISOString();

    try {
      // 1. Update locally first
      const updatedReport = {
        ...report,
        status: newStatus,
        updatedAt: now,
      };

      await updateReport(updatedReport);
      await saveHistory({
        reportId: report.id,
        eventType: 'STATUS_CHANGED',
        fromStatus: oldStatus,
        toStatus: newStatus,
        timestamp: now,
        source: 'local',
        details: `Status updated from ${oldStatus.toUpperCase()} to ${newStatus.toUpperCase()} by ${role}.`,
      });

      // 2. If already synced & online, update backend
      if (report.syncStatus === 'synced' && isOnline) {
        try {
          await apiUpdateStatus(report.id, newStatus);
        } catch (apiErr) {
          // If backend transition fails (e.g., status conflict), record error
          setActionError(`Backend transition warning: ${apiErr.message}`);
        }
      } else if (report.syncStatus === 'synced' && !isOnline) {
        // If offline and was synced, mark pending sync for update
        await updateReport({
          ...updatedReport,
          syncStatus: 'pending',
        });
      }

      setActionSuccess(`Status updated to ${newStatus.replace('_', ' ').toUpperCase()}`);
      await loadData();
      if (onReportUpdated) onReportUpdated();
    } catch (err) {
      setActionError(`Failed to update status: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="card report-detail-card">
        <p>Loading report details...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="card report-detail-card">
        <p>Report not found.</p>
        <button className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }

  const allowedActions = (VALID_TRANSITIONS[report.status] || []).filter((action) =>
    action.roles.includes(role)
  );

  return (
    <div className="card report-detail-card">
      <div className="detail-header">
        <div>
          <h2>Report Details</h2>
          <span className="report-id-text">ID: {report.id}</span>
        </div>
        <button className="close-btn" onClick={onClose} aria-label="Close report detail">
          ×
        </button>
      </div>

      {actionError && <div className="alert alert-error">{actionError}</div>}
      {actionSuccess && <div className="alert alert-success">{actionSuccess}</div>}

      {/* Sync Status Alert Banner */}
      <div className={`sync-banner sync-banner-${report.syncStatus}`}>
        <div className="sync-banner-info">
          <span className="sync-banner-icon">
            {report.syncStatus === 'pending' && '⏳'}
            {report.syncStatus === 'syncing' && '🔄'}
            {report.syncStatus === 'synced' && '✅'}
            {report.syncStatus === 'failed' && '❌'}
          </span>
          <div>
            <strong>
              Sync State: {report.syncStatus.toUpperCase()}
            </strong>
            {report.syncStatus === 'failed' && report.syncError && (
              <p className="sync-error-text">Error: {report.syncError}</p>
            )}
            {report.syncStatus === 'pending' && (
              <p className="sync-error-text">Saved locally. Waiting to synchronize with server.</p>
            )}
          </div>
        </div>

        {(report.syncStatus === 'pending' || report.syncStatus === 'failed') && (
          <button
            className="btn btn-sync-retry"
            onClick={handleRetrySync}
            disabled={retrying}
          >
            {retrying ? 'Retrying...' : '🔄 Retry Sync'}
          </button>
        )}
      </div>

      {/* Report Fields */}
      <div className="detail-grid">
        <div className="detail-item">
          <span className="detail-label">Category</span>
          <span className="detail-value">{CATEGORY_LABELS[report.category] || report.category}</span>
        </div>

        <div className="detail-item">
          <span className="detail-label">Priority</span>
          <span className={`badge priority-${report.priority}`}>
            {report.priority.toUpperCase()}
          </span>
        </div>

        <div className="detail-item">
          <span className="detail-label">Business Status</span>
          <span className={`badge status-${report.status}`}>
            {report.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        <div className="detail-item">
          <span className="detail-label">Location</span>
          <span className="detail-value">📍 {report.location}</span>
        </div>

        <div className="detail-item full-width">
          <span className="detail-label">Description</span>
          <p className="detail-description">{report.description}</p>
        </div>

        <div className="detail-item">
          <span className="detail-label">Reported At</span>
          <span className="detail-value">{new Date(report.reportedAt).toLocaleString()}</span>
        </div>

        <div className="detail-item">
          <span className="detail-label">Last Updated</span>
          <span className="detail-value">{new Date(report.updatedAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Workflow Action Panel */}
      <div className="workflow-actions-section">
        <h3>⚡ Status Transitions ({role === 'field_worker' ? 'Field Worker' : 'Coordinator'})</h3>
        {allowedActions.length === 0 ? (
          <p className="no-actions-text">
            {['resolved', 'rejected'].includes(report.status)
              ? 'This report is in a terminal state. No further status changes allowed.'
              : `No actions available for role "${role}" at status "${report.status.toUpperCase()}". Switch to Coordinator to manage workflow.`}
          </p>
        ) : (
          <div className="action-buttons-group">
            {allowedActions.map((act) => (
              <button
                key={act.target}
                className={`btn ${act.danger ? 'btn-danger' : 'btn-action'}`}
                onClick={() => handleStatusTransition(act.target)}
              >
                {act.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* History Timeline */}
      <div className="history-section">
        <h3>📜 History Timeline</h3>
        {history.length === 0 ? (
          <p className="no-actions-text">No history events logged yet.</p>
        ) : (
          <ul className="timeline">
            {history.map((evt) => (
              <li key={evt.id || `${evt.eventType}_${evt.timestamp}`} className="timeline-item">
                <div className="timeline-badge">
                  {evt.eventType.includes('CREATE') && '🌱'}
                  {evt.eventType.includes('STATUS') && '🔄'}
                  {evt.eventType.includes('SYNC_STARTED') && '⏳'}
                  {evt.eventType.includes('SYNC_SUCCEEDED') && '✅'}
                  {evt.eventType.includes('SYNC_FAILED') && '❌'}
                </div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="timeline-event-name">
                      {evt.eventType.replace('_', ' ')}
                    </span>
                    <span className="timeline-source-badge">
                      {evt.source}
                    </span>
                    <span className="timeline-time">
                      {new Date(evt.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {evt.fromStatus && evt.toStatus && (
                    <div className="timeline-transition">
                      Status: <span className="badge status-small">{evt.fromStatus}</span> →{' '}
                      <span className="badge status-small">{evt.toStatus}</span>
                    </div>
                  )}
                  {evt.details && <p className="timeline-details">{evt.details}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
