import { useState, useMemo } from 'react';

const CATEGORY_LABELS = {
  water_point: '💧 Water Point',
  equipment: '⚡ Equipment',
  service_interruption: '🚫 Service Interruption',
  safety: '⚠️ Safety',
  maintenance: '🔧 Maintenance',
  other: '📦 Other',
};

export default function ReportList({ reports, selectedReportId, onSelectReport, onNewReportClick }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [syncFilter, setSyncFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const counts = useMemo(() => {
    return {
      total: reports.length,
      pending: reports.filter((r) => r.syncStatus === 'pending').length,
      synced: reports.filter((r) => r.syncStatus === 'synced').length,
      failed: reports.filter((r) => r.syncStatus === 'failed').length,
    };
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (statusFilter !== 'all' && report.status !== statusFilter) return false;
      if (syncFilter !== 'all' && report.syncStatus !== syncFilter) return false;
      if (priorityFilter !== 'all' && report.priority !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchLoc = report.location.toLowerCase().includes(query);
        const matchDesc = report.description.toLowerCase().includes(query);
        const matchId = report.id.toLowerCase().includes(query);
        if (!matchLoc && !matchDesc && !matchId) return false;
      }
      return true;
    });
  }, [reports, statusFilter, syncFilter, priorityFilter, searchQuery]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="report-list-container">
      {/* Dashboard Metrics */}
      <div className="metrics-grid">
        <div className="metric-card metric-total">
          <span className="metric-icon">📊</span>
          <div className="metric-data">
            <span className="metric-value">{counts.total}</span>
            <span className="metric-label">Total Reports</span>
          </div>
        </div>

        <div
          className={`metric-card metric-pending ${syncFilter === 'pending' ? 'active' : ''}`}
          onClick={() => setSyncFilter(syncFilter === 'pending' ? 'all' : 'pending')}
        >
          <span className="metric-icon">⏳</span>
          <div className="metric-data">
            <span className="metric-value">{counts.pending}</span>
            <span className="metric-label">Pending Sync</span>
          </div>
        </div>

        <div
          className={`metric-card metric-synced ${syncFilter === 'synced' ? 'active' : ''}`}
          onClick={() => setSyncFilter(syncFilter === 'synced' ? 'all' : 'synced')}
        >
          <span className="metric-icon">✅</span>
          <div className="metric-data">
            <span className="metric-value">{counts.synced}</span>
            <span className="metric-label">Synced</span>
          </div>
        </div>

        <div
          className={`metric-card metric-failed ${syncFilter === 'failed' ? 'active' : ''}`}
          onClick={() => setSyncFilter(syncFilter === 'failed' ? 'all' : 'failed')}
        >
          <span className="metric-icon">⚠️</span>
          <div className="metric-data">
            <span className="metric-value">{counts.failed}</span>
            <span className="metric-label">Failed Sync</span>
          </div>
        </div>
      </div>

      {/* Control Bar & Filters */}
      <div className="list-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search location, description, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>

        <div className="filter-group">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Business Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select value={syncFilter} onChange={(e) => setSyncFilter(e.target.value)}>
            <option value="all">All Sync States</option>
            <option value="pending">Pending Sync</option>
            <option value="syncing">Syncing...</option>
            <option value="synced">Synced</option>
            <option value="failed">Failed Sync</option>
          </select>

          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <button className="btn btn-primary" onClick={onNewReportClick}>
            + New Report
          </button>
        </div>
      </div>

      {/* Report Cards List */}
      <div className="report-cards-list">
        {filteredReports.length === 0 ? (
          <div className="empty-state card">
            <span className="empty-icon">📭</span>
            <h3>No reports found</h3>
            <p>Try adjusting your search query or filters, or create a new report.</p>
            <button className="btn btn-primary" onClick={onNewReportClick}>
              + Create Report
            </button>
          </div>
        ) : (
          filteredReports.map((report) => {
            const isSelected = report.id === selectedReportId;
            return (
              <div
                key={report.id}
                className={`report-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectReport(report.id)}
              >
                <div className="report-card-header">
                  <span className="report-category">
                    {CATEGORY_LABELS[report.category] || report.category}
                  </span>
                  <div className="report-badges">
                    <span className={`badge priority-${report.priority}`}>
                      {report.priority.toUpperCase()}
                    </span>
                    <span className={`badge status-${report.status}`}>
                      {report.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className={`badge sync-${report.syncStatus}`}>
                      {report.syncStatus === 'pending' && '⏳ Pending Sync'}
                      {report.syncStatus === 'syncing' && '🔄 Syncing...'}
                      {report.syncStatus === 'synced' && '✅ Synced'}
                      {report.syncStatus === 'failed' && '❌ Sync Failed'}
                    </span>
                  </div>
                </div>

                <div className="report-card-body">
                  <p className="report-description">{report.description}</p>
                </div>

                <div className="report-card-footer">
                  <span className="report-location">📍 {report.location}</span>
                  <span className="report-time">🕒 {formatDate(report.reportedAt)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
