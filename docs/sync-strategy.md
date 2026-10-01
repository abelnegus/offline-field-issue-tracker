# Synchronization Strategy & Data Integrity

## Sync vs Business Status

To provide clear visibility without confusing business domain rules with technical connectivity, the application strictly decouples **Business Status** from **Sync Status**:

- **Business Status**: `draft`, `submitted`, `assigned`, `in_progress`, `resolved`, `rejected`.
- **Sync Status**: `pending`, `syncing`, `synced`, `failed`.

Example state:
```json
{
  "id": "c8a40d70-3d71-4b10-8e10-18e3c54d1a01",
  "status": "submitted",
  "syncStatus": "pending"
}
```
*Interpretation*: "The worker submitted the issue report locally, but it has not reached the server yet."

## Synchronization Lifecycle & State Machine

```
   Local Creation / Update
             |
             v
      [ syncStatus: 'pending' ]
             |
             | (Sync Triggered: Startup / Online Event / Sync Now Button)
             v
      [ syncStatus: 'syncing' ] ---> Logs SYNC_STARTED local event
             |
     +-------+-------+
     |               |
(HTTP 200/201) (Network Error / HTTP 5xx)
     |               |
     v               v
[ 'synced' ]    [ 'failed' ]  <--- Retains report & syncError in IndexedDB!
 Logs           Logs
 SYNC_SUCCEEDED SYNC_FAILED
                     |
                     | (User Clicks "Retry Sync")
                     +----------------------------+
```

## Duplicate Prevention & Idempotency Key

1. Before any network call, a standard RFC 4122 UUID v4 is generated on the client via `crypto.randomUUID()`.
2. When retrying a failed synchronization attempt, **the same UUID is reused**.
3. The FastAPI backend endpoint `POST /api/reports` checks if a report with the client-provided UUID already exists:
   - **Identical Payload**: Server returns HTTP 201/200 with existing report (Idempotent success).
   - **Conflicting Data**: Server returns HTTP 409 Conflict.
4. This guarantees zero duplicate server records even under poor connectivity or repeated retries.

## Partial Sync Failures

When synchronizing multiple pending items:
- Each report synchronization runs independently inside a `for` loop.
- If Report A succeeds and Report B fails due to a temporary network blip, Report A is marked `synced` and Report B is marked `failed`.
- The failure of one report never halts or rolls back independent valid reports.
- At completion, the Sync Manager emits a summary notification (e.g., `3 reports synced, 1 failed`).
