import { useState, useMemo } from 'react';

const CATEGORY_LABELS = {
  water_point: 'Water Point',
  equipment: 'Equipment',
  service_interruption: 'Service Interruption',
  safety: 'Safety Hazard',
  maintenance: 'General Maintenance',
  other: 'Other Infrastructure',
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
      return d.toLocaleDateString(undefined, {
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
      {/* Dashboard Summary Strip */}
      <div className="summary-strip">
        <div
          className={`summary-card ${syncFilter === 'all' ? 'is-active' : ''}`}
          onClick={() => setSyncFilter('all')}
        >
          <span className="summary-label">TOTAL REPORTS</span>
          <div className="summary-val-row">
            <span className="summary-number">{counts.total}</span>
            <span className="summary-subtext">all logged</span>
          </div>
        </div>

        <div
          className={`summary-card status-pending-card ${syncFilter === 'pending' ? 'is-active' : ''}`}
          onClick={() => setSyncFilter(syncFilter === 'pending' ? 'all' : 'pending')}
        >
          <span className="summary-label">PENDING SYNC</span>
          <div className="summary-val-row">
            <span className="summary-number">{counts.pending}</span>
            <span className="summary-subtext">waiting for network</span>
          </div>
        </div>

        <div
          className={`summary-card status-synced-card ${syncFilter === 'synced' ? 'is-active' : ''}`}
          onClick={() => setSyncFilter(syncFilter === 'synced' ? 'all' : 'synced')}
        >
          <span className="summary-label">SYNCED</span>
          <div className="summary-val-row">
            <span className="summary-number">{counts.synced}</span>
            <span className="summary-subtext">saved on server</span>
          </div>
        </div>

        <div
          className={`summary-card status-failed-card ${syncFilter === 'failed' ? 'is-active' : ''}`}
          onClick={() => setSyncFilter(syncFilter === 'failed' ? 'all' : 'failed')}
        >
          <span className="summary-label">FAILED SYNC</span>
          <div className="summary-val-row">
            <span className="summary-number">{counts.failed}</span>
            <span className="summary-subtext">{counts.failed === 0 ? 'no errors' : 'requires retry'}</span>
          </div>
        </div>
      </div>

      {/* Action Bar & Filters */}
      <div className="control-toolbar">
        <div className="search-field">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Filter location, description, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>

        <div className="filter-selects">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by Business Status">
            <option value="all">Status: All</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select value={syncFilter} onChange={(e) => setSyncFilter(e.target.value)} aria-label="Filter by Sync State">
            <option value="all">Sync: All</option>
            <option value="pending">Pending Sync</option>
            <option value="syncing">Syncing...</option>
            <option value="synced">Synced</option>
            <option value="failed">Failed Sync</option>
          </select>

          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="Filter by Priority">
            <option value="all">Priority: All</option>
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

      {/* Reports List */}
      <div className="report-items-container">
        {filteredReports.length === 0 ? (
          <div className="empty-list-panel">
            <div className="empty-panel-inner">
              <h3>No reports found</h3>
              <p>Adjust your search query or status filters, or create a new issue report.</p>
              <button className="btn btn-primary" onClick={onNewReportClick}>
                + Create Issue Report
              </button>
            </div>
          </div>
        ) : (
          filteredReports.map((report) => {
            const isSelected = report.id === selectedReportId;
            return (
              <div
                key={report.id}
                className={`report-item-row ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onSelectReport(report.id)}
              >
                <div className="report-row-top">
                  <div className="category-tag">
                    {CATEGORY_LABELS[report.category] || report.category}
                  </div>
                  <div className="row-badges">
                    <span className={`badge-pill priority-${report.priority}`}>
                      {report.priority.toUpperCase()}
                    </span>
                    <span className={`badge-pill status-${report.status}`}>
                      {report.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className={`badge-pill sync-${report.syncStatus}`}>
                      {report.syncStatus === 'pending' && 'Pending Sync'}
                      {report.syncStatus === 'syncing' && 'Syncing...'}
                      {report.syncStatus === 'synced' && 'Synced'}
                      {report.syncStatus === 'failed' && 'Failed Sync'}
                    </span>
                  </div>
                </div>

                <div className="report-row-body">
                  <p className="description-text">{report.description}</p>
                </div>

                <div className="report-row-meta">
                  <span className="meta-location">📍 {report.location}</span>
                  <span className="meta-date">{formatDate(report.reportedAt)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
