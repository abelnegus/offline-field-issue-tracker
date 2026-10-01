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

  // 1. Initial setup & online status listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto sync when coming online
      syncAllReports().catch((err) => console.warn('Auto sync on online event failed:', err));
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial seed check and data load
    (async () => {
      try {
        await seedDemoData();
      } catch (err) {
        console.warn('Seed demo data skipped or failed:', err);
      }
      await fetchReports();

      // Startup sync attempt if online
      if (navigator.onLine) {
        syncAllReports().catch((err) => console.warn('Startup sync failed:', err));
      }
    })();

    // Subscribe to sync manager events
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
    <div className="app-container">
      <Navbar
        role={role}
        onRoleChange={setRole}
        isOnline={isOnline}
        onReportCreated={fetchReports}
      />

      <main className="main-content">
        {!isOnline && (
          <div className="offline-banner">
            <span>📡 You are working offline. All reports are saved locally to IndexedDB and will sync when network is restored.</span>
          </div>
        )}

        <div className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            📋 Reports Dashboard ({reports.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => {
              setSelectedReportId(null);
              setActiveTab('create');
            }}
          >
            ➕ New Report
          </button>
        </div>

        {loading ? (
          <div className="loading-container">
            <p>Loading local reports database...</p>
          </div>
        ) : (
          <div className="content-layout">
            {activeTab === 'create' ? (
              <ReportForm onReportCreated={handleReportCreated} isOnline={isOnline} />
            ) : (
              <div className="dashboard-grid">
                <div className={`list-column ${selectedReportId ? 'has-selection' : ''}`}>
                  <ReportList
                    reports={reports}
                    selectedReportId={selectedReportId}
                    onSelectReport={(id) => setSelectedReportId(id)}
                    onNewReportClick={() => setActiveTab('create')}
                  />
                </div>

                {selectedReportId && (
                  <div className="detail-column">
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
