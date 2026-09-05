(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DashboardStorage = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const PREFIX = "idleon-dashboard-";
  const BACKUP_KEY = `${PREFIX}recovery-v1`;
  const RESTORE_MARKER = `${PREFIX}recovery-active-restore`;
  const FORMAT = "idleon-dashboard-backup";
  const PROFILE_KEYS = [`${PREFIX}toolbox-payload`, `${PREFIX}manual-json`];
  const KEYS = ["favorites", "notes", "account-link", "toolbox-username", "toolbox-payload", "manual-json", "intel-source", "saved-links", "checklist-items", "checklist-state", "checklist-settings", "layout", "onboarding-seen"].map((key) => PREFIX + key);
  const isBackupKey = (key) => key.startsWith(`${PREFIX}recovery-`);
  const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

  function indexedDBBackup(indexedDB) {
    let connection;
    function open() {
      if (connection) return connection;
      connection = new Promise((resolve, reject) => {
        if (!indexedDB) return reject(new Error("Backup storage unavailable."));
        const request = indexedDB.open("idleon-dashboard-recovery", 1);
        const timer = setTimeout(() => reject(new Error("Backup storage did not respond.")), 5000);
        request.onupgradeneeded = () => request.result.createObjectStore("snapshots");
        request.onsuccess = () => { clearTimeout(timer); resolve(request.result); };
        request.onerror = () => { clearTimeout(timer); reject(request.error); };
        request.onblocked = () => { clearTimeout(timer); reject(new Error("Close other dashboard tabs to enable backups.")); };
      });
      return connection;
    }
    async function transact(key, value, once = false) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction("snapshots", value === undefined ? "readonly" : "readwrite");
        const store = transaction.objectStore("snapshots");
        let result;
        const request = store.get(key);
        request.onsuccess = () => {
          result = request.result;
          if (value !== undefined && (!once || result === undefined)) {
            store.put(value, key);
            result = value;
          }
        };
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error("Backup could not be saved."));
      });
    }
    return { get: (key) => transact(key), put: (key, value, once) => transact(key, value, once) };
  }

  function validateBackup(input) {
    if (!isRecord(input) || input.format !== FORMAT || input.version !== 1 || !isRecord(input.values)) {
      throw new Error("Choose an IdleOn Dashboard backup file (version 1).");
    }
    const values = Object.create(null);
    const entries = Object.entries(input.values);
    if (entries.length > 200) throw new Error("This backup contains too many settings.");
    for (const [key, value] of entries) {
      if (!key.startsWith(PREFIX) || isBackupKey(key) || key.length > 160 || (value !== null && typeof value !== "string")) {
        throw new Error("This backup contains an unsupported setting.");
      }
      // Preserve exact strings, including damaged legacy records, for lossless recovery.
      values[key] = value;
    }
    const sessionValues = Object.create(null);
    if (input.sessionValues !== undefined) {
      if (!isRecord(input.sessionValues)) throw new Error("Invalid session profile backup.");
      for (const [key, value] of Object.entries(input.sessionValues)) {
        if (key !== PROFILE_KEYS[0] || (value !== null && typeof value !== "string")) throw new Error("Unsupported session setting.");
        sessionValues[key] = value;
      }
    }
    if (JSON.stringify({ values, sessionValues }).length > 32 * 1024 * 1024) throw new Error("This backup is larger than 32 MB.");
    return { format: FORMAT, version: 1, createdAt: input.createdAt || null, values, sessionValues };
  }

  function create(options = {}) {
    const getStorage = options.storage || (() => globalThis.localStorage);
    const getSession = options.session || (() => globalThis.sessionStorage);
    const backend = options.backup || indexedDBBackup(globalThis.indexedDB);
    const locks = options.locks || globalThis.navigator?.locks;
    const lockName = `${PREFIX}recovery-operation`;
    const changes = new Map();
    const problems = new Map();
    const protectedKeys = new Set();
    const subscribers = new Set();
    let ready = false;
    let original;
    let baseline = new Map();
    let backupLocation = "";
    let activeBackend = backend;
    let recoveryBackend = backend;
    const localBackend = {
      get(key) { const raw = getStorage().getItem(key === "before-safety-v1" ? BACKUP_KEY : `${PREFIX}recovery-${key}`); return raw ? JSON.parse(raw) : undefined; },
      put(key, value, once) {
        const existing = this.get(key);
        if (once && existing !== undefined) return existing;
        const storageKey = key === "before-safety-v1" ? BACKUP_KEY : `${PREFIX}recovery-${key}`;
        getStorage().setItem(storageKey, JSON.stringify(value));
        return this.get(key);
      }
    };
    const emit = () => subscribers.forEach((callback) => callback(status()));
    function issue(key, message) { problems.set(key, message); emit(); }
    function status() {
      return { ready, backupLocation, unsaved: changes.size, messages: [...problems.values()] };
    }
    function diskRead(key) {
      try { return getStorage().getItem(key); }
      catch { issue("access", "Browser storage is unavailable. Changes stay in this tab; download a backup before closing it."); return null; }
    }
    function getItem(key) {
      if (changes.has(key)) return changes.get(key);
      return diskRead(key);
    }
    function capture(includeProfiles = true, current = true) {
      const values = Object.create(null);
      const disk = getStorage();
      KEYS.forEach((key) => { if (includeProfiles || !PROFILE_KEYS.includes(key)) values[key] = disk.getItem(key); });
      for (let index = 0; index < disk.length; index += 1) {
        const key = disk.key(index);
        if (key?.startsWith(PREFIX) && !isBackupKey(key) && (includeProfiles || !PROFILE_KEYS.includes(key))) values[key] = disk.getItem(key);
      }
      if (current) changes.forEach((value, key) => {
        if (includeProfiles || !PROFILE_KEYS.includes(key)) values[key] = value;
      });
      const sessionValues = Object.create(null);
      if (includeProfiles) {
        try { sessionValues[PROFILE_KEYS[0]] = getSession()?.getItem(PROFILE_KEYS[0]) ?? null; } catch { /* No readable legacy session data. */ }
      }
      return { format: FORMAT, version: 1, createdAt: new Date().toISOString(), values, sessionValues };
    }
    async function initialize() {
      return locks ? locks.request(lockName, { mode: "exclusive" }, initializeLocked) : initializeLocked();
    }
    async function initializeLocked() {
      let recovering = false;
      async function recoverPending(engine) {
        const pending = await engine.get("pending-restore");
        if (!pending) return;
        recovering = true;
        recoveryBackend = engine;
        if (!locks) throw new Error("Safe recovery needs browser coordination.");
        const disk = getStorage();
        const before = validateBackup(pending.before);
        const desired = validateBackup(pending.desired);
        const recoveryOrder = Object.keys(desired.values).sort((a, b) => ((before.values[a]?.length || 0) - (disk.getItem(a)?.length || 0)) - ((before.values[b]?.length || 0) - (disk.getItem(b)?.length || 0)));
        for (const key of recoveryOrder) {
          const current = disk.getItem(key);
          // A newer edit in another tab must survive recovery too.
          if (current !== null && current !== desired.values[key] && current !== before.values[key]) continue;
          const value = before.values[key] ?? null;
          if (value === null) disk.removeItem(key); else disk.setItem(key, value);
        }
        await engine.put("pending-restore", null, false);
        disk.removeItem(RESTORE_MARKER);
        recovering = false;
        issue("recovered", "An interrupted restore was recovered. A copy of the previous data is available in Backups.");
      }
      try {
        await recoverPending(localBackend);
        await recoverPending(backend);
        if (getStorage().getItem(RESTORE_MARKER)) { recovering = true; throw new Error("Recovery storage unavailable."); }
        const initial = capture(true, false);
        baseline = new Map(Object.entries(initial.values));
        original = await backend.put("before-safety-v1", initial, true);
        if (!original) throw new Error("Backup not verified.");
        backupLocation = "device";
        ready = true;
      } catch {
        if (recovering || diskRead(RESTORE_MARKER)) {
          issue("recovery", "An unfinished restore needs its recovery copy. Saving is paused to protect your data. Enable browser storage and reload, or download the before-restore copy.");
          return status();
        }
        try {
          await recoverPending(localBackend);
          const initial = capture(true, false);
          baseline = new Map(Object.entries(initial.values));
          original = await localBackend.put("before-safety-v1", initial, true);
          validateBackup(original);
          activeBackend = localBackend;
          recoveryBackend = localBackend;
          backupLocation = "browser";
          ready = true;
        } catch {
          issue("backup", "An automatic backup could not be saved. Existing data is protected; changes stay in this tab. Download a backup before closing it.");
        }
      }
      emit();
      return status();
    }
    function setItem(key, value) {
      if (!key.startsWith(PREFIX) || isBackupKey(key)) throw new Error("Unsupported storage key.");
      const next = value === null ? null : String(value);
      if (next === getItem(key)) return !changes.has(key);
      // Do not replace unreadable data or another tab's edits with a fallback view.
      const diskValue = diskRead(key);
      const expected = baseline.has(key) ? baseline.get(key) : null;
      const restoring = diskRead(RESTORE_MARKER) !== null;
      if (ready && !restoring && !protectedKeys.has(key) && diskValue === expected) {
        try {
          const disk = getStorage();
          if (next === null) disk.removeItem(key); else disk.setItem(key, next);
          baseline.set(key, next);
          changes.delete(key);
          problems.delete(`write:${key}`);
          emit();
          return true;
        } catch { issue(`write:${key}`, "Some changes could not be saved. Download a backup before closing this tab; your previous saved data is intact."); }
      } else if (restoring) {
        issue(`write:${key}`, "A backup restore is in progress. This tab's edits stay in this tab; download them before reloading.");
      } else if (diskValue !== expected) {
        issue(`write:${key}`, "Another tab changed saved data. This tab's edits have not replaced it. Download this tab's backup, then reload to use the latest saved data.");
      }
      changes.set(key, next);
      emit();
      return false;
    }
    function readJSON(key, fallback, validate = () => true) {
      const raw = getItem(key);
      if (raw === null || raw === "") return fallback;
      try {
        const parsed = JSON.parse(raw);
        if (!validate(parsed)) throw new Error("Unexpected saved data.");
        return parsed;
      } catch {
        protectedKeys.add(key);
        issue(`invalid:${key}`, `Some saved ${key.slice(PREFIX.length).replaceAll("-", " ")} could not be read. The original is preserved; affected edits stay in this tab until you restore a valid backup.`);
        return fallback;
      }
    }
    function protect(key) {
      protectedKeys.add(key);
      issue(`invalid:${key}`, `Some saved ${key.slice(PREFIX.length).replaceAll("-", " ")} could not be read. The original is preserved; affected edits stay in this tab. Download the before-update backup to recover every record.`);
    }
    function exportBackup(includeProfiles = true) {
      try { return capture(includeProfiles); }
      catch {
        const values = Object.fromEntries(changes);
        if (!includeProfiles) PROFILE_KEYS.forEach((key) => delete values[key]);
        if (!Object.keys(values).length) throw new Error("Browser data cannot be read for export.");
        return { format: FORMAT, version: 1, createdAt: new Date().toISOString(), values, partial: true };
      }
    }
    async function getOriginal() {
      return original || activeBackend.get("before-safety-v1");
    }
    async function restore(input) {
      if (!locks) throw new Error("This browser cannot coordinate a safe restore. Update your browser before restoring; backup downloads are still available.");
      return locks.request(lockName, { mode: "exclusive", ifAvailable: true }, (lock) => {
        if (!lock) throw new Error("Another backup operation is in progress. Wait for it to finish before restoring.");
        return restoreLocked(input);
      });
    }
    async function restoreLocked(input) {
      const backup = validateBackup(input);
      if (!ready) throw new Error("Restore is unavailable until this browser can save a recovery backup.");
      if (changes.size) throw new Error("Download your unsaved changes and reload before restoring a backup.");
      if (diskRead(RESTORE_MARKER) !== null) throw new Error("Another restore is in progress. Close other dashboard tabs and reload before restoring.");
      const before = capture(true, false);
      // Restores are all-or-nothing within this tab. Omitted keys are never erased.
      for (const key of Object.keys(backup.values)) {
        if (diskRead(key) !== (baseline.get(key) ?? null)) throw new Error("Another tab changed your data. Reload before restoring.");
      }
      try {
        recoveryBackend = activeBackend;
        await activeBackend.put("before-restore", before, false);
        await activeBackend.put("pending-restore", { before, desired: backup }, false);
        getStorage().setItem(RESTORE_MARKER, "pending");
      }
      catch {
        try { await activeBackend.put("pending-restore", null, false); } catch { /* No source data has changed. */ }
        throw new Error("Could not save the recovery copy. Nothing was changed.");
      }
      const disk = getStorage();
      const keys = Object.keys(backup.values);
      if (keys.some((key) => disk.getItem(key) !== (before.values[key] ?? null))) {
        await activeBackend.put("pending-restore", null, false);
        disk.removeItem(RESTORE_MARKER);
        throw new Error("Another tab changed your data. Nothing was restored; reload before trying again.");
      }
      // Remove only keys being replaced, after recovery is verified, to allow quota-safe replacement.
      try {
        keys.forEach((key) => disk.removeItem(key));
        keys.forEach((key) => { if (backup.values[key] !== null) disk.setItem(key, backup.values[key]); });
        await activeBackend.put("pending-restore", null, false);
        disk.removeItem(RESTORE_MARKER);
      } catch {
        let rolledBack = true;
        try {
          // An older tab may not know about the restore marker. Keep its newer edits.
          const rollbackKeys = keys.filter((key) => {
            const current = disk.getItem(key);
            return current === null || current === backup.values[key] || current === before.values[key];
          });
          rollbackKeys.forEach((key) => disk.removeItem(key));
          rollbackKeys.forEach((key) => { if (before.values[key] != null) disk.setItem(key, before.values[key]); });
          await activeBackend.put("pending-restore", null, false);
          disk.removeItem(RESTORE_MARKER);
        } catch { rolledBack = false; }
        if (!rolledBack) { ready = false; issue("recovery", "Restore was interrupted. Download the recovery copy before making more changes."); }
        throw new Error(rolledBack ? "Not enough storage to restore this file. Your previous data was restored." : "Restore was interrupted. Use Download recovery copy to recover the data saved before this restore.");
      }
      keys.forEach((key) => { baseline.set(key, backup.values[key]); protectedKeys.delete(key); problems.delete(`invalid:${key}`); problems.delete(`write:${key}`); });
      emit();
      return true;
    }
    return { initialize, getItem, setItem, removeItem: (key) => setItem(key, null), readJSON, protect, status,
      subscribe(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
      exportBackup, getOriginal, getRecovery: () => recoveryBackend.get("before-restore"), restore };
  }
  return { create, validateBackup, indexedDBBackup, isRecord };
});
