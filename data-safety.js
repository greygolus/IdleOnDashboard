(function () {
  "use strict";
  window.setupDataSafety = function (storage) {
    const dialog = document.querySelector("#backupDialog");
    const status = document.querySelector("#backupStatus");
    const warning = document.querySelector("#storageWarning");
    const warningText = document.querySelector("#storageWarningText");
    const file = document.querySelector("#backupFile");
    const preview = document.querySelector("#restorePreview");
    const restoreButton = document.querySelector("#restoreBackup");
    const includeProfiles = document.querySelector("#backupIncludeProfiles");
    let pending;
    let opener;
    function open() { opener = document.activeElement; dialog.showModal(); }
    document.querySelectorAll("[data-open-backup]").forEach((button) => button.addEventListener("click", open));
    document.querySelector("#closeBackup").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => opener?.focus());
    function update(value) {
      warning.hidden = value.messages.length === 0;
      warningText.textContent = value.messages.join(" ");
      document.querySelector("#notesSaveStatus").textContent = value.unsaved ? "Unsaved — download backup" : "Local";
      status.textContent = value.ready ? "Your original data has an automatic recovery copy on this device. Download a file for a separate backup." : "Automatic backup is unavailable. Your existing saved data has not been replaced.";
    }
    storage.subscribe(update);
    update(storage.status());
    function download(value, label) {
      if (!value) throw new Error("No recovery copy is available yet.");
      const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `idleon-dashboard-${label}-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      status.textContent = value.partial ? "Downloaded this tab's edits only. Browser storage could not be read." : "Backup download started. Keep the file somewhere safe.";
    }
    const action = (id, getValue, label) => document.querySelector(id).addEventListener("click", async () => {
      try { download(await getValue(), label); } catch (error) { status.textContent = error.message; }
    });
    action("#downloadBackup", () => storage.exportBackup(includeProfiles.checked), "backup");
    action("#downloadOriginal", () => storage.getOriginal(), "before-update");
    action("#downloadRecovery", () => storage.getRecovery(), "before-restore");
    file.addEventListener("change", async () => {
      pending = null;
      restoreButton.disabled = true;
      const selected = file.files[0];
      if (!selected) return;
      try {
        if (selected.size > 32 * 1024 * 1024) throw new Error("Choose a backup smaller than 32 MB.");
        pending = DashboardStorage.validateBackup(JSON.parse(await selected.text()));
        const keys = Object.keys(pending.values);
        if (!keys.length) throw new Error("This backup is empty.");
        preview.textContent = `${keys.length} saved sections will be replaced. Sections absent from this file will stay unchanged. A recovery copy is saved first. Close other dashboard tabs before restoring.`;
        restoreButton.disabled = false;
      } catch (error) { pending = null; preview.textContent = error.message || "This backup could not be read."; }
    });
    restoreButton.addEventListener("click", async () => {
      if (!pending) return;
      restoreButton.disabled = true;
      try {
        await storage.restore(pending);
        try {
          const key = "idleon-dashboard-toolbox-payload";
          if (Object.hasOwn(pending.values, key) || Object.hasOwn(pending.sessionValues || {}, key)) {
            const savedSession = pending.sessionValues?.[key];
            if (savedSession == null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, savedSession);
          }
        } catch { /* Persistent profile data wins when session storage is unavailable. */ }
        location.reload();
      } catch (error) { status.textContent = error.message; restoreButton.disabled = false; }
    });
  };
})();
