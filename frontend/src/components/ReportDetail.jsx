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
  water_point: 'Water Point',
  equipment: 'Equipment',
  service_interruption: 'Service Interruption',
  safety: 'Safety Hazard',
  maintenance: 'General Maintenance',
  other: 'Other Infrastructure',
};

const VALID_TRANSITIONS = {
  draft: [{ target: 'submitted', label: 'Submit Report', roles: ['field_worker', 'coordinator'] }],
  submitted: [
    { target: 'assigned', label: 'Assign Report', roles: ['coordinator'], primary: true },
    { target: 'rejected', label: 'Reject Report', roles: ['coordinator'], danger: true },
  ],
  assigned: [
    { target: 'in_progress', label: 'Start Work (In Progress)', roles: ['coordinator'], primary: true },
    { target: 'rejected', label: 'Reject Report', roles: ['coordinator'], danger: true },
  ],
  in_progress: [
    { target: 'resolved', label: 'Mark Resolved', roles: ['coordinator'], success: true },
    { target: 'rejected', label: 'Reject Report', roles: ['coordinator'], danger: true },
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
      const localRep = await getReport(reportId);
      setReport(localRep);

      const localHist = await getLocalReportHistory(reportId);

      let mergedHistory = [...localHist];
      if (localRep?.syncStatus === 'synced' && isOnline) {
        try {
          const serverHist = await apiGetHistory(reportId);
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
          // Ignore server fetch errors
        }
      }

      mergedHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setHistory(mergedHistory);
    } catch (err) {
      setActionError(`Error loading report: ${err.message}`);
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
        setActionSuccess('Report synchronized with server successfully.');
      } else {
        setActionError(`Sync failed: ${res.error || 'Server connection error'}`);
      }
      await loadData();
      if (onReportUpdated) onReportUpdated();
    } catch (err) {
      setActionError(`Retry failed: ${err.message}`);
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
        details: `Status changed from ${oldStatus.toUpperCase()} to ${newStatus.toUpperCase()} by ${role.replace('_', ' ')}.`,
      });

      if (report.syncStatus === 'synced' && isOnline) {
        try {
          await apiUpdateStatus(report.id, newStatus);
        } catch (apiErr) {
          setActionError(`Backend warning: ${apiErr.message}`);
        }
      } else if (report.syncStatus === 'synced' && !isOnline) {
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
      <div className="panel detail-panel">
        <p className="loading-text">Loading report details...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="panel detail-panel">
        <p>Report not found.</p>
        <button className="btn btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }

  const allowedActions = (VALID_TRANSITIONS[report.status] || []).filter((action) =>
    action.roles.includes(role)
  );

  return (
    <div className="panel detail-panel">
      <div className="detail-panel-header">
        <div>
          <h2 className="detail-title">{CATEGORY_LABELS[report.category] || report.category}</h2>
          <span className="detail-id">ID: {report.id}</span>
        </div>
        <button className="panel-close-btn" onClick={onClose} aria-label="Close detail view">
          ×
        </button>
      </div>

      {actionError && <div className="form-alert alert-error">{actionError}</div>}
      {actionSuccess && <div className="form-alert alert-success">{actionSuccess}</div>}

      {/* Sync Status Alert Banner */}
      <div className={`sync-status-box sync-box-${report.syncStatus}`}>
        <div className="sync-box-content">
          <div className="sync-box-header">
            <span className="sync-box-title">
              Sync State: {report.syncStatus.toUpperCase()}
            </span>
          </div>
          {report.syncStatus === 'failed' && report.syncError && (
            <p className="sync-box-msg">{report.syncError}</p>
          )}
          {report.syncStatus === 'pending' && (
            <p className="sync-box-msg">Report saved locally. Awaiting network connection to sync with server.</p>
          )}
          {report.syncStatus === 'synced' && (
            <p className="sync-box-msg">Report is fully synchronized with central server.</p>
          )}
        </div>

        {(report.syncStatus === 'pending' || report.syncStatus === 'failed') && (
          <button
            className="btn btn-outline btn-sm"
            onClick={handleRetrySync}
            disabled={retrying}
          >
            {retrying ? 'Retrying...' : 'Retry Sync'}
          </button>
        )}
      </div>

      {/* Structured Details */}
      <div className="detail-data-grid">
        <div className="data-cell">
          <span className="cell-label">PRIORITY</span>
          <span className={`badge-pill priority-${report.priority}`}>
            {report.priority.toUpperCase()}
          </span>
        </div>

        <div className="data-cell">
          <span className="cell-label">BUSINESS STATUS</span>
          <span className={`badge-pill status-${report.status}`}>
            {report.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        <div className="data-cell full-width">
          <span className="cell-label">LOCATION</span>
          <span className="cell-value-text">📍 {report.location}</span>
        </div>

        <div className="data-cell full-width">
          <span className="cell-label">DESCRIPTION</span>
          <p className="cell-description-box">{report.description}</p>
        </div>

        <div className="data-cell">
          <span className="cell-label">REPORTED AT</span>
          <span className="cell-sub-text">{new Date(report.reportedAt).toLocaleString()}</span>
        </div>

        <div className="data-cell">
          <span className="cell-label">LAST UPDATED</span>
          <span className="cell-sub-text">{new Date(report.updatedAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Workflow Controls Section */}
      <div className="workflow-control-section">
        <h3 className="section-heading">
          Status Workflow Actions <span className="role-context">({role === 'field_worker' ? 'Field Worker' : 'Coordinator'})</span>
        </h3>
        {allowedActions.length === 0 ? (
          <p className="workflow-muted-note">
            {['resolved', 'rejected'].includes(report.status)
              ? 'Report is in a terminal state. No further status changes permitted.'
              : `No actions available for role "${role === 'field_worker' ? 'Field Worker' : 'Coordinator'}" at status "${report.status.toUpperCase()}". Switch roles in the navbar to manage coordinator workflow.`}
          </p>
        ) : (
          <div className="workflow-btn-row">
            {allowedActions.map((act) => (
              <button
                key={act.target}
                className={`btn ${
                  act.danger
                    ? 'btn-danger'
                    : act.success
                    ? 'btn-success'
                    : 'btn-primary'
                }`}
                onClick={() => handleStatusTransition(act.target)}
              >
                {act.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      <div className="history-activity-section">
        <h3 className="section-heading">History Timeline</h3>
        {history.length === 0 ? (
          <p className="workflow-muted-note">No history records logged yet.</p>
        ) : (
          <div className="activity-timeline">
            {history.map((evt) => (
              <div key={evt.id || `${evt.eventType}_${evt.timestamp}`} className="timeline-row">
                <div className="timeline-node"></div>
                <div className="timeline-card">
                  <div className="timeline-card-header">
                    <span className="event-type-name">{evt.eventType.replace('_', ' ')}</span>
                    <span className="source-tag">{evt.source}</span>
                    <span className="event-timestamp">{new Date(evt.timestamp).toLocaleString()}</span>
                  </div>
                  {evt.fromStatus && evt.toStatus && (
                    <div className="event-transition-text">
                      Status: <code>{evt.fromStatus}</code> → <code>{evt.toStatus}</code>
                    </div>
                  )}
                  {evt.details && <p className="event-detail-text">{evt.details}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
