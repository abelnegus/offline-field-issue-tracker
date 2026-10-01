# Offline Field Issue Tracker

A full-stack, offline-first web application designed for infrastructure field workers reporting issues in areas with unreliable or absent connectivity.

---

## Problem Statement

Field workers monitoring water points, power equipment, and civil infrastructure frequently work in remote areas where mobile network coverage drops unpredictably. Traditional web applications fail when offline, resulting in lost reports, unsaved draft descriptions, and duplicated server records upon reconnection.

The **Offline Field Issue Tracker** solves this by establishing **browser IndexedDB as the local source of truth**. Field workers can create, draft, submit, and inspect reports entirely offline. Once network connectivity is restored, the dedicated **Sync Manager** synchronizes pending reports idempotently with the backend REST API without data loss or record duplication.

---

## Core Features

- 📝 **Offline Report Creation & Draft Management**: Create issue reports with categories (`water_point`, `equipment`, `service_interruption`, `safety`, `maintenance`, `other`), descriptions, locations, and priorities (`low`, `medium`, `high`, `critical`).
- 💾 **IndexedDB Local Persistence**: All reports and timeline events survive browser refreshes, tab closures, and device restarts.
- 🔄 **Idempotent Synchronization Engine**: Automatic background sync on startup and online network events, plus manual "Sync Now" controls.
- 🛡️ **Zero Data Loss Guarantee**: Failed synchronization attempts retain local records and record `syncError` details for easy retry.
- 🔑 **Client-Generated UUID Idempotency**: Pre-generates standard UUIDs locally; retries send identical IDs so the backend deduplicates requests gracefully.
- 🚦 **Decoupled Status Workflow**: Business status (`draft` -> `submitted` -> `assigned` -> `in_progress` -> `resolved` / `rejected`) is kept distinct from sync state (`pending`, `syncing`, `synced`, `failed`).
- 👥 **Role Simulation**: Seamless UI toggle between `Field Worker` and `Coordinator` roles to test end-to-end workflow transitions.
- 📜 **Unified History Timeline**: Combines client-side IndexedDB events and server audit history into a single timeline.

---

## Architecture Overview

```
+-------------------------------------------------------------+
|                      React Single Page App                  |
|  +-------------------+  +---------------------------------+  |
|  | Field Worker UI   |  | Coordinator Status Workflow UI  |  |
|  +-------------------+  +---------------------------------+  |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                     IndexedDB Repository                    |
|        (Local Storage: 'reports' & 'history' stores)        |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                    Synchronization Manager                  |
|   (Concurrency Lock, Idempotent UUID Sync, Retry Handler)   |
+-------------------------------------------------------------+
                               | (HTTP / REST API)
                               v
+-------------------------------------------------------------+
|                      FastAPI Backend                        |
|       (Pydantic Schemas, Workflow Guard, Service Layer)     |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                       SQLite Database                       |
|           (Relational Server Persistence Storage)           |
+-------------------------------------------------------------+
```

### Technical Stack
- **Frontend**: React 19, Vite, Vanilla CSS, `idb` (IndexedDB Promise wrapper), Vitest, Testing Library.
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, Pytest, HTTPX, SQLite.

---

## Synchronization Strategy & State Machine

The Sync Manager (`frontend/src/services/syncManager.js`) manages report synchronization through an isolated state machine:

1. **`pending`**: Report created or updated locally while offline/unsynced.
2. **`syncing`**: Sync process acquired in-memory lock and initiated `POST /api/reports`. Emits `SYNC_STARTED` local history event.
3. **`synced`**: Server returned 200/201 HTTP status. Emits `SYNC_SUCCEEDED` event and clears `syncError`.
4. **`failed`**: Network failure or HTTP 5xx error. Emits `SYNC_FAILED` event, stores error message in `syncError`, and **retains the report in IndexedDB** for manual or automatic retry.

### Duplicate Prevention Strategy
When a field worker retries a failed synchronization, the Sync Manager sends the **original client-generated UUID** in the POST payload. The FastAPI backend `create_report` service checks for existing records:
- **Same UUID + Identical Payload**: Returns existing record (Idempotent 200/201).
- **Same UUID + Conflicting Data**: Returns HTTP 409 Conflict.

---

## Report Workflow Rules

Business status transitions are enforced by the backend workflow guard (`app/services/report_workflow.py`):

```
[ Draft ] ----------> [ Submitted ] ----------> [ Assigned ] ----------> [ In Progress ] ----------> [ Resolved ]
                          |                         |                        |
                          v                         v                        v
                     [ Rejected ]              [ Rejected ]             [ Rejected ]
```

- `Draft` → `Submitted` *(Allowed for Field Workers and Coordinators)*
- `Submitted` → `Assigned` / `Rejected` *(Coordinator only)*
- `Assigned` → `In Progress` / `Rejected` *(Coordinator only)*
- `In Progress` → `Resolved` / `Rejected` *(Coordinator only)*
- `Resolved` and `Rejected` are terminal states.

---

## Project Setup & Running Locally

### 1. Prerequisites
- Python 3.12+
- Node.js 18+ & npm

### 2. Backend Setup
```bash
cd backend
# Activate virtual environment (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Install requirements (if needed)
pip install -r requirements.txt

# Start FastAPI dev server
python -m uvicorn app.main:app --reload
```
The API server will run on `http://127.0.0.1:8000`.

### 3. Frontend Setup
```bash
cd frontend
# Install dependencies
npm.cmd install

# Start Vite dev server
npm.cmd run dev
```
Open `http://localhost:5173` in your browser.

---

## Running Automated Tests

### Backend Unit & API Tests (Pytest)
```bash
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest tests
```
*Executes 16 tests covering workflow rules, service logic, duplicate idempotency, and API endpoints.*

### Frontend Vitest Suite (IndexedDB & Sync Engine)
```bash
cd frontend
npm.cmd test
```
*Executes 9 tests verifying IndexedDB persistence, sync scenarios A-E, retry mechanics, and history logging.*

---

## Assumptions & Design Decisions

1. **No Authentication**: Authentication is omitted per requirements. Role switching (`Field Worker` vs `Coordinator`) is simulated via a header dropdown control.
2. **Client-Driven Identity**: The client generates UUID v4 identifiers before synchronization, enabling immediate local persistence and offline history tracking.
3. **Draft Editing Scope**: Draft reports can be edited locally; once submitted, server workflow authority governs status transitions.
4. **Data Loss Safety**: Sync failure never deletes local records. All failed reports remain inspectable and retryable in IndexedDB.
5. **SQLite Usage**: SQLite is lightweight and suitable for this take-home exercise demonstration.

---

## Known Limitations

- **Browser Storage Bound**: IndexedDB is isolated per browser/device. Unsynced local reports on one device are not visible on another device until synced to the server.
- **No Conflict Resolution Engine**: Concurrent server-side edits by multiple coordinators rely on version numbers; complex multi-user field merge resolution is omitted.
- **No Attachments / Maps**: File uploads, photos, and live GPS mapping are intentionally omitted per exercise scope.

---

## Manual QA Checklist

Refer to [docs/manual-qa.md](docs/manual-qa.md) for full step-by-step manual test procedures covering offline creation, page refresh, reconnection sync, failure retry, and coordinator workflow validation.

---

## Time Spent

Estimated approximate time spent on implementation: `[ 4.5 hours ]`

---

## Future Improvements

- Service Worker & Background Sync API integration.
- Attachment/Photo upload with local blob caching in IndexedDB.
- Geographic map interface with offline tile caching.
- Multi-user conflict resolution with 3-way visual merge.

---

## AI & Development Tool Disclosure

AI assistance (Antigravity AI Pair Programmer) was used during development to plan architecture, write test suites, build React components, and draft documentation. All code was verified, tested, and validated against explicit exercise criteria.