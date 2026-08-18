// db.js — camada de persistência (IndexedDB)
// Um único ponto de acesso ao banco local. Nada de dados na nuvem.

const DB_NAME = 'treinoAppDB';
const DB_VERSION = 1;

const STORES = {
  days: 'days',           // { id: 0-6 (dom-sáb), name, type: 'workout'|'rest', workoutId }
  workouts: 'workouts',   // { id, name, order }
  exercises: 'exercises', // { id, workoutId, order, name, nameEn, muscleGroup, equipment,
                           //   instructions, image, sets, reps, restSeconds, notes }
  logs: 'logs',           // { id, exerciseId, date 'YYYY-MM-DD', sets:[{n,weight,reps,completed}] }
  settings: 'settings'    // { id:'app', ...prefs }
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains(STORES.days)) {
        db.createObjectStore(STORES.days, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.workouts)) {
        db.createObjectStore(STORES.workouts, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.exercises)) {
        const st = db.createObjectStore(STORES.exercises, { keyPath: 'id' });
        st.createIndex('workoutId', 'workoutId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.logs)) {
        const st = db.createObjectStore(STORES.logs, { keyPath: 'id' });
        st.createIndex('exerciseId', 'exerciseId', { unique: false });
        st.createIndex('date', 'date', { unique: false });
        st.createIndex('exerciseDate', ['exerciseId', 'date'], { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: 'id' });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  async get(store, id) {
    const s = await tx(store);
    return reqToPromise(s.get(id));
  },
  async getAll(store) {
    const s = await tx(store);
    return reqToPromise(s.getAll());
  },
  async getAllByIndex(store, indexName, value) {
    const s = await tx(store);
    return reqToPromise(s.index(indexName).getAll(value));
  },
  async put(store, value) {
    const s = await tx(store, 'readwrite');
    return reqToPromise(s.put(value));
  },
  async bulkPut(store, values) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(store, 'readwrite');
      const os = transaction.objectStore(store);
      values.forEach((v) => os.put(v));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },
  async delete(store, id) {
    const s = await tx(store, 'readwrite');
    return reqToPromise(s.delete(id));
  },
  async clear(store) {
    const s = await tx(store, 'readwrite');
    return reqToPromise(s.clear());
  },
  STORES
};

// ---- Backup / restore ----

export async function exportBackup() {
  const [days, workouts, exercises, logs, settings] = await Promise.all([
    db.getAll(STORES.days),
    db.getAll(STORES.workouts),
    db.getAll(STORES.exercises),
    db.getAll(STORES.logs),
    db.getAll(STORES.settings)
  ]);
  return {
    app: 'treino-pessoal',
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    data: { days, workouts, exercises, logs, settings }
  };
}

export async function importBackup(backup) {
  if (!backup || !backup.data) throw new Error('Arquivo de backup inválido.');
  const { days, workouts, exercises, logs, settings } = backup.data;
  await Promise.all([
    db.clear(STORES.days),
    db.clear(STORES.workouts),
    db.clear(STORES.exercises),
    db.clear(STORES.logs),
    db.clear(STORES.settings)
  ]);
  if (days) await db.bulkPut(STORES.days, days);
  if (workouts) await db.bulkPut(STORES.workouts, workouts);
  if (exercises) await db.bulkPut(STORES.exercises, exercises);
  if (logs) await db.bulkPut(STORES.logs, logs);
  if (settings) await db.bulkPut(STORES.settings, settings);
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
