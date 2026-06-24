const memoryValues = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return memoryValues.size;
  },
  clear: () => memoryValues.clear(),
  getItem: (key) => memoryValues.get(key) ?? null,
  key: (index) => [...memoryValues.keys()][index] ?? null,
  removeItem: (key) => {
    memoryValues.delete(key);
  },
  setItem: (key, value) => {
    memoryValues.set(key, value);
  }
};
const disabledStorage: Storage = {
  length: 0,
  clear: () => undefined,
  getItem: () => null,
  key: () => null,
  removeItem: () => undefined,
  setItem: () => undefined
};

function getBrowserStorage(): Storage {
  if (import.meta.env.MODE === "test") {
    return disabledStorage;
  }
  try {
    const storage = window.localStorage;
    return typeof storage.getItem === "function" ? storage : memoryStorage;
  } catch {
    return memoryStorage;
  }
}

export function loadLocalWorkspace<T>(
  key: string,
  fallback: T,
  storage: Storage = getBrowserStorage()
): T {
  try {
    const stored = storage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    storage.removeItem(key);
    return fallback;
  }
}

export function saveLocalWorkspace<T>(
  key: string,
  value: T,
  storage: Storage = getBrowserStorage()
): void {
  storage.setItem(key, JSON.stringify(value));
}
