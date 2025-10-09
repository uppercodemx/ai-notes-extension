export type StorageArea = 'sync' | 'local';
const getArea = (prefer: StorageArea = 'sync'): chrome.storage.StorageArea => {
  try { if (prefer === 'sync' && chrome.storage?.sync) return chrome.storage.sync; } catch {}
  return chrome.storage.local;
};
export async function getItem<T>(key: string, prefer: StorageArea = 'sync'): Promise<T | undefined> {
  const area = getArea(prefer);
  const obj = await area.get(key);
  return obj[key] as T | undefined;
}
export async function setItem<T>(key: string, value: T, prefer: StorageArea = 'sync'): Promise<void> {
  const area = getArea(prefer);
  await area.set({ [key]: value });
}
export async function update<T extends object>(key: string, updater: (curr: T | undefined) => T, prefer: StorageArea = 'sync') {
  const curr = await getItem<T>(key, prefer);
  const next = updater(curr);
  await setItem<T>(key, next, prefer);
}
