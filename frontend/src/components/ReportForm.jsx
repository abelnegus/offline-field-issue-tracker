import { useState } from 'react';
import { saveReport, saveHistory } from '../db/reportRepository.js';
import { syncSingleReport } from '../services/syncManager.js';

const CATEGORIES = [
  { value: 'water_point', label: '💧 Water Point' },
  { value: 'equipment', label: '⚡ Equipment' },
  { value: 'service_interruption', label: '🚫 Service Interruption' },
  { value: 'safety', label: '⚠️ Safety Hazard' },
  { value: 'maintenance', label: '🔧 General Maintenance' },
  { value: 'other', label: '📦 Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical 🔥' },
];

export default function ReportForm({ onReportCreated, isOnline }) {
  const [category, setCategory] = useState('water_point');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState('medium');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const validate = () => {
    const errs = {};
    if (!category) errs.category = 'Category is required.';
    if (!description.trim()) errs.description = 'Description is required.';
    if (description.length > 5000) errs.description = 'Description must not exceed 5000 characters.';
    if (!location.trim()) errs.location = 'Location is required.';
    if (!priority) errs.priority = 'Priority is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (targetStatus) => {
    if (!validate()) return;
    setSubmitting(true);
    setFeedback(null);

    const reportId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const now = new Date().toISOString();

    const newReport = {
      id: reportId,
      category,
      description: description.trim(),
      location: location.trim(),
      priority,
      status: targetStatus,
      reportedAt: now,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
      syncError: null,
    };

    try {
      // 1. Save to local IndexedDB
      await saveReport(newReport);
      await saveHistory({
        reportId: newReport.id,
        eventType: 'REPORT_CREATED',
        toStatus: newReport.status,
        timestamp: now,
        source: 'local',
        details: `Report created locally as ${targetStatus.toUpperCase()}.`,
      });

      // 2. Trigger sync if online
      if (isOnline) {
        syncSingleReport(newReport.id).catch((err) =>
          console.warn('Background sync error after creation:', err)
        );
      }

      setFeedback({
        type: 'success',
        message: `Report created successfully (${targetStatus.toUpperCase()})! ${
          isOnline ? 'Syncing with server...' : 'Saved locally (Pending Sync).'
        }`,
      });

      // Reset form
      setDescription('');
      setLocation('');
      setCategory('water_point');
      setPriority('medium');
      setErrors({});

      if (onReportCreated) {
        onReportCreated(newReport);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Failed to save report: ${err.message}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card form-card">
      <div className="card-header">
        <h2>📝 Report New Infrastructure Issue</h2>
        <span className="card-subtitle">Works online and offline</span>
      </div>

      {feedback && (
        <div className={`alert alert-${feedback.type}`}>
          {feedback.message}
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} className="report-form">
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="category">Category *</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={errors.category ? 'input-error' : ''}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            {errors.category && <span className="field-error">{errors.category}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="priority">Priority *</label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={errors.priority ? 'input-error' : ''}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {errors.priority && <span className="field-error">{errors.priority}</span>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="location">Location *</label>
          <input
            id="location"
            type="text"
            placeholder="e.g. Sector 4 Water Point, North Ridge"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={errors.location ? 'input-error' : ''}
            maxLength={255}
          />
          {errors.location && <span className="field-error">{errors.location}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="description">Issue Description *</label>
          <textarea
            id="description"
            rows={4}
            placeholder="Describe the issue, damage, or operational disruption in detail..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={errors.description ? 'input-error' : ''}
            maxLength={5000}
          />
          <div className="form-help">
            <span>{description.length}/5000 characters</span>
            {errors.description && <span className="field-error">{errors.description}</span>}
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleSubmit('draft')}
            disabled={submitting}
          >
            💾 Save as Draft
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleSubmit('submitted')}
            disabled={submitting}
          >
            🚀 Submit Report
          </button>
        </div>
      </form>
    </div>
  );
}
