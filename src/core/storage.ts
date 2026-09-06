import type { StoredAppRecord } from './types';

const META_KEY = 'winweb.apps.v1';

function loadRecords(): StoredAppRecord[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) as StoredAppRecord[] : [];
  } catch {
    return [];
  }
}

function saveRecords(records: StoredAppRecord[]) {
  localStorage.setItem(META_KEY, JSON.stringify(records));
}

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  const storage = navigator.storage as StorageManager & { getDirectory?: () => Promise<FileSystemDirectoryHandle> };
  return storage?.getDirectory ? storage.getDirectory() : null;
}

async function ensureDir(parent: FileSystemDirectoryHandle, name: string) {
  return parent.getDirectoryHandle(name, { create: true });
}

export class AppStorage {
  list(): StoredAppRecord[] {
    return loadRecords().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  get(id: string): StoredAppRecord | undefined {
    return loadRecords().find((record) => record.id === id);
  }

  async importSource(record: StoredAppRecord, source: File): Promise<StoredAppRecord> {
    let sourceStored = false;
    const root = await getOpfsRoot();
    if (root) {
      const xrun = await ensureDir(root, 'xrun');
      const apps = await ensureDir(xrun, 'apps');
      const app = await ensureDir(apps, record.id);
      const sourceDir = await ensureDir(app, 'source');
      const handle = await sourceDir.getFileHandle(source.name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(source);
      await writable.close();
      sourceStored = true;
    }

    const next = { ...record, sourceStored, updatedAt: new Date().toISOString() };
    const records = loadRecords().filter((item) => item.id !== next.id);
    records.push(next);
    saveRecords(records);
    return next;
  }

  update(record: StoredAppRecord) {
    const records = loadRecords().filter((item) => item.id !== record.id);
    records.push({ ...record, updatedAt: new Date().toISOString() });
    saveRecords(records);
  }

  async remove(id: string) {
    saveRecords(loadRecords().filter((record) => record.id !== id));
    const root = await getOpfsRoot();
    if (!root) return;
    try {
      const xrun = await root.getDirectoryHandle('xrun');
      const apps = await xrun.getDirectoryHandle('apps');
      await apps.removeEntry(id, { recursive: true });
    } catch {
      // Metadata removal is still valid if the OPFS directory is already gone.
    }
  }
}
