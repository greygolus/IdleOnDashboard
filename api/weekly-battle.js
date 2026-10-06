const sourceUrl = "https://docs.google.com/spreadsheets/d/1z1P2ouvYhe2pryWoF0kIQE7QichYpJt1GaPPos-e-aw/htmlview?gid=0";
// The source's Raw Data tab contains one dated run per column. Reading it avoids
// depending on the presentation tab's NOW formula refreshing at weekly reset.
const csvUrl = "https://docs.google.com/spreadsheets/d/1z1P2ouvYhe2pryWoF0kIQE7QichYpJt1GaPPos-e-aw/export?format=csv&gid=787764386&range=A1:ZZ60";
const maxCsvBytes = 256 * 1024;
const weekMilliseconds = 7 * 24 * 60 * 60 * 1000;
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const requirementNames = {
  "material carry cap": "Material Carry Cap",
  mining: "Mining lvl", choppin: "Chopping lvl", chopping: "Chopping lvl",
  fishing: "Fishing lvl", catching: "Catching lvl", trapping: "Trapping lvl",
  worship: "Worship lvl", class: "Class lvl", alchemy: "Alchemy lvl",
  construction: "Construction lvl", cooking: "Cooking lvl",
  laboratory: "Laboratory lvl", divinity: "Divinity lvl",
  gmush: "Digits of Green Mushroom kills", "green mushroom": "Digits of Green Mushroom kills",
  choccie: "Digits of Choccie Kills", crabcake: "Digits of Crabcake kills",
  ram: "Digits of Ram kills", stiltmole: "Digits of Stiltmole kills"
};

function malformed() {
  return new Error("The weekly battle sheet has an unsupported format.");
}

// CSV may include quoted commas, embedded newlines, and doubled quotation marks.
function parseCsv(text) {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > maxCsvBytes) throw malformed();
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], field = "", quoted = false, closedQuote = false;
  const endField = () => {
    row.push(field);
    if (row.length > 702) throw malformed();
    field = "";
    closedQuote = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    if (rows.length > 60) throw malformed();
    row = [];
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index++; }
        else { quoted = false; closedQuote = true; }
      } else field += char;
    } else if (char === ",") endField();
    else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      endRow();
    } else if (char === '"') {
      if (field || closedQuote) throw malformed();
      quoted = true;
    } else {
      if (closedQuote) throw malformed();
      field += char;
    }
  }
  if (quoted) throw malformed();
  if (field || row.length || closedQuote) endRow();
  return rows;
}

function parseDate(value) {
  const match = /^(\d{2}) ([A-Za-z]{3}) (\d{2})$/.exec(value.trim());
  if (!match) throw malformed();
  const month = monthNames.findIndex(name => name.toLowerCase() === match[2].toLowerCase());
  const day = Number(match[1]), year = 2000 + Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (month < 0 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) throw malformed();
  return date.getTime();
}

function parseWeeklyBattleCsv(text, now = Date.now()) {
  const rows = parseCsv(text);
  const value = (row, column) => String(rows[row]?.[column] || "").trim();
  const normalize = text => text.replace(/\s+/g, " ").trim().toLowerCase();
  const label = name => {
    const matches = rows.flatMap((row, index) => normalize(row[0] || "") === name ? [index] : []);
    if (matches.length !== 1) throw malformed();
    return matches[0];
  };
  const dates = label("dates"), boss = label("boss name"), requirements = label("character requirements");
  const skulls = label("5 skulls run"), trophies = label("# of trophies"), misc = label("misc + trophy run");
  if (dates !== 0 || boss !== dates + 2 || requirements !== boss + 1 || skulls <= requirements ||
      skulls - requirements > 10 || trophies <= skulls || misc !== trophies + 1) throw malformed();

  const time = new Date(now).getTime();
  if (!Number.isFinite(time)) throw malformed();
  const runs = [];
  for (let column = 1; column < rows[dates].length; column++) {
    if (!value(dates, column)) continue;
    const start = parseDate(value(dates, column)), end = parseDate(value(dates + 1, column));
    if (end - start !== weekMilliseconds) throw malformed();
    runs.push({ column, start, end });
  }
  const current = runs.filter(run => run.start <= time && time < run.end);
  if (current.length > 1) throw malformed();
  // A past run carries its actual dates. The client can label it unavailable
  // instead of accidentally treating an upcoming run as the current route.
  const selected = current[0] || runs.filter(run => run.end <= time).sort((a, b) => b.end - a.end)[0];
  if (!selected) throw malformed();
  const column = selected.column;
  const bossName = value(boss, column);
  if (!bossName || bossName.length > 100 || /[\r\n\u0000-\u001f]/.test(bossName)) throw malformed();
  const characterRequirements = [];
  for (let row = requirements; row < skulls; row++) {
    const cell = value(row, column);
    if (!cell) continue;
    const match = /^(.+?)\s+-\s+(.+)$/.exec(cell);
    if (!match || match[1].length > 100 || match[2].length > 100 ||
        !/^(?:\d+(?:\s*[, .]\s*\d+)*|-+|nope)$/i.test(match[2])) throw malformed();
    characterRequirements.push({ name: requirementNames[match[1].toLowerCase()] || match[1], characters: match[2] });
  }
  if (!characterRequirements.length) throw malformed();
  const trophyText = value(trophies, column);
  if (!/^\d{1,2}$/.test(trophyText)) throw malformed();
  const bonusValues = new Map();
  const routeLines = (start, end) => {
    const lines = [];
    for (let row = start; row < end; row++) {
      const cell = value(row, column);
      if (!cell) continue;
      if (cell.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(cell)) throw malformed();
      const bonus = /^Bonus\s+(Class\s+EXP|Dmg)\s*:\s*(\d+(?:\.\d+)?%)$/i.exec(cell);
      if (bonus) {
        const name = /^class/i.test(bonus[1]) ? "Class EXP" : "Damage";
        if (bonusValues.has(name)) throw malformed();
        bonusValues.set(name, bonus[2]);
      } else {
        if (/^Bonus\b/i.test(cell)) throw malformed();
        lines.push(cell);
      }
    }
    // Preserve the source's caveats alongside its directions, but require at
    // least one actual option sequence in each route, not just prose.
    if (!lines.some(line => /^(?:[1-3\s*\-]|Skip|\(FR\))+$/i.test(line) && /[1-3]/.test(line))) throw malformed();
    return lines;
  };
  const routes = [
    { name: "5 Skulls", lines: routeLines(skulls, trophies) },
    { name: "Misc + Trophy", lines: routeLines(misc, rows.length) }
  ];
  if (bonusValues.size !== 2) throw malformed();
  return {
    start: new Date(selected.start).toISOString(), end: new Date(selected.end).toISOString(), boss: bossName,
    requirements: characterRequirements, routes, trophies: Number(trophyText),
    bonuses: [...bonusValues].map(([name, value]) => ({ name, value }))
  };
}

async function readBoundedText(upstream) {
  if (Number(upstream.headers.get("content-length")) > maxCsvBytes) throw malformed();
  const reader = upstream.body?.getReader();
  if (!reader) throw malformed();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxCsvBytes) {
        await reader.cancel();
        throw malformed();
      }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString("utf8");
}

async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Use GET to load the weekly battle guide." });
    return;
  }
  try {
    const upstream = await fetch(csvUrl, {
      credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(12000),
      headers: { Accept: "text/csv" }
    });
    if (!upstream.ok) throw new Error("Weekly battle source unavailable.");
    const csv = await readBoundedText(upstream);
    const fetchedAt = new Date(Date.now()).toISOString();
    const run = parseWeeklyBattleCsv(csv, fetchedAt);
    const cacheSeconds = Math.max(0, Math.min(300, Math.floor((Date.parse(run.end) - Date.parse(fetchedAt)) / 1000)));
    response.setHeader("Cache-Control", `public, max-age=0, s-maxage=${cacheSeconds}`);
    response.status(200).json({ sourceUrl, fetchedAt, run });
  } catch (error) {
    const timedOut = error.name === "TimeoutError" || error.name === "AbortError";
    response.status(timedOut ? 504 : 502).json({
      error: timedOut ? "The weekly battle sheet timed out. Please try again." : "The weekly battle guide is unavailable. Open the source sheet or try again."
    });
  }
}

handler.parseWeeklyBattleCsv = parseWeeklyBattleCsv;
module.exports = handler;
