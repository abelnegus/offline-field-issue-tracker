# Manual QA Checklist

Follow this manual test procedure to verify offline persistence, synchronization, status workflow, and error resilience.

## Test Matrix

| Step | Action | Expected Behavior | Pass/Fail |
|------|--------|-------------------|-----------|
| 1 | **Online Draft Creation** | Open app online. Create report as "Draft". | Report appears in list with `DRAFT` status and `synced` (or `pending` then auto `synced`). |
| 2 | **Go Offline & Create** | Disconnect network / stop backend server. Create report as "Submitted". | App shows `OFFLINE` badge. Report created with `SUBMITTED` status and yellow `⏳ Pending Sync` badge. |
| 3 | **Page Refresh Persistence** | Refresh the browser page (`F5`). | Report remains present in IndexedDB and retains `SUBMITTED` and `Pending Sync` states. |
| 4 | **Re-connect Network & Sync** | Re-connect network / start backend server. Click "Sync Now". | Sync Manager processes report. Badge changes to green `✅ Synced`. History timeline shows `SYNC_STARTED` and `SYNC_SUCCEEDED`. |
| 5 | **Simulate Sync Failure** | Disconnect network. Click "Retry Sync" on a pending item or create item offline. | Sync fails gracefully. Badge changes to red `❌ Sync Failed`. Error banner displays network failure message. **Data is retained**. |
| 6 | **Retry Sync Success** | Re-connect network. Click "Retry Sync" on failed report. | Sync succeeds. Report transitions to `Synced` with `syncError = null`. |
| 7 | **Duplicate Prevention Test** | Click "Retry Sync" on an already-synced report or trigger duplicate POST. | Backend responds idempotently with existing record. No duplicate records created. |
| 8 | **Coordinator Workflow** | Switch role to `Coordinator`. Assign a `Submitted` report -> move to `In Progress` -> mark `Resolved`. | Status transitions successfully. Terminal state reached (`Resolved`). Invalid transitions (e.g. `Draft` -> `Resolved`) blocked. |
| 9 | **History Verification** | Open report detail view. | History timeline lists chronological progression: creation, sync attempts, status transitions. |
