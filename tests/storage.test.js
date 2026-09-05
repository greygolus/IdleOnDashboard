const test = require("node:test");
const assert = require("node:assert/strict");
const { create, validateBackup } = require("../storage");
const P = "idleon-dashboard-";
class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); this.fail = () => false; }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { if (this.fail(key, value)) throw new Error("QuotaExceededError"); this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
class MemoryBackup {
  constructor() { this.values = new Map(); this.onPut = () => {}; }
  async get(key) { return this.values.get(key); }
  async put(key, value, once) {
    await this.onPut(key, value);
    if (!once || !this.values.has(key)) this.values.set(key, structuredClone(value));
    return this.values.get(key);
  }
}
const envelope = (values) => ({ format: "idleon-dashboard-backup", version: 1, values });
const make = (values = {}) => {
  const disk = new MemoryStorage(values), backup = new MemoryBackup();
  return { disk, backup, storage: create({ storage: () => disk, backup }) };
};

test("upgrade snapshots exact legacy strings, absence and unknown future settings before writes", async () => {
  const values = { [P + "notes"]: "  keep my spacing\n", [P + "favorites"]: "[broken", [P + "saved-links"]: '[{"name":"mine","extra":1}]', [P + "future"]: "yes" };
  const { disk, storage } = make(values);
  await storage.initialize();
  assert.deepEqual(Object.fromEntries(disk.values), values);
  const original = await storage.getOriginal();
  for (const [key, raw] of Object.entries(values)) assert.equal(original.values[key], raw);
  assert.equal(original.values[P + "manual-json"], null);
  storage.setItem(P + "notes", "new");
  assert.equal((await storage.getOriginal()).values[P + "notes"], values[P + "notes"]);
});

test("malformed favorites stay intact while the view and subsequent edits are safe", async () => {
  const { disk, storage } = make({ [P + "favorites"]: "{broken" });
  await storage.initialize();
  assert.deepEqual(storage.readJSON(P + "favorites", [], Array.isArray), []);
  assert.equal(storage.setItem(P + "favorites", '["tool"]'), false);
  assert.equal(storage.setItem(P + "favorites", '["tool"]'), false);
  assert.equal(disk.getItem(P + "favorites"), "{broken");
  assert.equal(storage.status().unsaved, 1);
});

test("a failed write keeps the durable original and exports unsaved edits", async () => {
  const { disk, storage } = make({ [P + "notes"]: "original" });
  await storage.initialize(); disk.fail = () => true;
  assert.equal(storage.setItem(P + "notes", "new"), false);
  assert.equal(disk.getItem(P + "notes"), "original");
  assert.equal(storage.exportBackup().values[P + "notes"], "new");
});

test("unavailable backups prevent durable edits and never evict existing data", async () => {
  const { disk, backup, storage } = make({ [P + "notes"]: "original" });
  backup.onPut = () => { throw new Error("Unavailable"); }; disk.fail = () => true;
  await storage.initialize();
  assert.equal(storage.status().ready, false);
  storage.setItem(P + "notes", "new");
  assert.equal(disk.getItem(P + "notes"), "original");
});

test("backup round trip keeps omitted sections and can restore a missing original key", async () => {
  const { disk, storage } = make({ [P + "notes"]: "original", [P + "manual-json"]: '{"data":{}}' });
  await storage.initialize();
  storage.setItem(P + "favorites", '["mine"]');
  await storage.restore(await storage.getOriginal());
  assert.equal(disk.getItem(P + "favorites"), null);
  assert.equal(disk.getItem(P + "manual-json"), '{"data":{}}');
  const partial = envelope({ [P + "notes"]: "restored" });
  await storage.restore(partial);
  assert.equal(disk.getItem(P + "manual-json"), '{"data":{}}');
  assert.equal((await storage.getRecovery()).values[P + "notes"], "original");
});

test("invalid imports make no writes", async () => {
  const { disk, storage } = make({ [P + "notes"]: "original" });
  await storage.initialize();
  await assert.rejects(storage.restore(envelope({ "other-app-data": "bad" })));
  assert.equal(disk.getItem(P + "notes"), "original");
  assert.throws(() => validateBackup({ format: "idleon-dashboard-backup", version: 999, values: {} }));
});

test("quota failure partway through restore rolls back all affected keys", async () => {
  const { disk, storage } = make({ [P + "notes"]: "original", [P + "favorites"]: '["old"]' });
  await storage.initialize();
  disk.fail = (key, value) => value === "too-large";
  await assert.rejects(storage.restore(envelope({ [P + "notes"]: "restored", [P + "favorites"]: "too-large" })), /previous data was restored/);
  assert.equal(disk.getItem(P + "notes"), "original");
  assert.equal(disk.getItem(P + "favorites"), '["old"]');
});

test("another tab cannot be overwritten during the awaited backup operation", async () => {
  const { disk, backup, storage } = make({ [P + "notes"]: "original" });
  await storage.initialize();
  backup.onPut = (key) => { if (key === "before-restore") disk.setItem(P + "notes", "another tab"); };
  await assert.rejects(storage.restore(envelope({ [P + "notes"]: "restored" })), /Another tab/);
  assert.equal(disk.getItem(P + "notes"), "another tab");
});

test("interrupted restore is recovered before the next startup can edit data", async () => {
  const { disk, backup } = make({ [P + "notes"]: "half restored" });
  backup.values.set("pending-restore", { before: envelope({ [P + "notes"]: "original" }), desired: envelope({ [P + "notes"]: "half restored" }) });
  const storage = create({ storage: () => disk, backup });
  await storage.initialize();
  assert.equal(disk.getItem(P + "notes"), "original");
  assert.equal(backup.values.get("pending-restore"), null);
});

test("the local backup fallback supports restoration when IndexedDB is unavailable", async () => {
  const { disk, backup, storage } = make({ [P + "notes"]: "original" });
  backup.onPut = () => { throw new Error("Unavailable"); };
  await storage.initialize();
  assert.equal(storage.status().backupLocation, "browser");
  await storage.restore(envelope({ [P + "notes"]: "restored" }));
  assert.equal(disk.getItem(P + "notes"), "restored");
  assert.equal((await storage.getRecovery()).values[P + "notes"], "original");
});

test("concurrent edits remain separate and neither tab silently claims a save", async () => {
  const { disk, backup, storage } = make({ [P + "notes"]: "original" });
  const second = create({ storage: () => disk, backup });
  await storage.initialize(); await second.initialize();
  storage.setItem(P + "notes", "first");
  assert.equal(second.setItem(P + "notes", "second"), false);
  assert.equal(disk.getItem(P + "notes"), "first");
  assert.equal(second.exportBackup().values[P + "notes"], "second");
});

test("an inaccessible journal pauses saving instead of blessing a partial restore", async () => {
  const { disk, backup, storage } = make({ [P + "notes"]: "partial", [P + "recovery-active-restore"]: "pending" });
  backup.get = async () => { throw new Error("IndexedDB denied"); };
  await storage.initialize();
  assert.equal(storage.status().ready, false);
  storage.setItem(P + "notes", "new");
  assert.equal(disk.getItem(P + "notes"), "partial");
});

test("failed journal reconciliation cannot fall back to writable partial data", async () => {
  const { disk, backup, storage } = make({ [P + "notes"]: "partial" });
  backup.values.set("pending-restore", { before: envelope({ [P + "notes"]: "original" }), desired: envelope({ [P + "notes"]: "partial" }) });
  disk.fail = (key, value) => value === "original";
  await storage.initialize();
  assert.equal(storage.status().ready, false);
  storage.setItem(P + "notes", "new");
  assert.equal(disk.getItem(P + "notes"), "partial");
});
