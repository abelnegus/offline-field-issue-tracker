import { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar.jsx';
import ReportForm from './components/ReportForm.jsx';
import ReportList from './components/ReportList.jsx';
import ReportDetail from './components/ReportDetail.jsx';
import { getAllReports, seedDemoData } from './db/reportRepository.js';
import { syncAllReports, subscribeToSyncEvents } from './services/syncManager.js';
import './App.css';

export default function App() {
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'
  const [role, setRole] = useState('field_worker'); // 'field_worker' | 'coordinator'
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      const data = await getAllReports();
      setReports(data);
    } catch (err) {
      console.error('Failed to load reports from IndexedDB:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncAllReports().catch((err) => console.warn('Auto sync on online event failed:', err));
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    (async () => {
      try {
        await seedDemoData();
      } catch (err) {
        console.warn('Seed demo data skipped or failed:', err);
      }
      await fetchReports();

      if (navigator.onLine) {
        syncAllReports().catch((err) => console.warn('Startup sync failed:', err));
      }
    })();

    const unsubscribeSync = subscribeToSyncEvents(() => {
      fetchReports();
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeSync();
    };
  }, [fetchReports]);

  const handleReportCreated = () => {
    fetchReports();
    setActiveTab('list');
  };

  const handleReportUpdated = () => {
    fetchReports();
  };

  return (
    <div className="app-shell">
      <Navbar
        role={role}
        onRoleChange={setRole}
        isOnline={isOnline}
        onReportCreated={fetchReports}
      />

      <main className="app-main">
        {!isOnline && (
          <div className="system-banner offline-banner">
            <span className="banner-dot"></span>
            <span>Operating in Offline Mode — Reports are saved locally to IndexedDB and will synchronize automatically when connectivity is restored.</span>
          </div>
        )}

        <div className="app-subhead">
          <div className="view-tabs">
            <button
              className={`view-tab-btn ${activeTab === 'list' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('list')}
            >
              Reports Dashboard ({reports.length})
            </button>
            <button
              className={`view-tab-btn ${activeTab === 'create' ? 'is-active' : ''}`}
              onClick={() => {
                setSelectedReportId(null);
                setActiveTab('create');
              }}
            >
              + Create New Report
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-panel">
            <p>Initializing local database...</p>
          </div>
        ) : (
          <div className="view-content">
            {activeTab === 'create' ? (
              <ReportForm onReportCreated={handleReportCreated} isOnline={isOnline} />
            ) : (
              <div className={`workspace-split ${selectedReportId ? 'has-detail' : ''}`}>
                <div className="split-list-pane">
                  <ReportList
                    reports={reports}
                    selectedReportId={selectedReportId}
                    onSelectReport={(id) => setSelectedReportId(id)}
                    onNewReportClick={() => setActiveTab('create')}
                  />
                </div>

                {selectedReportId && (
                  <div className="split-detail-pane">
                    <ReportDetail
                      reportId={selectedReportId}
                      role={role}
                      isOnline={isOnline}
                      onClose={() => setSelectedReportId(null)}
                      onReportUpdated={handleReportUpdated}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
