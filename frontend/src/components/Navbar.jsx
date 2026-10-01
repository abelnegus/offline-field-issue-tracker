import { useState, useEffect } from 'react';
import { syncAllReports, isSyncingInProgress, subscribeToSyncEvents } from '../services/syncManager';

export default function Navbar({ role, onRoleChange, isOnline, onReportCreated }) {
  const [syncing, setSyncing] = useState(isSyncingInProgress());
  const [syncSummaryMessage, setSyncSummaryMessage] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToSyncEvents((event) => {
      if (event.type === 'SYNC_ALL_STARTED' || event.type === 'SYNC_SINGLE_STARTED') {
        setSyncing(true);
        setSyncSummaryMessage(null);
      } else if (event.type === 'SYNC_ALL_COMPLETED') {
        setSyncing(false);
        const { total, synced, failed } = event.summary;
        if (total > 0) {
          setSyncSummaryMessage(`${synced} synced, ${failed} failed`);
          setTimeout(() => setSyncSummaryMessage(null), 5000);
        } else {
          setSyncSummaryMessage('All items up to date');
          setTimeout(() => setSyncSummaryMessage(null), 3000);
        }
        if (onReportCreated) onReportCreated();
      } else if (event.type === 'SYNC_SINGLE_SUCCESS' || event.type === 'SYNC_SINGLE_FAILED') {
        setSyncing(false);
        if (onReportCreated) onReportCreated();
      }
    });

    return () => unsubscribe();
  }, [onReportCreated]);

  const handleManualSync = async () => {
    if (syncing) return;
    setSyncing(true);
    await syncAllReports();
    setSyncing(false);
  };

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">🛠️</span>
        <div className="brand-text">
          <h1>Offline Field Tracker</h1>
          <span className="brand-subtitle">Infrastructure Issue Portal</span>
        </div>
      </div>

      <div className="navbar-controls">
        <div className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
          <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </div>

        <button
          type="button"
          className={`btn btn-sync ${syncing ? 'syncing' : ''}`}
          onClick={handleManualSync}
          disabled={syncing}
        >
          <span className={`sync-icon ${syncing ? 'spin' : ''}`}>🔄</span>
          <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>

        {syncSummaryMessage && (
          <span className="sync-summary-toast">{syncSummaryMessage}</span>
        )}

        <div className="role-selector">
          <label htmlFor="role-select">Role:</label>
          <select
            id="role-select"
            value={role}
            onChange={(e) => onRoleChange(e.target.value)}
            className="role-dropdown"
          >
            <option value="field_worker">👷 Field Worker</option>
            <option value="coordinator">📋 Coordinator</option>
          </select>
        </div>
      </div>
    </header>
  );
}
