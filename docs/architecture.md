# System Architecture

## Overview

The Offline Field Issue Tracker is built using a local-first offline architecture. The primary goal is to empower field workers operating in environments with intermittent or nonexistent network connectivity to create, view, and transition issue reports without data loss.

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

## Core Components

### 1. Frontend Client (React 19 + Vite)
- **Local Source of Truth**: The browser's IndexedDB is treated as the local source of truth for the field worker UI.
- **Role Simulation**: Allows switching between `Field Worker` (report creation, draft submission) and `Coordinator` (report assignment, in-progress state, resolution, rejection).

### 2. IndexedDB Storage Layer (`frontend/src/db/`)
- Uses `idb` for promise-wrapped IndexedDB transactions.
- Store `reports`:
  - Primary Key: `id` (Client-generated UUID v4)
  - Indexes: `syncStatus`, `status`, `updatedAt`
- Store `history`:
  - Primary Key: `id` (Client-generated UUID v4)
  - Indexes: `reportId`, `timestamp`

### 3. Synchronization Manager (`frontend/src/services/syncManager.js`)
- Responsible for pushing unsynced reports (`pending` or `failed`) to the backend REST API.
- Implements an in-memory lock `isSyncing` to prevent concurrent sync operations.
- Listens to browser `online` events, application startup, and manual "Sync Now" triggers.

### 4. Backend Service (FastAPI + SQLAlchemy 2 + SQLite)
- RESTful HTTP API running on Uvicorn.
- Strictly enforces valid business status transitions through `can_transition(current, target)` workflow guard.
- Stores data in `offline_tracker.db` SQLite database with automatic schema migrations.
