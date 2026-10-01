import { openDB } from 'idb';

const DB_NAME = 'offline-field-issue-tracker';
const DB_VERSION = 1;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('reports')) {
        const reportStore = db.createObjectStore('reports', { keyPath: 'id' });
        reportStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        reportStore.createIndex('status', 'status', { unique: false });
        reportStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('history')) {
        const historyStore = db.createObjectStore('history', { keyPath: 'id' });
        historyStore.createIndex('reportId', 'reportId', { unique: false });
        historyStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    },
  });
}
