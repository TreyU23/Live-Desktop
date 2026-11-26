// localStorage throws when it is full (QuotaExceededError) or unavailable (storage disabled by policy).
// An uncaught throw inside a React effect unmounts the whole app, so preference writes go through these
// helpers, which report failure instead of throwing.

/** Writes key=value; returns false instead of throwing when the browser refuses the write. */
export function storeItem(storage, key, value) {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Removes key; returns false instead of throwing when the browser refuses. */
export function removeStoredItem(storage, key) {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
