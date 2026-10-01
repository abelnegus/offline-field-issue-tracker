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
          setSyncSummaryMessage('Up to date');
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
      <div className="navbar-left">
        <div className="navbar-brand">
          <div className="brand-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-title">Field Issue Tracker</span>
            <span className="brand-subtitle">Municipal Operations & Maintenance</span>
          </div>
        </div>
      </div>

      <div className="navbar-right">
        <div className={`network-pill ${isOnline ? 'online' : 'offline'}`}>
          <span className="network-dot"></span>
          <span className="network-label">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        <button
          type="button"
          className={`btn-sync ${syncing ? 'is-syncing' : ''}`}
          onClick={handleManualSync}
          disabled={syncing}
          title="Synchronize local reports with backend server"
        >
          <svg className={`sync-icon ${syncing ? 'spinning' : ''}`} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>

        {syncSummaryMessage && (
          <span className="sync-toast-msg">{syncSummaryMessage}</span>
        )}

        <div className="role-switcher">
          <span className="role-label">Role:</span>
          <select
            id="role-select"
            value={role}
            onChange={(e) => onRoleChange(e.target.value)}
            className="role-select"
            aria-label="Select User Role"
          >
            <option value="field_worker">Field Worker</option>
            <option value="coordinator">Coordinator</option>
          </select>
        </div>
      </div>
    </header>
  );
}
