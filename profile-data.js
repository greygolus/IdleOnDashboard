(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DashboardProfile = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  function timestamp(value) {
    if (value === null || value === undefined || value === "") return null;
    const numeric = Number(value);
    const result = Number.isFinite(numeric) ? (numeric < 1e12 ? numeric * 1000 : numeric) : Date.parse(value);
    return Number.isFinite(result) && result > 0 && result <= 8640000000000000 ? result : null;
  }
  function parse(value) {
    try {
      const profile = typeof value === "string" ? JSON.parse(value) : value;
      if (!isRecord(profile) || profile.error) return null;
      return isRecord(profile.data) || isRecord(profile.serverVars) ? profile : null;
    } catch { return null; }
  }
  function resolve(preferred, toolbox, manual) {
    const validManual = parse(manual);
    const validToolbox = parse(toolbox);
    if (preferred === "manual" && validManual) return { source: "manual", payload: validManual };
    if (validToolbox) return { source: "toolbox", payload: validToolbox };
    if (validManual) return { source: "manual", payload: validManual };
    return { source: "none", payload: null };
  }
  function normalize(content, username, profileLink, fetchedAt = Date.now()) {
    if (!parse(content)) throw new Error("The response did not contain a usable IdleOn profile.");
    return { ...content, data: content.data || {}, username, profileLink, publicProfile: true,
      lastUpdated: timestamp(content.lastUpdated), fetchedAt };
  }
  function describe(value, now = Date.now()) {
    const time = timestamp(value);
    if (!time) return "Upload time unknown";
    const formatted = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(time));
    const minutes = Math.max(0, Math.floor((now - time) / 60000));
    const age = time > now + 60000 ? "timestamp is in the future" : minutes < 1 ? "less than a minute ago" : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.floor(minutes / 60)} hr ago` : `${Math.floor(minutes / 1440)} days ago`;
    return `${formatted} (${age})`;
  }
  return { parse, resolve, normalize, timestamp, describe };
});
