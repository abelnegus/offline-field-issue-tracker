const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

async function handleResponse(response) {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage = typeof errorData.detail === 'string'
          ? errorData.detail
          : JSON.stringify(errorData.detail);
      }
    } catch {
      // Ignore JSON parse failure
    }
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function checkHealth() {
  const res = await fetch(`${BASE_URL}/api/health`);
  return handleResponse(res);
}

export async function createReport(reportData) {
  const payload = {
    id: reportData.id,
    category: reportData.category,
    description: reportData.description,
    location: reportData.location,
    priority: reportData.priority,
    status: reportData.status || 'draft',
    reported_at: reportData.reportedAt || reportData.reported_at || new Date().toISOString(),
  };

  const res = await fetch(`${BASE_URL}/api/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(res);
}

export async function getReports() {
  const res = await fetch(`${BASE_URL}/api/reports`);
  return handleResponse(res);
}

export async function getReport(reportId) {
  const res = await fetch(`${BASE_URL}/api/reports/${reportId}`);
  return handleResponse(res);
}

export async function updateReportStatus(reportId, newStatus) {
  const res = await fetch(`${BASE_URL}/api/reports/${reportId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: newStatus }),
  });
  return handleResponse(res);
}

export async function getReportHistory(reportId) {
  const res = await fetch(`${BASE_URL}/api/reports/${reportId}/history`);
  return handleResponse(res);
}
