async function initializeDashboard() {
const storage = DashboardStorage.create();
await storage.initialize();
setupDataSafety(storage);
const isRecord = DashboardStorage.isRecord;
let profileRequestId = 0;
let profileController = null;
let lastIntelMinute = Math.floor(Date.now() / 60000);
function safeWebUrl(value) { try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } }
function requireWebUrl(value) { const url = safeWebUrl(value); if (!url) throw new Error("Enter an http or https URL."); return url; }
function safeColor(value) { return /^#[0-9a-f]{6}$/i.test(value) ? value : "#36506a"; }
function legacyId(kind, value, index) {
  const raw = JSON.stringify(value); let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619);
  return `legacy-${kind}-${(hash >>> 0).toString(16)}-${index}`;
}
function readRecords(key) {
  const records = storage.readJSON(key, [], Array.isArray);
  const valid = records.filter((value) => isRecord(value) && ["id", "name", "url", "personalUrl", "text", "type", "iconText", "iconColor", "group", "note"].every((field) => value[field] == null || typeof value[field] === "string") && ["preset", "hiddenPreset", "favorite", "showInTools", "showInSavedPanel", "inControls", "done"].every((field) => value[field] == null || typeof value[field] === "boolean"));
  const ids = valid.map((record) => record.id).filter(Boolean);
  if (valid.length !== records.length || new Set(ids).size !== ids.length) storage.protect(key);
  return valid;
}
const tools = [
  {
    id: "idleon-toolbox",
    name: "Idleon Toolbox",
    category: "Review",
    url: "https://idleontoolbox.com/",
    description: "Morta1's account overview tool for character details, progression checks, and broad planning support.",
    tags: ["account", "characters", "progress"]
  },
  {
    id: "ie-auto-review",
    name: "IE AutoReview",
    category: "Review",
    url: "https://ieautoreview-scoli.pythonanywhere.com/",
    description: "Scoli's automated Idleon Efficiency review flow for finding missed upgrades and priorities.",
    tags: ["autoreview", "priorities", "efficiency"]
  },
  {
    id: "research-optimizer",
    name: "Corgan's Optimizer",
    category: "Optimizer",
    url: "https://corgan.github.io/idleon-research-optimizer/index.html",
    icon: "https://idleon.wiki/images/b/b9/Research_Skill_Icon.png",
    description: "Corgan's collection of calculators and optimizers, including cog board, statue, fountain, jar, sneaking, and research tools.",
    tags: ["builds", "calculators", "research", "optimizer"]
  },
  {
    id: "egizz-fo",
    name: "Farming Optimizer",
    category: "Optimizer",
    url: "https://egizz983.github.io/FO/",
    icon: "https://idleon.wiki/images/8/82/Farming_Skill_Icon.png",
    description: "Egizz's Farming Optimizer for planning frame setups and comparing options quickly.",
    tags: ["farming", "optimizer", "planning"]
  },
  {
    id: "idleon-spreadsheet",
    name: "Weekly Boss Rotation Sheet",
    category: "Reference",
    url: "https://docs.google.com/spreadsheets/d/1z1P2ouvYhe2pryWoF0kIQE7QichYpJt1GaPPos-e-aw/htmlview?pli=1&gid=0&pru=AAABnAv5x9w*dlnLHs8UrApNKELfxxpu1w#gid=0",
    icon: "https://idleon.wiki/images/f/f2/Trophie.png",
    description: "Community Google Sheets tracker for weekly boss rotations and the current reference schedule.",
    tags: ["weekly boss", "rotation", "sheet"]
  },
  {
    id: "idleon-wiki",
    name: "Idleon Wiki",
    category: "Reference",
    url: "https://idleon.wiki/",
    description: "The Idleon community wiki for items, quests, skills, maps, mechanics, and general lookup.",
    tags: ["wiki", "items", "quests"]
  },
  {
    id: "idleon-optimizer",
    name: "Idleon Optimizer",
    category: "Optimizer",
    url: "https://idleon-optimizer.vercel.app/",
    icon: "assets/toolbox/BubbaBub.png",
    description: "Clicker optimizer for Orion, Poppy, and Bubba planning.",
    tags: ["clickers", "optimizer", "orion", "poppy", "bubba"]
  },
  {
    id: "idleon-justice",
    name: "Idleon Justice",
    category: "Guide",
    url: "https://idleon-justice.vercel.app/",
    icon: "assets/toolbox/Justice_Monument_x1.png",
    description: "Justice Monument guide for understanding choices, rewards, and progression.",
    tags: ["justice", "monument", "guide"]
  },
  {
    id: "idleon-guide-articles",
    name: "Idleon Guide Articles",
    category: "Guide",
    url: "https://idleon.guide/category/guides/",
    description: "Community guide articles for broader Idleon topics. Useful as a reference, though Discord and wiki info may be newer.",
    tags: ["guides", "articles", "reference"]
  }
];

const favoriteKey = "idleon-dashboard-favorites";
const notesKey = "idleon-dashboard-notes";
const accountLinkKey = "idleon-dashboard-account-link";
const usernameKey = "idleon-dashboard-toolbox-username";
const rawPayloadKey = "idleon-dashboard-toolbox-payload";
const manualJsonKey = "idleon-dashboard-manual-json";
const intelSourceKey = "idleon-dashboard-intel-source";
const savedLinksKey = "idleon-dashboard-saved-links";
const checklistItemsKey = "idleon-dashboard-checklist-items";
const checklistStateKey = "idleon-dashboard-checklist-state";
const checklistSettingsKey = "idleon-dashboard-checklist-settings";
const layoutKey = "idleon-dashboard-layout";
const onboardingSeenKey = "idleon-dashboard-onboarding-seen";
const defaultChecklistItems = [
  { id: "starter-daily-buy-shop-items", text: "Buy shop items", type: "daily", done: false },
  { id: "starter-daily-register-tournament", text: "Register for tournament", type: "daily", done: false },
  { id: "starter-daily-post-office", text: "Post office", type: "daily", done: false },
  { id: "starter-weekly-killroy", text: "Killroy", type: "weekly", done: false }
];
const sidebarOrderDefaults = ["links", "controls", "saved", "toolbox", "manual"];
const fixedIntelOrder = ["quick-events", "exotic-market", "meritocracy-weekly", "weekly-battle", "lab-rotation", "rate-card"];
const toolboxBaseUrl = "https://idleontoolbox.com/";
const profilesApiUrl = "https://profiles.idleontoolbox.workers.dev/api";
const localProfilesApiUrl = "/api/profiles";
const lilBoProfileUrl = "https://idleontoolbox.com/?profile=Lil_bo";
const retiredSavedLinkIds = new Set(["preset-idleon-guide"]);
const defaultSavedLinks = [
  {
    id: "preset-sampling-skilling-checklist",
    name: "Sampling and Skilling Checklist",
    url: "https://docs.google.com/spreadsheets/d/14KjNtI7U34fp6O-212xRDd6EePb_YVXE17RDXH5LIQg/",
    type: "sheet",
    preset: true,
    group: "current"
  },
  {
    id: "preset-antho-arkh-guide-sheet",
    name: "Antho and Arkh's Guide Sheet",
    url: "https://docs.google.com/spreadsheets/d/1IcxwlHKPcw57PJxOWmtCJTP2Iv6ubdRSEwzMjbH476U/",
    type: "sheet",
    preset: true,
    group: "current"
  },
  {
    id: "preset-asbjorn-resource-sheet",
    name: "Asbjorn's Resource Sheet",
    url: "https://docs.google.com/spreadsheets/d/1WmkzuDiF8yoPQxJ5auBzyAZODJEEB7mCxWCIcF1uhGY/",
    type: "sheet",
    preset: true,
    group: "outdated",
    note: "Not updated to latest."
  },
  {
    id: "preset-almostpsycho-sampling",
    name: "AlmostPsycho's Sampling Sheet",
    url: "https://docs.google.com/spreadsheets/d/1at-y9t5ohYky33nOLoSxHYeyRX-3T91paj-nTSHrB3c/",
    type: "sheet",
    preset: true,
    group: "current"
  },
  {
    id: "preset-weekly-boss-rotations",
    name: "Weekly Boss Rotations",
    url: "https://docs.google.com/spreadsheets/d/1z1P2ouvYhe2pryWoF0kIQE7QichYpJt1GaPPos-e-aw/htmlview",
    type: "sheet",
    preset: true,
    group: "current"
  },
  {
    id: "preset-farming-predictor-mega",
    name: "Farming Predictor Mega Sheet",
    url: "https://docs.google.com/spreadsheets/d/1gj2sxG7mnlBu4ibVstFfS4pa7zii_qfgXVJF13-voMo/",
    type: "sheet",
    preset: true,
    group: "current"
  },
  {
    id: "preset-land-rank-distribution",
    name: "Land Rank Distribution",
    url: "https://docs.google.com/spreadsheets/d/18v2csU8UiXWUAIVvVjXIlXtH96-YdL2-9OzOUfCv_fw/",
    type: "sheet",
    preset: true,
    group: "current"
  },
  {
    id: "preset-voidwalker-speedrun",
    name: "Voidwalker Speedrun",
    url: "https://docs.google.com/spreadsheets/d/1SdAS0XIkpdZ081WJuiVcAbtg50IlOD9dITlrAxZ-2FI/",
    type: "sheet",
    preset: true,
    group: "outdated",
    note: "Outdated but important guide up to W6."
  },
  {
    id: "preset-bonejoe-calc",
    name: "BoneJoePickle HP Calculator",
    url: "https://docs.google.com/spreadsheets/d/1Z1oMka1tzl89rErYHDXvU7JMHIr14DWOLSdfeZlrYBk/edit?gid=1042543501#gid=1042543501",
    type: "sheet",
    preset: true,
    group: "current"
  },
  {
    id: "preset-owl-kangaroo-sheet",
    name: "Owl + Kangaroo Sheet",
    url: "https://docs.google.com/spreadsheets/d/19Ty2kKvqBvbA7_mTsIqYLtEvKZyY99-t_TVgSSyOCi4/",
    type: "sheet",
    preset: true,
    group: "current",
    note: "Alt to the website."
  },
  {
    id: "preset-bubba-optimizer",
    name: "Bubba's Opti v2.6a",
    url: "https://docs.google.com/spreadsheets/d/1iEBqFKfsIsVkM_-6hO9j7uIdtrRHuT4UN93xmmeI9Eo/edit?gid=0#gid=0",
    type: "sheet",
    preset: true,
    group: "current",
    note: "Alt to the website."
  },
  {
    id: "preset-trialpears-tome",
    name: "Trialpears' Crappy Tome Sheet",
    url: "https://docs.google.com/spreadsheets/d/1x3YNRUwN7Fw-ewzQC58rop-hkObvy20FHSY1IKXkCM0/",
    type: "sheet",
    preset: true,
    group: "outdated",
    note: "Possibly obsolete."
  },
  {
    id: "preset-trialpears-spice",
    name: "Trialpears' New Spice Gathering Sheet",
    url: "https://docs.google.com/spreadsheets/d/1dRFrReLJZvwOJLmal7Kak72LlUODQhWSdKHhFIm5vxs/",
    type: "sheet",
    preset: true,
    group: "outdated",
    note: "Possibly obsolete."
  },
  {
    id: "preset-trialpears-stamp",
    name: "Trialpears' Stamp Sheet",
    url: "https://docs.google.com/spreadsheets/d/1qAsIRqYKhPTzFgtCy62KxgSDb_Nm1AfpwXyyIDNj9fo/",
    type: "sheet",
    preset: true,
    group: "outdated",
    note: "Outdated and obsolete for IT. Includes carry cap."
  },
  {
    id: "preset-trialpears-sample-setup",
    name: "Trialpears' Sample Setup",
    url: "https://docs.google.com/spreadsheets/d/1aW_lVDeIMZjIc5u5yy8Np1z7ixmNV-Hy49aCWYGv210/",
    type: "sheet",
    preset: true,
    group: "outdated",
    note: "Outdated 3D Printer setup."
  },
  {
    id: "preset-gaming-corndag",
    name: "Gaming By Corndag",
    url: "https://docs.google.com/spreadsheets/d/1OHVfSkPip6HazTMQOthG6zml0SYrHnef88CdiAflluo/",
    type: "sheet",
    preset: true,
    group: "outdated",
    note: "Outdated but important for calculating 1s and 5s gaming."
  },
  {
    id: "preset-talents-guide",
    name: "Talents Guide",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vST3HcgBgeq8H9jztaMhUXZAAAHl120PvDVo_48qJpn6n9qnpa-TWmuG_kN9cmtr66M-OtO482XIOAk/pubhtml#",
    type: "sheet",
    preset: true,
    group: "outdated",
    note: "Outdated."
  },
  {
    id: "preset-idleon-guide-sheet",
    name: "IdleOn Guide Sheet",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSCepYAs6sNDP4iq6MJNAG1pvFXzfC_3IQ7ttt5vfEEKAgQhIk4cQqnLRyeH6UyqDSuP4R-6WQeDmmP/pubhtml#",
    type: "sheet",
    preset: true,
    group: "outdated",
    note: "Outdated."
  },
  {
    id: "preset-idleon-guide-sheet-alt",
    name: "IdleOn Guide Sheet Alt",
    url: "https://docs.google.com/spreadsheets/u/0/d/193tGCv_nJpgleOzQ2jkO9KEpSh8JcOZLdjDolD9Z0FI/htmlview",
    type: "sheet",
    preset: true,
    group: "outdated",
    note: "Outdated. Similar to the guide sheet."
  },
  {
    id: "preset-idleon-guide-doc",
    name: "IdleOn Guide",
    url: "https://docs.google.com/document/d/18BpkkUGPSznTOvEMenognPllGvjTchAkcvHUKqrcu64/",
    type: "doc",
    preset: true,
    group: "outdated",
    note: "Outdated."
  },
  {
    id: "preset-intermediate-guide-doc",
    name: "IdleOn Guide for Intermediate Players",
    url: "https://docs.google.com/document/d/1Lf3ls4HjhoP8vxy08b0NiFHfvkKItmnFmZ1DN5y008Y/",
    type: "doc",
    preset: true,
    group: "outdated",
    note: "Outdated."
  }
];

const state = {
  favorites: new Set(storage.readJSON(favoriteKey, [], (value) => Array.isArray(value) && value.every((id) => typeof id === "string"))),
  draggedCard: null
};

const grid = document.querySelector("#toolGrid");
const quickList = document.querySelector("#quickList");
const toolCount = document.querySelector("#toolCount");
const wikiLinks = document.querySelector("#wikiLinks");
const rotationGrid = document.querySelector("#rotationGrid");
const currentIntel = document.querySelector("#currentIntel");
const template = document.querySelector("#toolCardTemplate");
const notes = document.querySelector("#notes");
const savedLinkForm = document.querySelector("#savedLinkForm");
const savedLinkName = document.querySelector("#savedLinkName");
const savedLinkUrl = document.querySelector("#savedLinkUrl");
const savedLinks = document.querySelector("#savedLinks");
const rateValue = document.querySelector("#rateValue");
const rateUnit = document.querySelector("#rateUnit");
const rateResults = document.querySelector("#rateResults");
const checklistForm = document.querySelector("#checklistForm");
const checklistType = document.querySelector("#checklistType");
const checklistInput = document.querySelector("#checklistInput");
const checklistList = document.querySelector("#checklistList");
const idleonResetTime = document.querySelector("#idleonResetTime");
const checklistStatus = document.querySelector("#checklistStatus");
const toolboxUsername = document.querySelector("#toolboxUsername");
const accountLink = document.querySelector("#accountLink");
const syncStatus = document.querySelector("#syncStatus");
const syncMeta = document.querySelector("#syncMeta");
const manualJsonStatus = document.querySelector("#manualJsonStatus");
const useManualJsonForIntel = document.querySelector("#useManualJsonForIntel");
const ripModal = document.querySelector("#ripModal");
const favoritesModal = document.querySelector("#favoritesModal");
const favoritesModalList = document.querySelector("#favoritesModalList");
const onboardingModal = document.querySelector("#onboardingModal");
const dontShowOnboarding = document.querySelector("#dontShowOnboarding");
const savedLinksModal = document.querySelector("#savedLinksModal");
const savedLinksManagerList = document.querySelector("#savedLinksManagerList");

const isLocalDashboard = () => ["localhost", "127.0.0.1"].includes(window.location.hostname);
const localWikiAssets = new Set([
  "24px-Console_Jewel_Pyrite_Pyramite.png",
  "24px-Lab_-_Conductive_Nanochip.png",
  "24px-Lab_-_Galvanic_Motherboard.png",
  "24px-Lab_-_Omega_Motherboard.png",
  "32px-Killroy_Skull.png",
  "32px-Main_Catacomb_UI.png",
  "32px-Main_Hardwood_UI.png",
  "32px-The_Crow_Perch.png",
  "69px-Apple_Store_Button.png",
  "69px-Discord_Button.png",
  "69px-Google_Play_Button.png",
  "69px-Reddit_Button.png",
  "69px-Steam_Button.png",
  "69px-Twitch_Button.png",
  "69px-Twitter_Button.png",
  "69px-Web_Button.png",
  "FarmCrop11.png",
  "FarmCrop3.png",
  "FarmCrop32.png",
  "FarmCrop41.png",
  "FarmCrop53.png",
  "FarmCrop64.png",
  "FarmCrop77.png",
  "FarmCrop79.png",
  "Farming_Skill_Icon.png",
  "favicon.png",
  "Graveyard_Shift.png",
  "Happy_Hour_Icon.png",
  "Idleon_Banner.png",
  "Meritocracy_Bonus_1.png",
  "Mutalius_Cuboid_Icon.png",
  "Research_Skill_Icon.png",
  "Trophie.png"
]);

function mirroredWikiAsset(assetPath) {
  try {
    const url = assetPath.startsWith("http")
      ? new URL(assetPath)
      : new URL(assetPath, "https://idleon.wiki");
    const fileName = decodeURIComponent(url.pathname.split("/").pop() || "");
    return localWikiAssets.has(fileName) ? `assets/wiki/${fileName}` : "";
  } catch {
    return "";
  }
}

const wikiAsset = (assetPath) => {
  if (!assetPath) return "";
  if (assetPath.startsWith("./") || assetPath.startsWith("assets/")) return encodeURI(assetPath);
  const localMirror = mirroredWikiAsset(assetPath);
  if (localMirror) return encodeURI(localMirror);
  if (!isLocalDashboard()) {
    if (assetPath.startsWith("http")) return assetPath;
    if (assetPath.startsWith("/")) return encodeURI(`https://idleon.wiki${assetPath}`);
    return encodeURI(assetPath);
  }
  if (assetPath.startsWith("https://idleon.wiki")) {
    const assetUrl = new URL(assetPath);
    return encodeURI(`${assetUrl.pathname}${assetUrl.search}`);
  }
  if (assetPath.startsWith("/")) return encodeURI(assetPath);
  if (assetPath.startsWith("http")) return assetPath;
  return encodeURI(`/${assetPath}`);
};
const localWikiFileName = (file) => file.replace(/\s+/g, "_");
const wikiFile = (file) => encodeURI(`assets/wiki/${localWikiFileName(file)}`);

function hashSeed(seed, base = 5381) {
  let a = Math.imul(seed, -862048943);
  a = Math.imul((a << 15) | (a >>> 17), 461845907);
  let b = base ^ a;
  b = Math.imul((b << 13) | (b >>> 19), 5) + -430675100;
  b = Math.imul(b ^ (b >> 16), -2048144789);
  b = Math.imul(b ^ (b >> 13), -1028477387);
  return b ^ (b >> 16);
}

class WikiRandom {
  constructor(seed) {
    this.seed = seed || 1;
    this.seed2 = hashSeed(seed);
    if (this.seed2 === 0) this.seed2 = 1;
  }

  nextSeeds() {
    this.seed = (36969 * (this.seed & 65535) + (this.seed >> 16)) | 0;
    this.seed2 = (18000 * (this.seed2 & 65535) + (this.seed2 >> 16)) | 0;
  }

  random(max) {
    this.nextSeeds();
    return ((((this.seed << 16) + this.seed2) | 0) & 1073741823) % max;
  }

  rand() {
    return this.random(10007) / 10007;
  }
}

function currentWikiWeek() {
  return Math.floor(Date.now() / (secondsPerWeek * 1000));
}

function wikiWeekDate(week) {
  return new Date(week * secondsPerWeek * 1000);
}

function formatWikiWeekDate(week) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(wikiWeekDate(week));
}

function nextWikiResetTarget() {
  return new Date((currentWikiWeek() + 1) * secondsPerWeek * 1000).toISOString();
}

function nextDailyResetTarget() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)).toISOString();
}

function nextDailyTournamentTarget() {
  const now = new Date();
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 20, 0, 0));
  if (now >= target) target.setUTCDate(target.getUTCDate() + 1);
  return target.toISOString();
}

function formatDailyTournamentLabel() {
  const localTime = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(nextDailyTournamentTarget()));
  return `20:00 UTC • ${localTime}`;
}

function targetFromSeconds(seconds, baseTime = Date.now(), cycleSeconds = 0) {
  const parsed = Number(seconds);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  let target = Number(baseTime) + parsed * 1000;
  if (!Number.isFinite(target)) target = Date.now() + parsed * 1000;
  while (cycleSeconds > 0 && target <= Date.now()) {
    target += cycleSeconds * 1000;
  }
  return new Date(target).toISOString();
}

function resolveIntelSource() {
  return DashboardProfile.resolve(storage.getItem(intelSourceKey), getSavedPayload(), getManualJson());
}
function getProfileDataForIntel() { return resolveIntelSource().payload; }

function getManualProfileData() { return DashboardProfile.parse(getManualJson()); }

function setIntelSource(source) {
  storage.setItem(intelSourceKey, source);
  setManualJsonStatus();
}

function getIntelSourceLabel() {
  return { manual: "Manual JSON", toolbox: "Toolbox", none: "No profile" }[resolveIntelSource().source];
}

function readTimeAway(profile) {
  const raw = profile?.timeAway || profile?.data?.TimeAway || profile?.data?.timeAway;
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const randomEventWorldMaps = [
  [
    ["GrasslandsA", "Spore Meadows"],
    ["GrasslandsB", "Froggy Fields"],
    ["SewerA", "Poopy Sewers"],
    ["TreeInteriorA", "The Base Of The Bark"],
    ["GrasslandsC", "Valley Of The Beans"],
    ["SewerB", "Rats Nest"],
    ["JungleA", "Jungle Perimeter"],
    ["GrasslandsD", "Birch Enclave"],
    ["TreeInteriorB", "Hollowed Trunk"],
    ["JungleB", "Winding Willows"],
    ["JungleC", "Vegetable Patch"],
    ["ForestA", "Forest Outskirts"],
    ["ForestB", "Encroaching Forest Villas"],
    ["ForestC", "Tucked Away"],
    ["TreeInteriorC", "Where the Branches End"]
  ],
  [
    ["zDesertCalmA", "Jar Bridge"],
    ["zDesertCalmB", "The Mimic Hole"],
    ["zDesertCalmC", "Dessert Dunes"],
    ["zDesertMildA", "The Grandioso Canyon"],
    ["zDesertMildB", "Shifty Sandbox"],
    ["zDesertMildC", "Pincer Plateau"],
    ["zDesertMildD", "Slamabam Straightaway"],
    ["zDesertNightA", "The Ring"],
    ["zDesertNightB", "Up Up Down Down"],
    ["zDesertNightC", "Sands of Time"],
    ["zDesertNightD", "Djonnuttown"]
  ],
  [
    ["ySnowA1", "Steep Sheep Ledge"],
    ["ySnowA2", "Snowfield Outskirts"],
    ["ySnowA3", "The Stache Split"],
    ["ySnowB1", "Refrigeration Station"],
    ["ySnowB2", "Mamooooth Mountain"],
    ["ySnowB3", "Rollin' Tundra"],
    ["ySnowB4", "Signature Slopes"],
    ["ySnowB5", "Thermonuclear Climb"],
    ["ySnowC1", "Waterlogged Entrance"],
    ["ySnowC2", "Cryo Catacombs"],
    ["ySnowC3", "Overpass of Sound"],
    ["ySnowC4", "Crystal Basecamp"],
    ["ySnowD1", "Wam Wonderland"]
  ]
];

const randomEventNames = ["Meteorite", "Mega Grumblo", "Glacial Guild", "Snake Swarm", "Angry Frogs"];

function getEventType(index) {
  if (index < 0.045) return 0;
  if (index < 0.087) return 1;
  if (index < 0.129) return 2;
  if (index < 0.171) return 3;
  if (index < 0.213) return 4;
  return -1;
}

function getEventMapOptions(eventType) {
  const maps = [];
  if ([0, 1, 3, 4].includes(eventType)) maps.push(...randomEventWorldMaps[0]);
  if ([0, 1, 3].includes(eventType)) maps.push(...randomEventWorldMaps[1]);
  if ([0, 2].includes(eventType)) maps.push(...randomEventWorldMaps[2]);
  return maps;
}

function formatIntelDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(date);
}

function formatUtcDate(date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const year = date.getUTCFullYear();
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  return `${day} ${month}, ${year} ${hour}:${minute}:${second} (UTC)`;
}

function calculateRandomEvents(serverVars, timeAway) {
  const randEventHour = Number(serverVars?.RandEvntHr);
  const globalTime = Number(timeAway?.GlobalTime);
  if (!Number.isFinite(randEventHour) || !Number.isFinite(globalTime)) return [];

  const currentGlobalTime = Math.max(globalTime, Date.now() / 1000);
  const seed = Math.round(Math.floor(currentGlobalTime / 3600));
  const events = [];
  for (let i = 0; i < 120; i += 1) {
    const actualSeed = seed + i + randEventHour;
    const eventType = getEventType(new WikiRandom(actualSeed).rand());
    const eventMaps = getEventMapOptions(eventType);
    if (!eventMaps.length) continue;
    const mapIndex = Math.min(Math.floor(new WikiRandom(actualSeed + 1).rand() * eventMaps.length), eventMaps.length - 1);
    const [, mapName] = eventMaps[mapIndex];
    const date = new Date((seed + i) * 3600 * 1000);
    if (date.getTime() + 3600 * 1000 <= Date.now()) continue;
    events.push({
      eventName: randomEventNames[eventType],
      mapName,
      date
    });
  }
  return events;
}

function getThursdayStart(date, future = false) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const offset = future
    ? ((4 - day + 7) % 7 || 7)
    : day === 4
      ? 0
      : -((day + 3) % 7 || 7);
  start.setDate(start.getDate() + offset);
  return new Date(start.getTime() - start.getTimezoneOffset() * 60 * 1000);
}

function calculateHappyHours(serverVars) {
  const happyHours = Array.isArray(serverVars?.HappyHours) ? serverVars.HappyHours : [];
  if (!happyHours.length) return [];
  const secondsInHour = 3600;
  const lastThursday = getThursdayStart(new Date(), false);
  const dates = happyHours
    .map((time) => (Number(time) + Math.round(lastThursday.getTime() / 1000) - secondsInHour) * 1000)
    .filter((time) => Number.isFinite(time) && time > Date.now())
    .map((time) => new Date(time));
  if (dates.length) return dates;
  const nextThursday = getThursdayStart(new Date(), true);
  return happyHours
    .map((time) => (Number(time) + Math.round(nextThursday.getTime() / 1000) - secondsInHour) * 1000)
    .filter((time) => Number.isFinite(time))
    .map((time) => new Date(time));
}

function getMeritocracyResetTarget(timeAway, baseTime = Date.now()) {
  const globalTime = Number(timeAway?.GlobalTime);
  if (!Number.isFinite(globalTime)) return "";
  const secondsLeft = secondsPerWeek - ((globalTime + 543460) - secondsPerWeek * Math.floor((globalTime + 543460) / secondsPerWeek));
  return targetFromSeconds(secondsLeft, baseTime, secondsPerWeek);
}

const meritocracyBonuses = [
  "Everything in the game",
  "Gaming Bits gained",
  "Double Snail Mail chance",
  "Kattlekruk Bubble LVs",
  "Shiny Critters from Trapping",
  "Total Damage",
  "Sneaking Jade",
  "Monument Reward Multi",
  "Gaming Palette Luck",
  "Bonus Ballot bonuses",
  "Skill EXP",
  "Ribbon Shelf Ribbons",
  "Orion and Poppy production",
  "Beryllium PO boxes",
  "Stamp max LV material costs",
  "Daily Crystal Mobs",
  "Worship PTS in Tower Defence",
  "Spelunking stamina regen",
  "Killroy Skull chance",
  "Masterclass claim AFK items",
  "Vial bonuses",
  "Sigil bonuses",
  "Starsign bonuses",
  "Slab bonuses",
  "Brain Coral Grind Time LVs",
  "Bones, Dust, and Tachyons",
  "Statue bonuses",
  "Class EXP"
];

function meritocracyIcon(index) {
  const safeIndex = Math.max(1, Number(index) || 1);
  return `assets/toolbox/MeritBon${safeIndex}.png`;
}

function getMeritocracyChoices(serverVars = {}) {
  const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return [];
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => value[key]);
  };
  const categories = toArray(serverVars.voteCat2).map(Number).filter(Number.isFinite);
  const percents = toArray(serverVars.votePercent2).map(Number);
  if (!categories.length) return null;

  const optionIndexes = categories.slice(1);
  const options = optionIndexes.map((index, optionIndex) => ({
    index,
    percent: percents[optionIndex],
    name: meritocracyBonuses[index] || `Bonus ${index + 1}`
  }));
  const selected = categories[0];

  return {
    selected,
    selectedName: meritocracyBonuses[selected] || `Bonus ${selected + 1}`,
    current: {
      index: selected,
      name: meritocracyBonuses[selected] || `Bonus ${selected + 1}`
    },
    options
  };
}

function getWeeklyBossShopItems(seed) {
  const firstRandom = Math.max(0, Math.min(weeklyBossesShop[0].length - 1, Math.floor(new WikiRandom(Math.floor(seed + 36)).rand() * weeklyBossesShop[0].length)));
  let secondRandom = Math.max(0, Math.min(weeklyBossesShop[0].length - 1, Math.floor(new WikiRandom(Math.floor(seed + 72)).rand() * weeklyBossesShop[0].length)));
  let loop = 0;
  while (firstRandom === secondRandom && loop < 100) {
    loop += 1;
    secondRandom = Math.max(0, Math.min(weeklyBossesShop[0].length - 1, Math.floor(new WikiRandom(seed + loop).rand() * weeklyBossesShop[0].length)));
  }

  const thirdRandom = Math.max(0, Math.min(weeklyBossesShop[1].length - 1, Math.floor(new WikiRandom(Math.floor(seed + 10)).rand() * weeklyBossesShop[1].length)));
  let fourthRandom = Math.max(0, Math.min(weeklyBossesShop[1].length - 1, Math.floor(new WikiRandom(seed + 20).rand() * weeklyBossesShop[1].length)));
  let extraSeed = 0;
  while (thirdRandom === fourthRandom && extraSeed < 710) {
    extraSeed += 71;
    fourthRandom = Math.max(0, Math.min(weeklyBossesShop[1].length - 1, Math.floor(new WikiRandom(seed + extraSeed).rand() * weeklyBossesShop[1].length)));
  }

  return [
    weeklyBossesShop[0][firstRandom],
    weeklyBossesShop[0][secondRandom],
    weeklyBossesShop[1][thirdRandom],
    weeklyBossesShop[1][fourthRandom]
  ];
}

function getWeeklyBossData(week = currentWikiWeek()) {
  const rng = new WikiRandom(week);
  const randomSeed = Math.floor(rng.rand() * 1000);
  const bossIndex = Math.max(0, Math.min(weeklyBosses.length - 1, Math.floor((randomSeed / 1000) * weeklyBosses.length)));
  const nextRng = new WikiRandom(week + 1);
  const nextSeed = Math.floor(nextRng.rand() * 1000);
  const nextBossIndex = Math.max(0, Math.min(weeklyBosses.length - 1, Math.floor((nextSeed / 1000) * weeklyBosses.length)));
  return {
    boss: weeklyBosses[bossIndex],
    nextBoss: weeklyBosses[nextBossIndex],
    items: getWeeklyBossShopItems(randomSeed)
  };
}

function generateRandomNumber(seed, upperBound) {
  const random = Math.floor(new WikiRandom(seed).rand() * 1000);
  return upperBound ? random % upperBound : random;
}

function getLabSlotItems(week, slot) {
  const choices = slot === 3 ? labJewels : labChips;
  const numChoices = slot === 1 ? choices.length - 10 : choices.length;
  let seed = week + ((slot - 1) * 500);
  let item = generateRandomNumber(seed, numChoices);
  const prevItem = generateRandomNumber(seed - 1, numChoices);
  if (prevItem === item) {
    const nextItem = generateRandomNumber(seed + 1, numChoices);
    while (item === prevItem || item === nextItem) {
      seed += 765;
      item = generateRandomNumber(seed, numChoices);
    }
  }

  const results = [];
  const luaIndex = item + 1;
  if ((luaIndex >= 19 && luaIndex <= 21) || (luaIndex >= 22 && luaIndex <= 24)) {
    const alt = Math.max(1, luaIndex - 10);
    if (alt <= choices.length) results.push(choices[alt - 1]);
  }
  results.push(choices[item]);
  return results;
}

function getExoticItems(week) {
  const items = [];
  const usedIndices = new Set();
  for (let i = 0; i < 8; i += 1) {
    let offset = 0;
    let index;
    do {
      const seed = Math.floor(100 * week + i + offset);
      index = Math.floor(Math.max(0, Math.min(59, 60 * new WikiRandom(seed).rand())));
      offset += 1000;
    } while (usedIndices.has(index) && offset <= 100000);
    usedIndices.add(index);
    items.push(exoticUpgrades[index]);
  }
  return items;
}

function syncLocalWeeklyRotations() {
  const week = currentWikiWeek();
  const resetDate = formatWikiWeekDate(week + 1);
  const profile = getProfileDataForIntel();
  const timeAway = readTimeAway(profile);
  const profileBaseTime = normalizeTimestamp(profile?.lastUpdated) || Date.now();
  const serverVars = profile?.serverVars || profile?.data?.serverVars || {};
  const quickCard = publicRotations.find((rotation) => rotation.id === "quick-events");
  const weeklyCard = publicRotations.find((rotation) => rotation.id === "weekly-battle");
  const labCard = publicRotations.find((rotation) => rotation.id === "lab-rotation");
  const exoticCard = publicRotations.find((rotation) => rotation.id === "exotic-market");
  const tournamentCard = publicRotations.find((rotation) => rotation.id === "daily-tournaments");
  const meritocracyCard = publicRotations.find((rotation) => rotation.id === "meritocracy-weekly");

  if (quickCard) {
    quickCard.weeklyResetDate = resetDate;
    quickCard.weeklyResetTarget = nextWikiResetTarget();
    const events = calculateRandomEvents(serverVars, timeAway);
    const nextEvent = events[0];
    if (nextEvent) {
      const active = nextEvent.date.getTime() <= Date.now();
      quickCard.eventName = nextEvent.eventName;
      quickCard.eventMap = nextEvent.mapName;
      quickCard.eventWorld = "";
      quickCard.eventTime = `${active ? "Active now" : formatDuration((nextEvent.date.getTime() - Date.now()) / 1000)} • ${formatUtcDate(nextEvent.date)} • ${formatIntelDate(nextEvent.date)}`;
      quickCard.value = nextEvent.eventName;
    } else {
      quickCard.eventName = "Check Profile";
      quickCard.eventMap = "Live random event data needs a fresh public Toolbox profile.";
      quickCard.eventWorld = "";
      quickCard.eventTime = "Use Check Profile after updating Toolbox.";
      quickCard.value = "Check Profile";
    }

    const happyHours = calculateHappyHours(serverVars);
    const nextHappyHour = happyHours[0];
    quickCard.happyTime = nextHappyHour
      ? `${formatDuration((nextHappyHour.getTime() - Date.now()) / 1000)} • ${formatUtcDate(nextHappyHour)} • ${formatIntelDate(nextHappyHour)}`
      : "Use Check Profile after updating Toolbox.";
  }

  if (tournamentCard) {
    const dailyTarget = nextDailyTournamentTarget();
    tournamentCard.target = dailyTarget;
    tournamentCard.value = "Next Daily Reset";
    tournamentCard.detail = formatDailyTournamentLabel();
    if (quickCard) {
      quickCard.dailyTournamentTarget = dailyTarget;
      quickCard.dailyTournamentValue = tournamentCard.value;
      quickCard.dailyTournamentDetail = tournamentCard.detail;
      quickCard.dailyTournamentUtc = "20:00 UTC";
    }
  }

  if (meritocracyCard) {
    const choices = getMeritocracyChoices(serverVars);
    meritocracyCard.target = getMeritocracyResetTarget(timeAway, profileBaseTime) || nextWikiResetTarget();
    meritocracyCard.showCountdown = false;
    meritocracyCard.value = choices ? choices.selectedName : "Check Profile First";
    meritocracyCard.detail = choices
      ? "Current bonus, with next vote options below."
      : profile
        ? "Profile data loaded, but Meritocracy vote data was not found. Update your public Toolbox profile after opening the vote screen in game."
        : "Load a public profile to show the current bonus and options.";
    meritocracyCard.icon = choices ? meritocracyIcon(choices.selected) : meritocracyIcon(0);
    meritocracyCard.items = choices
      ? choices.options.map((option) => [
          `${option.name}${Number.isFinite(Number(option.percent)) ? ` (${option.percent}%)` : ""}`,
          meritocracyIcon(option.index)
        ])
      : [];
  }

  if (weeklyCard) {
    const weekly = getWeeklyBossData(week);
    weeklyCard.value = weekly.boss;
    weeklyCard.icon = wikiFile(`${weekly.boss} Icon.png`);
    weeklyCard.detail = `Next: ${weekly.nextBoss}`;
    weeklyCard.items = weekly.items.map((item) => [item.name, wikiFile(item.file)]);
  }

  if (labCard) {
    const labItems = [
      ...getLabSlotItems(week, 1).map((name) => [name, wikiFile(`Lab - ${name}.png`)]),
      ...getLabSlotItems(week, 2).map((name) => [name, wikiFile(`Lab - ${name}.png`)]),
      ...getLabSlotItems(week, 3).map((name) => [name, wikiFile(`Console Jewel ${name}.png`)])
    ];
    labCard.value = formatWikiWeekDate(week);
    labCard.items = labItems;
  }

  if (exoticCard) {
    exoticCard.value = "Current Week";
    exoticCard.items = getExoticItems(week).map(([name, cropId]) => [titleCaseWikiName(name), wikiFile(`FarmCrop${cropId}.png`)]);
  }
}

const publicLinks = {
  communities: [
    { name: "Discord", url: "https://discord.com/invite/idleon", icon: "/images/thumb/c/cd/Discord_Button.png/69px-Discord_Button.png" },
    { name: "Twitter", url: "https://twitter.com/lavaflame2", icon: "/images/thumb/b/bb/Twitter_Button.png/69px-Twitter_Button.png" },
    { name: "Reddit", url: "https://www.reddit.com/r/idleon/", icon: "/images/thumb/e/ea/Reddit_Button.png/69px-Reddit_Button.png" },
    { name: "Twitch", url: "https://www.twitch.tv/lavaflame2", icon: "/images/thumb/0/0f/Twitch_Button.png/69px-Twitch_Button.png" }
  ],
  platforms: [
    { name: "Google Play", url: "https://play.google.com/store/apps/details?id=com.lavaflame.MMO", icon: "/images/thumb/b/b7/Google_Play_Button.png/69px-Google_Play_Button.png" },
    { name: "iOS", url: "https://apps.apple.com/us/app/idleon-idle-mmo/id1636526901", icon: "/images/thumb/d/d9/Apple_Store_Button.png/69px-Apple_Store_Button.png" },
    { name: "Steam", url: "https://store.steampowered.com/app/1476970/Legends_of_Idleon_MMO/", icon: "/images/thumb/5/53/Steam_Button.png/69px-Steam_Button.png" },
    { name: "Web", url: "https://www.legendsofidleon.com/", icon: "/images/thumb/a/aa/Web_Button.png/69px-Web_Button.png" }
  ],
  extras: [
    { name: "SteamDB", url: "https://steamdb.info/app/1476970/", icon: "/images/thumb/5/53/Steam_Button.png/69px-Steam_Button.png" },
    { name: "Patch Notes", url: "https://idleon.wiki/wiki/Changelog/2026", icon: "/resources/assets/favicon.png" },
    { name: "Reserved", blank: true },
    { name: "RIP Tools", popup: "rip", icon: "/images/2/28/Graveyard_Shift.png" }
  ]
};

const publicRotations = [
  {
    id: "quick-events",
    title: "Events",
    value: "Check Profile",
    detail: "",
    icon: "/images/2/28/Happy_Hour_Icon.png",
    eventName: "Check Profile",
    eventMap: "Live event data needs public Toolbox server variables.",
    eventWorld: "",
    eventTime: "Use Check Profile after updating Toolbox.",
    happyTime: "Use Check Profile after updating Toolbox.",
    weeklyResetDate: "",
    live: true
  },
  {
    id: "weekly-battle",
    title: "Weekly Battle",
    value: "Mutalius Cuboid",
    detail: "Next: Decibop Box on May 7, 2026",
    icon: "/images/9/9e/Mutalius_Cuboid_Icon.png",
    target: "2026-05-07T00:00:00Z",
    nextDate: "May 7, 2026",
    showCountdown: false,
    showDetail: false,
    items: [
      ["Hardwood UI", "/images/thumb/6/64/Main_Hardwood_UI.png/32px-Main_Hardwood_UI.png"],
      ["Catacomb UI", "/images/thumb/5/51/Main_Catacomb_UI.png/32px-Main_Catacomb_UI.png"],
      ["Killroy Skulls", "/images/thumb/9/91/Killroy_Skull.png/32px-Killroy_Skull.png"],
      ["The Crow Perch", "/images/thumb/3/3e/The_Crow_Perch.png/32px-The_Crow_Perch.png"]
    ]
  },
  {
    id: "lab-rotation",
    title: "Lab Rotation",
    value: "30 Apr 2026",
    detail: "Next: May 7, 2026",
    icon: "/images/thumb/6/6e/Lab_-_Conductive_Nanochip.png/24px-Lab_-_Conductive_Nanochip.png",
    target: "2026-05-07T00:00:00Z",
    nextDate: "May 7, 2026",
    showCountdown: false,
    showDetail: false,
    items: [
      ["Conductive Nanochip", "/images/thumb/6/6e/Lab_-_Conductive_Nanochip.png/24px-Lab_-_Conductive_Nanochip.png"],
      ["Galvanic Motherboard", "/images/thumb/c/c6/Lab_-_Galvanic_Motherboard.png/24px-Lab_-_Galvanic_Motherboard.png"],
      ["Omega Motherboard", "/images/thumb/3/3b/Lab_-_Omega_Motherboard.png/24px-Lab_-_Omega_Motherboard.png"],
      ["Pyrite Pyramite", "/images/thumb/2/26/Console_Jewel_Pyrite_Pyramite.png/24px-Console_Jewel_Pyrite_Pyramite.png"]
    ]
  },
  {
    id: "exotic-market",
    title: "Exotic Market",
    value: "Current Week",
    detail: "Next week: May 7, 2026",
    icon: "/images/4/47/FarmCrop77.png",
    target: "2026-05-07T00:00:00Z",
    nextDate: "May 7, 2026",
    showCountdown: false,
    showDetail: false,
    items: [
      ["Exalted Eldou", "/images/4/47/FarmCrop77.png"],
      ["5 Leaf Clover", "/images/a/a7/FarmCrop79.png"],
      ["Geneology I", "/images/f/f8/FarmCrop11.png"],
      ["Better Day I", "/images/0/06/FarmCrop53.png"],
      ["Largume II", "/images/3/30/FarmCrop32.png"],
      ["Briar Patch", "/images/3/33/FarmCrop64.png"],
      ["Evergrown II", "/images/e/ed/FarmCrop41.png"],
      ["Sproutlock I", "/images/3/3d/FarmCrop3.png"]
    ]
  },
  {
    id: "daily-tournaments",
    title: "Daily Tournaments",
    value: "Next Daily Reset",
    detail: "W7 tournament entries reset daily.",
    icon: "/images/f/f2/Trophie.png",
    showDetail: true,
    hiddenFromIntel: true
  },
  {
    id: "meritocracy-weekly",
    title: "Multi Meritocracy",
    value: "Weekly Bonus Reset",
    detail: "World 7 community bonus resets with the weekly rotation.",
    icon: "https://idleon.wiki/wiki/Special:Redirect/file/Meritocracy_Bonus_1.png",
    showDetail: true
  }
];

const secondsPerWeek = 604800;

const weeklyBossesShop = [
  [
    { name: "Galaxy UI", file: "Main Galaxy UI.png", price: 50 },
    { name: "Hardwood UI", file: "Main Hardwood UI.png", price: 15 },
    { name: "Deadwood UI", file: "Main Deadwood UI.png", price: 15 },
    { name: "Corkboard UI", file: "Main Corkboard UI.png", price: 25 },
    { name: "Catacomb UI", file: "Main Catacomb UI.png", price: 40 },
    { name: "Rift UI", file: "Main Rift UI.png", price: 35 },
    { name: "Magma UI", file: "Main Magma UI.png", price: 40 },
    { name: "Grassy UI", file: "Main Grassy UI.png", price: 30 },
    { name: "Sandburn UI", file: "Main Sandburn UI.png", price: 25 },
    { name: "Graveyard UI", file: "Main Graveyard UI.png", price: 20 },
    { name: "Goldwood UI", file: "Main Goldwood UI.png", price: 60 },
    { name: "Peachwood UI", file: "Main Peachwood UI.png", price: 20 }
  ],
  [
    { name: "Pink Headband", file: "Pink Headband.png", price: 999 },
    { name: "Killroy Skulls", file: "Killroy Skull.png", price: 14 },
    { name: "Bored To Death", file: "Bored To Death.png", price: 25 },
    { name: "Boss Battle Spillover", file: "Boss Battle Spillover.png", price: 25 },
    { name: "The Crow Perch", file: "The Crow Perch.png", price: 125 },
    { name: "Golden Food", file: "Golden Nomwich.png", price: 12 },
    { name: "Power Statue", file: "Power Statue.png", price: 12 },
    { name: "Silver Pocketwatch", file: "Silver Pocketwatch.png", price: 2 },
    { name: "Gold Pocketwatch", file: "Gold Pocketwatch.png", price: 30 }
  ]
];

const weeklyBosses = [
  "Eclectic Lazlo",
  "Decibop Box",
  "Mutalius Cuboid",
  "Jupiteye Major",
  "The Nugenator",
  "Fat Eggplonk",
  "Mollo Gomm",
  "Unit T-31",
  "SWR Containment"
];

const labChips = [
  "Grounded Nanochip",
  "Grounded Motherboard",
  "Grounded Software",
  "Grounded Processor",
  "Potato Chip",
  "Conductive Nanochip",
  "Conductive Motherboard",
  "Conductive Software",
  "Conductive Processor",
  "Chocolatey Chip",
  "Galvanic Nanochip",
  "Galvanic Motherboard",
  "Galvanic Software",
  "Galvanic Processor",
  "Wood Chip",
  "Silkrode Nanochip",
  "Silkrode Motherboard",
  "Silkrode Software",
  "Silkrode Processor",
  "Poker Chip",
  "Omega Nanochip",
  "Omega Motherboard"
];

const labJewels = [
  "Amethyst Rhinestone",
  "Purple Navette",
  "Purple Rhombol",
  "Sapphire Rhinestone",
  "Sapphire Navette",
  "Sapphire Rhombol",
  "Sapphire Pyramite",
  "Pyrite Rhinestone",
  "Pyrite Navette",
  "Pyrite Rhombol",
  "Pyrite Pyramite",
  "Emerald Rhinestone",
  "Emerald Navette",
  "Emerald Rhombol",
  "Emerald Pyramite",
  "Emerald Ulthurite",
  "Black Diamond Rhinestone",
  "Black Diamond Ulthurite",
  "Pure Opal Rhinestone",
  "Pure Opal Navette",
  "Pure Opal Rhombol",
  "Deadly Wrath Jewel",
  "Eternal Energy Jewel",
  "North Winds Jewel"
];

const exoticUpgrades = [
  ["SPROUTLUCK I", 3],
  ["SPROUTLUCK II", 5],
  ["SPROUTLUCK III", 6],
  ["SPROUTLUCK IV", 7],
  ["GENEOLOGY I", 9],
  ["GENEOLOGY II", 11],
  ["GENEOLOGY III", 13],
  ["GENEOLOGY IV", 15],
  ["GENEOLOGY V", 16],
  ["STABLEROOT I", 17],
  ["STABLEROOT II", 18],
  ["STABLEROOT III", 20],
  ["VIGOUROOT I", 21],
  ["VIGOUROOT II", 23],
  ["PLUMP DATABASE", 24],
  ["DATADIGGING", 25],
  ["LEGUMIOSO I", 27],
  ["LEGUMIOSO II", 29],
  ["LEGUMIOSO III", 30],
  ["LARGUMES I", 31],
  ["LARGUMES II", 32],
  ["FARMER BRAIN", 33],
  ["FARMER KNOWHOW", 34],
  ["STALK VALUE I", 36],
  ["STALK VALUE II", 37],
  ["STALK VALUE III", 38],
  ["EVERGROW I", 40],
  ["EVERGROW II", 41],
  ["DOUBLE PETAL I", 42],
  ["DOUBLE PETAL II", 44],
  ["GOGOGROW", 45],
  ["BOUNTIFUL I", 46],
  ["BOUNTIFUL II", 48],
  ["BOUNTIFUL III", 50],
  ["BETTER DAY I", 51],
  ["BETTER DAY II", 53],
  ["BETTER NIGHT I", 54],
  ["BETTER NIGHT II", 56],
  ["BETTER EXOTIC", 58],
  ["FREEXOTIC", 60],
  ["SCIENTERRIFIC", 62],
  ["BRIAR PATCH", 64],
  ["GRAVEL POUND", 66],
  ["SAP SURGE", 67],
  ["4 LEAF CLOVER", 69],
  ["5 LEAF CLOVER", 79],
  ["BUD COURIER", 71],
  ["STUDIOUS SPORE", 73],
  ["PRISMA PETAL", 75],
  ["EXALTED ELDOU", 77],
  ["INTELLEAF", 78],
  ["GRAPEVINE", 81],
  ["HOLLOW TRUNK", 83],
  ["BONEMEAL SOIL", 85],
  ["FORCE OF NAUTRE", 86],
  ["PURPLE GRASS", 87],
  ["POTENT HEMLOCK", 88],
  ["GOLD FIGLEAF", 89],
  ["SNAPEGRASS", 91],
  ["POMMELION SEED", 92]
];
function faviconUrl(url) {
  const host = new URL(url).hostname;
  return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
}

function toolIcon(tool) {
  return tool.icon ? wikiAsset(tool.icon) : faviconUrl(tool.url);
}

function matchesTool(tool) {
  return Boolean(tool);
}

function saveFavorites() {
  storage.setItem(favoriteKey, JSON.stringify([...state.favorites]));
}

function getDefaultLayoutSection() {
  return {
    collapsed: false,
    compact: false,
    hidden: [],
    order: [],
    sizes: {}
  };
}

function getDefaultSidebarLayout() {
  return {
    order: [...sidebarOrderDefaults]
  };
}

function getLayoutState() {
  const parsed = storage.readJSON(layoutKey, {}, isRecord);
  for (const key of ["tools", "intel", "sidebar"]) {
    const value = parsed[key];
    if (value !== undefined && (!isRecord(value) || ["hidden", "order"].some((field) => value[field] !== undefined && (!Array.isArray(value[field]) || !value[field].every((id) => typeof id === "string"))) || (value.sizes !== undefined && !isRecord(value.sizes)))) storage.protect(layoutKey);
  }
  const section = (value) => {
    const raw = isRecord(value) ? value : {};
    return { ...getDefaultLayoutSection(), ...raw,
      hidden: Array.isArray(raw.hidden) ? raw.hidden.filter((id) => typeof id === "string") : [],
      order: Array.isArray(raw.order) ? raw.order.filter((id) => typeof id === "string") : [],
      sizes: isRecord(raw.sizes) ? raw.sizes : {} };
  };
  return { ...parsed, tools: section(parsed.tools), intel: section(parsed.intel),
    sidebar: { ...getDefaultSidebarLayout(), ...(isRecord(parsed.sidebar) ? parsed.sidebar : {}),
      order: Array.isArray(parsed.sidebar?.order) ? parsed.sidebar.order : [...sidebarOrderDefaults] } };
}

function setLayoutState(layout) {
  storage.setItem(layoutKey, JSON.stringify(layout));
}

function updateLayoutSection(sectionId, updater) {
  const layout = getLayoutState();
  layout[sectionId] = updater({ ...getDefaultLayoutSection(), ...(layout[sectionId] || {}) });
  setLayoutState(layout);
  applyAllLayouts();
}

function sectionContainer(sectionId) {
  return sectionId === "tools" ? grid : rotationGrid;
}

function sectionWrapper(sectionId) {
  return sectionId === "tools" ? document.querySelector("#toolsSection") : currentIntel;
}

function getSectionCards(sectionId) {
  return [...sectionContainer(sectionId).querySelectorAll(`.custom-card[data-section-id="${sectionId}"]`)];
}

function moveCard(sectionId, cardId, direction) {
  updateLayoutSection(sectionId, (section) => {
    const cards = getSectionCards(sectionId);
    const ids = section.order.length
      ? section.order.filter((id) => cards.some((card) => card.dataset.cardId === id))
      : cards.map((card) => card.dataset.cardId);
    cards.forEach((card) => {
      if (!ids.includes(card.dataset.cardId)) ids.push(card.dataset.cardId);
    });
    const index = ids.indexOf(cardId);
    const nextIndex = Math.max(0, Math.min(ids.length - 1, index + direction));
    if (index > -1 && index !== nextIndex) {
      ids.splice(index, 1);
      ids.splice(nextIndex, 0, cardId);
    }
    return { ...section, order: ids };
  });
}

function moveToolInControls(toolId, direction) {
  updateLayoutSection("tools", (section) => {
    const ids = [
      ...(section.order || []).filter((id) => tools.some((tool) => tool.id === id)),
      ...tools.map((tool) => tool.id).filter((id) => !(section.order || []).includes(id))
    ];
    const index = ids.indexOf(toolId);
    const nextIndex = Math.max(0, Math.min(ids.length - 1, index + direction));
    if (index > -1 && index !== nextIndex) {
      ids.splice(index, 1);
      ids.splice(nextIndex, 0, toolId);
    }
    return { ...section, order: ids };
  });
  renderCards();
  renderQuickList();
}

function toggleHiddenCard(sectionId, cardId) {
  updateLayoutSection(sectionId, (section) => {
    const hidden = new Set(section.hidden);
    if (hidden.has(cardId)) hidden.delete(cardId);
    else hidden.add(cardId);
    return { ...section, hidden: [...hidden] };
  });
}

function cycleCardSize(sectionId, cardId) {
  const sizes = ["", "wide", "tall", "big"];
  updateLayoutSection(sectionId, (section) => {
    const current = section.sizes?.[cardId] || "";
    const next = sizes[(sizes.indexOf(current) + 1) % sizes.length];
    const nextSizes = { ...(section.sizes || {}) };
    if (next) nextSizes[cardId] = next;
    else delete nextSizes[cardId];
    return { ...section, sizes: nextSizes };
  });
}

function makeCardControls(card, sectionId) {
  card.querySelector(".layout-card-controls")?.remove();
  const cardId = card.dataset.cardId;
  const controls = document.createElement("div");
  controls.className = "layout-card-controls";
  controls.innerHTML = `
    <button class="card-move-up" type="button" title="Move up">Up</button>
    <button class="card-move-down" type="button" title="Move down">Dn</button>
    ${sectionId === "tools" ? "" : `<button class="card-size" type="button" title="Change card size">Size</button>`}
  `;
  controls.querySelector(".card-move-up").addEventListener("click", () => moveCard(sectionId, cardId, -1));
  controls.querySelector(".card-move-down").addEventListener("click", () => moveCard(sectionId, cardId, 1));
  controls.querySelector(".card-size")?.addEventListener("click", () => cycleCardSize(sectionId, cardId));
  card.append(controls);
}

function enableCardDrag(card, sectionId) {
  card.draggable = true;
  card.addEventListener("dragstart", (event) => {
    state.draggedCard = { sectionId, cardId: card.dataset.cardId };
    event.dataTransfer.effectAllowed = "move";
  });
  card.addEventListener("dragover", (event) => {
    if (state.draggedCard?.sectionId === sectionId) {
      event.preventDefault();
      card.classList.add("drag-over");
    }
  });
  card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
  card.addEventListener("drop", (event) => {
    event.preventDefault();
    card.classList.remove("drag-over");
    const dragged = state.draggedCard;
    state.draggedCard = null;
    if (!dragged || dragged.sectionId !== sectionId || dragged.cardId === card.dataset.cardId) return;
    updateLayoutSection(sectionId, (section) => {
      const cards = getSectionCards(sectionId);
      const ids = section.order.length
        ? section.order.filter((id) => cards.some((item) => item.dataset.cardId === id))
        : cards.map((item) => item.dataset.cardId);
      cards.forEach((item) => {
        if (!ids.includes(item.dataset.cardId)) ids.push(item.dataset.cardId);
      });
      const from = ids.indexOf(dragged.cardId);
      const to = ids.indexOf(card.dataset.cardId);
      if (from > -1 && to > -1) {
        ids.splice(from, 1);
        ids.splice(to, 0, dragged.cardId);
      }
      return { ...section, order: ids };
    });
  });
  card.addEventListener("dragend", () => {
    state.draggedCard = null;
    card.classList.remove("drag-over");
  });
}

function setupCustomCard(card, sectionId, cardId) {
  card.classList.add("custom-card");
  card.dataset.sectionId = sectionId;
  card.dataset.cardId = cardId;
  if (card.dataset.layoutReady === "true") return;
  card.dataset.layoutReady = "true";
}

function applySectionLayout(sectionId) {
  const layout = getLayoutState();
  const section = layout[sectionId] || getDefaultLayoutSection();
  const wrapper = sectionWrapper(sectionId);
  const container = sectionContainer(sectionId);
  const cards = getSectionCards(sectionId);
  const byId = new Map(cards.map((card) => [card.dataset.cardId, card]));
  const orderSource = sectionId === "intel" ? fixedIntelOrder : section.order;
  const orderedIds = [
    ...orderSource.filter((id) => byId.has(id)),
    ...cards.map((card) => card.dataset.cardId).filter((id) => !orderSource.includes(id))
  ];

  orderedIds.forEach((id, index) => {
    const card = byId.get(id);
    const current = container.children[index];
    if (current !== card) container.insertBefore(card, current || null);
  });
  const collapsed = sectionId !== "intel" && section.collapsed;
  const hiddenIds = sectionId === "intel" ? [] : section.hidden;
  wrapper.classList.toggle("section-collapsed", collapsed);
  wrapper.classList.toggle("tools-compact-section", sectionId === "tools" && section.compact);
  container.hidden = collapsed;
  cards.forEach((card) => {
    const size = sectionId === "intel" ? "" : section.sizes?.[card.dataset.cardId] || "";
    card.classList.toggle("is-hidden-card", hiddenIds.includes(card.dataset.cardId));
    card.classList.toggle("card-wide", sectionId !== "tools" && size === "wide");
    card.classList.toggle("card-tall", sectionId !== "tools" && size === "tall");
    card.classList.toggle("card-big", sectionId !== "tools" && size === "big");
  });
  renderSectionControls(sectionId);
}

function getSidebarOrder(order = []) {
  return [
    ...order.filter((id) => sidebarOrderDefaults.includes(id)),
    ...sidebarOrderDefaults.filter((id) => !order.includes(id))
  ];
}

function moveSidebarPanel(sideId, direction) {
  const layout = getLayoutState();
  const current = { ...getDefaultSidebarLayout(), ...(layout.sidebar || {}) };
  const order = getSidebarOrder(current.order);
  const index = order.indexOf(sideId);
  const nextIndex = Math.max(0, Math.min(order.length - 1, index + direction));
  if (index > -1 && index !== nextIndex) {
    order.splice(index, 1);
    order.splice(nextIndex, 0, sideId);
    layout.sidebar = { ...current, order };
    setLayoutState(layout);
    applySidebarLayout();
  }
}

function setupSidebarMoveControls(panel) {
  panel.querySelector(".side-move-controls")?.remove();
  panel.dataset.sidebarControlsReady = "false";
}

function applySidebarLayout() {
  const panels = [...document.querySelectorAll(".side-panel [data-side-id]")];
  if (!panels.length) return;

  const layout = getLayoutState();
  const order = getSidebarOrder(layout.sidebar?.order || []);
  const orderMap = new Map(order.map((id, index) => [id, index + 1]));

  panels.forEach((panel) => {
    panel.style.order = orderMap.get(panel.dataset.sideId) || 50;
  });

  const notesPanel = document.querySelector("#notesPanel");
  if (notesPanel) notesPanel.style.order = 99;
}

function applyAllLayouts() {
  ["tools", "intel"].forEach(applySectionLayout);
  applySidebarLayout();
}

function renderSectionControls(sectionId) {
  const host = document.querySelector(`[data-layout-controls="${sectionId}"]`);
  if (!host) return;
  const section = getLayoutState()[sectionId] || getDefaultLayoutSection();
  host.innerHTML = "";

  const compact = document.createElement("button");
  compact.type = "button";
  compact.title = section.compact ? "Use full tool cards" : "Compact all tool cards";
  compact.textContent = section.compact ? "Full" : "Compact";
  compact.addEventListener("click", () => {
    updateLayoutSection(sectionId, (current) => ({ ...current, compact: !current.compact }));
    if (sectionId === "tools") render();
  });

  if (sectionId === "tools") host.append(compact);
}

function launchUrl(url, options = {}) {
  url = safeWebUrl(url);
  if (!url) return;
  const fallback = options.fallback !== false;
  const newWindow = window.open(url, "_blank");
  if (newWindow) {
    newWindow.opener = null;
    window.focus();
  } else if (fallback) {
    window.location.href = url;
  }
}

function getFavoriteTargets() {
  const favoriteTools = tools
    .filter((tool) => state.favorites.has(tool.id))
    .map((tool) => ({ name: tool.name, url: tool.url, icon: toolIcon(tool) }));
  const favoriteSavedLinks = getSavedLinks()
    .filter((link) => !link.hiddenPreset && link.inControls && link.favorite)
    .map((link) => ({ name: link.name, url: savedLinkTarget(link), icon: "" }));
  const targets = favoriteTools.length > 0 || favoriteSavedLinks.length > 0
    ? [...favoriteTools, ...favoriteSavedLinks]
    : tools.map((tool) => ({ name: tool.name, url: tool.url, icon: toolIcon(tool) }));
  const seen = new Set();
  return targets.filter((target) => {
    if (!target.url || seen.has(target.url)) return false;
    seen.add(target.url);
    return true;
  });
}

function showFavoritesModal() {
  const targets = getFavoriteTargets();
  favoritesModalList.innerHTML = "";
  targets.forEach((target) => {
    const button = document.createElement("button");
    button.type = "button";
    if (!target.icon) button.classList.add("no-icon");
    button.innerHTML = `
      ${target.icon ? `<img src="${target.icon}" alt="">` : ""}
      <span>${escapeHtml(target.name)}</span>
      <strong class="icon icon-external" aria-hidden="true"></strong>
    `;
    button.addEventListener("click", () => launchUrl(target.url, { fallback: false }));
    favoritesModalList.append(button);
  });
  favoritesModal.hidden = false;
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea fallback below.
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.append(textArea);
  textArea.focus();
  textArea.select();

  try {
    return document.execCommand("copy");
  } finally {
    textArea.remove();
  }
}

async function copyUrl(url, button) {
  const copied = await copyText(url);
  const original = button.textContent;
  button.textContent = copied ? "Copied" : "Copy failed";
  setTimeout(() => {
    button.textContent = original;
  }, 1200);
  return copied;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(status, detail) {
  syncStatus.textContent = status;
  if (detail) syncMeta.textContent = detail;
}

function normalizeTimestamp(timestamp) { return DashboardProfile.timestamp(timestamp); }

function formatTime(timestamp) { return DashboardProfile.describe(timestamp); }

function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds)) return "Unknown";
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function parseWikiDate(dateText, options = {}) {
  if (!dateText) return null;
  const hourUtc = options.hourUtc ?? 0;
  const minuteUtc = options.minuteUtc ?? 0;
  const cleaned = dateText
    .replace(/(\d+)(st|nd|rd|th)/i, "$1")
    .replace(",", "")
    .trim();
  const dayFirst = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const monthFirst = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/);
  const match = dayFirst || monthFirst;
  if (!match) return null;
  const months = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11
  };
  const month = months[(dayFirst ? match[2] : match[1]).toLowerCase()];
  if (month === undefined) return null;
  const day = Number(dayFirst ? match[1] : match[2]);
  const year = Number(match[3]);
  return new Date(Date.UTC(year, month, day, hourUtc, minuteUtc, 0));
}

function getWeeklyTarget(dateText) {
  const target = parseWikiDate(dateText, { hourUtc: 16 });
  if (!target) return null;
  while (target.getTime() <= Date.now()) {
    target.setUTCDate(target.getUTCDate() + 7);
  }
  return target.toISOString();
}

function formatWeeklyResetLabel(target, fallback) {
  if (!target) return fallback || "";
  return `${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(target))} 00:00 UTC`;
}

function titleCaseWikiName(name) {
  return name
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bUi\b/g, "UI")
    .replace(/\bIi\b/g, "II")
    .replace(/\bIii\b/g, "III")
    .replace(/\bIv\b/g, "IV");
}

function renderIconLinks(container, links) {
  container.innerHTML = "";
  links.forEach((link) => {
    const anchor = document.createElement(link.popup ? "button" : "a");
    anchor.className = "icon-link";
    if (link.blank) anchor.classList.add("blank-icon");
    if (link.url) {
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
    if (link.popup) anchor.type = "button";
    anchor.title = link.name;
    anchor.innerHTML = link.blank ? `<span class="sr-only">${escapeHtml(link.name)}</span>` : `<img src="${wikiAsset(link.icon)}" alt="${escapeHtml(link.name)}">`;
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      if (link.popup === "rip") {
        ripModal.hidden = false;
      } else if (link.url) {
        launchUrl(link.url);
      }
    });
    container.append(anchor);
  });
}

function renderItemList(items = []) {
  if (!items.length) return "";
  return `
    <ul class="mini-list">
      ${items.map(([name, icon]) => `
        <li>
          <img src="${wikiAsset(icon)}" alt="">
          <span>${name}</span>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderPublicRotations() {
  syncLocalWeeklyRotations();
  const sourceLabel = document.querySelector("#intelSourceStatus");
  const resolved = resolveIntelSource();
  if (sourceLabel) sourceLabel.textContent = resolved.payload ? `Public schedules • ${getIntelSourceLabel()}${resolved.payload.username ? ` (${resolved.payload.username})` : ""} • ${formatTime(resolved.payload.lastUpdated)}` : "Public schedules • No profile loaded";
  rotationGrid.querySelectorAll(".rotation-card").forEach((card) => card.remove());
  publicRotations.filter((rotation) => !rotation.hiddenFromIntel).forEach((rotation) => {
    const activeTarget = rotation.nextDate ? getWeeklyTarget(rotation.nextDate) : rotation.target;
    const target = activeTarget ? new Date(activeTarget).getTime() : null;
    const remaining = target ? (target - Date.now()) / 1000 : null;
    const featuredTime = rotation.showCountdown === false ? "" : rotation.timeText || (remaining === null ? "" : formatDuration(remaining));
    const weeklyResetTarget = rotation.weeklyResetTarget || (rotation.weeklyResetDate ? getWeeklyTarget(rotation.weeklyResetDate) : null);
    const weeklyResetTime = weeklyResetTarget ? formatDuration((new Date(weeklyResetTarget).getTime() - Date.now()) / 1000) : "";
    const weeklyResetLabel = formatWeeklyResetLabel(weeklyResetTarget, rotation.weeklyResetDate);
    const quickEvents = rotation.id === "quick-events" ? `
      <div class="event-stack">
        <div>
          <span>Random Event</span>
          <strong>${rotation.eventName}</strong>
          <small>${rotation.eventMap}${rotation.eventWorld ? ` (${rotation.eventWorld})` : ""} • ${rotation.eventTime}</small>
        </div>
        <div>
          <span>Dungeon Happy Hour</span>
          <strong>Next Happy Hour</strong>
          <small>${rotation.happyTime}</small>
        </div>
        <div>
          <span class="event-row-title">Daily Tournaments <em>${rotation.dailyTournamentUtc || "20:00 UTC"}</em></span>
          <strong class="daily-tournament-countdown">${rotation.dailyTournamentTarget ? formatDuration((new Date(rotation.dailyTournamentTarget).getTime() - Date.now()) / 1000) : rotation.dailyTournamentValue || "Check Profile First"}</strong>
          <small class="daily-tournament-detail">${rotation.dailyTournamentDetail || formatDailyTournamentLabel()}</small>
        </div>
        <div>
          <span>Weekly Server Reset</span>
          <strong class="weekly-reset-countdown">${weeklyResetTime}</strong>
          <small>${weeklyResetLabel}</small>
        </div>
      </div>
    ` : "";
    const card = document.createElement("article");
    card.className = "rotation-card";
    card.classList.add(`rotation-${rotation.id}`);
    card.innerHTML = `
      <div class="rotation-top">
        <img src="${wikiAsset(rotation.icon)}" alt="">
        <div>
          <p class="category">${rotation.title}</p>
          ${rotation.id === "quick-events" ? "" : `<h3>${rotation.value}</h3>`}
        </div>
      </div>
      ${quickEvents || (featuredTime ? `<div class="countdown" data-countdown-card="${rotation.id}">${featuredTime}</div>` : "")}
      ${rotation.showDetail === false ? "" : `<p class="rotation-detail">${rotation.detail || ""}</p>`}
      ${renderItemList(rotation.items)}
    `;
    setupCustomCard(card, "intel", rotation.id);
    if (rotation.url) {
      card.classList.add("clickable-card");
      card.addEventListener("click", () => launchUrl(rotation.url));
    }
    const firstUtility = rotationGrid.querySelector(".utility-card");
    rotationGrid.insertBefore(card, firstUtility);
  });
  rotationGrid.querySelectorAll(".utility-card").forEach((card) => {
    setupCustomCard(card, "intel", card.dataset.cardId);
  });
  applySectionLayout("intel");
}

function updatePublicRotationTimers() {
  const minute = Math.floor(Date.now() / 60000);
  if (minute !== lastIntelMinute) { lastIntelMinute = minute; renderPublicRotations(); }
  publicRotations.forEach((rotation) => {
    if (rotation.id === "quick-events") {
      const weeklyResetTarget = rotation.weeklyResetTarget || (rotation.weeklyResetDate ? getWeeklyTarget(rotation.weeklyResetDate) : null);
      const weeklyCountdown = rotationGrid.querySelector(".rotation-quick-events .weekly-reset-countdown");
      if (weeklyCountdown && weeklyResetTarget) {
        weeklyCountdown.textContent = formatDuration((new Date(weeklyResetTarget).getTime() - Date.now()) / 1000);
      }
      const dailyTournamentCountdown = rotationGrid.querySelector(".rotation-quick-events .daily-tournament-countdown");
      if (rotation.dailyTournamentTarget && new Date(rotation.dailyTournamentTarget).getTime() <= Date.now()) {
        rotation.dailyTournamentTarget = nextDailyTournamentTarget();
        rotation.dailyTournamentDetail = formatDailyTournamentLabel();
      }
      if (dailyTournamentCountdown && rotation.dailyTournamentTarget) {
        dailyTournamentCountdown.textContent = formatDuration((new Date(rotation.dailyTournamentTarget).getTime() - Date.now()) / 1000);
      }
      const dailyTournamentDetail = rotationGrid.querySelector(".rotation-quick-events .daily-tournament-detail");
      if (dailyTournamentDetail) dailyTournamentDetail.textContent = rotation.dailyTournamentDetail || formatDailyTournamentLabel();
      return;
    }

    if (rotation.showCountdown === false) return;
    const activeTarget = rotation.nextDate ? getWeeklyTarget(rotation.nextDate) : rotation.target;
    const countdown = rotationGrid.querySelector(`[data-countdown-card="${rotation.id}"]`);
    if (countdown && activeTarget) {
      countdown.textContent = rotation.timeText || formatDuration((new Date(activeTarget).getTime() - Date.now()) / 1000);
    }
  });
}

function updateFastWikiTimersFromText(text, doc) {
  const random = text.match(/Random Event\s+(.+?)\s+\((.+?)\)\s+(\d{2} [A-Za-z]+, \d{4} \d{2}:\d{2}:\d{2} \(UTC\))/);
  const happy = text.match(/Next Dungeon Happy Hour\s+(\d{2} [A-Za-z]+, \d{4} \d{2}:\d{2}:\d{2} \(UTC\))/);
  const weekly = text.match(/Weekly Battle\s+(.+?)\s+(?:Hardwood UI|Catacomb UI|Killroy Skulls|The Crow Perch).*?Next Weekly Boss\s+(.+?)\s+\((\d{1,2}\s+[A-Za-z]+,\s+\d{4})\)/);
  const lab = text.match(/Lab Rotation\s+(.+?)\s+Slot 1:\s+(.+?)\s+Slot 2:\s+(.+?)\s+Slot 3:\s+(.+?)\s+Next Rotation\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,\s+\d{4})/);
  const exotic = text.match(/Exotic Market\s+Current Week:\s+(.+?\d{4})\s+(.+?)\s+Next Week\s+(\d{1,2}\s+[A-Za-z]+,\s+\d{4})/);
  const card = publicRotations.find((rotation) => rotation.id === "quick-events");
  const weeklyCard = publicRotations.find((rotation) => rotation.id === "weekly-battle");
  const labCard = publicRotations.find((rotation) => rotation.id === "lab-rotation");
  const exoticCard = publicRotations.find((rotation) => rotation.id === "exotic-market");
  const eventImage = doc ? [...doc.querySelectorAll("img[alt]")].find((img) => /^(Meteorite|Mega Grumblo|Glacial Guild|Snake Swarm|Angry Frogs)$/.test(img.alt)) : null;

  if (random && card) {
    if (eventImage?.alt) card.eventName = eventImage.alt;
    card.eventMap = random[1].trim();
    card.eventWorld = random[2].replace(/&nbsp;|\u00a0/g, " ").trim();
    card.eventTime = random[3];
    card.value = card.eventName;
  }

  if (happy && card) {
    card.happyTime = happy[1];
  }

  if (weekly && weeklyCard) {
    weeklyCard.value = weekly[1].trim();
    weeklyCard.detail = `Next: ${weekly[2].trim()}`;
    weeklyCard.nextDate = weekly[3].trim();
    if (card) card.weeklyResetDate = weekly[3].trim();
  }

  if (lab && labCard) {
    labCard.value = lab[1].trim();
    labCard.detail = "";
    labCard.nextDate = lab[5].trim();
    if (card) card.weeklyResetDate = lab[5].trim();
    const slotItems = [lab[2], lab[3], lab[4]]
      .map((item) => item.trim())
      .join(" ")
      .match(/Conductive Nanochip|Galvanic Motherboard|Omega Motherboard|Pyrite Pyramite/g);
    if (slotItems?.length) {
      const existingIcons = new Map(labCard.items.map(([name, icon]) => [name, icon]));
      labCard.items = slotItems.map((name) => [name, existingIcons.get(name) || ""]);
    }
  }

  if (exotic && exoticCard) {
    exoticCard.value = "Current Week";
    exoticCard.detail = "";
    exoticCard.nextDate = exotic[3].trim();
    if (card) card.weeklyResetDate = exotic[3].trim();
    const names = exotic[2].match(/EXALTED ELDOU|5 LEAF CLOVER|GENEOLOGY [IVX]+|BETTER DAY [IVX]+|LARGUMES [IVX]+|BRIAR PATCH|EVERGROW [IVX]+|SPROUTLUCK [IVX]+/g);
    if (names?.length) {
      const existingIcons = new Map(exoticCard.items.map(([name, icon]) => [name.toLowerCase(), icon]));
      exoticCard.items = names.map((name) => {
        const titled = titleCaseWikiName(name);
        return [titled, existingIcons.get(titled.toLowerCase()) || ""];
      });
    }
  }
}



function persistToolboxPayload(payload) {
  const saved = storage.setItem(rawPayloadKey, JSON.stringify(payload));
  // Keep legacy session data recoverable. The current local/tab cache takes precedence.
  return saved;
}

function getSavedPayload() {
  const saved = DashboardProfile.parse(storage.getItem(rawPayloadKey));
  if (saved) return saved;
  try { return DashboardProfile.parse(sessionStorage.getItem(rawPayloadKey)); } catch { return null; }
}

function getManualJson() {
  return storage.getItem(manualJsonKey) || "";
}

function setManualJsonStatus() {
  const saved = getManualJson();
  const source = getIntelSourceLabel();
  manualJsonStatus.textContent = saved
    ? source === "Manual JSON" ? "Intel" : "Saved"
    : "Empty";
  if (useManualJsonForIntel) {
    useManualJsonForIntel.textContent = source === "Manual JSON" ? "Using Manual For Intel" : "Use Manual JSON For Intel";
  }
}

function getSavedAccountLink() {
  return storage.getItem(accountLinkKey) || "";
}

function getSavedLinks() {
  const records = readRecords(savedLinksKey);
  const normalized = records.map((link, index) => normalizeSavedLink(link, index));
  const presetLinks = defaultSavedLinks.map((preset) => {
    const saved = records.find((link) => link.id === preset.id);
    return normalizeSavedLink(saved ? { ...preset, ...saved, id: preset.id, preset: true } : preset);
  });
  // Identity is the ID. A matching name or URL never makes a personal link disposable.
  return [...presetLinks, ...normalized.filter((link) => !defaultSavedLinks.some((preset) => link.id === preset.id))];
}

function setSavedLinks(links) {
  storage.setItem(savedLinksKey, JSON.stringify(links));
}

function normalizeSavedLink(link, index = 0) {
  const name = typeof link.name === "string" ? link.name : "Saved Link";
  const preset = Boolean(link.preset || link.type === "sheet" || link.type === "doc");
  const personalUrl = typeof link.personalUrl === "string" ? link.personalUrl : "";
  return { ...link,
    id: typeof link.id === "string" && link.id ? link.id : legacyId("link", link, index),
    name, url: typeof link.url === "string" ? link.url : "", personalUrl,
    type: link.type || (preset ? "sheet" : "manual"), preset,
    hiddenPreset: Boolean(link.hiddenPreset), group: link.group || (preset ? "current" : "custom"),
    note: typeof link.note === "string" ? link.note : "",
    showInSavedPanel: Boolean(link.showInSavedPanel), showInTools: Boolean(link.showInTools),
    inControls: link.inControls === undefined ? (preset ? Boolean(personalUrl) : true) : Boolean(link.inControls),
    favorite: Boolean(link.favorite),
    iconText: typeof link.iconText === "string" ? link.iconText : name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3) || "L",
    iconColor: typeof link.iconColor === "string" ? link.iconColor : "#36506a" };
}

function saveSavedLinks(links) {
  setSavedLinks(links);
  renderSavedLinks();
  renderSavedLinksManager();
  renderQuickList();
  renderCards();
  applySectionLayout("tools");
}

function savedLinkTarget(link) {
  return link.personalUrl || link.url;
}

function savedLinkCardId(link) {
  return `saved-link-${link.id}`;
}

function savedLinkGroupLabel(group) {
  const labels = {
    current: "Community Sheets",
    outdated: "Outdated But Useful",
    custom: "Custom Links"
  };
  return labels[group] || "Other Resources";
}

function savedLinkKindLabel(link) {
  if (!link.preset) return "Custom";
  if (link.type === "doc") return "Doc";
  if (link.type === "guide") return "Guide";
  return "Sheet";
}

function getSavedPanelLinkIds(links = getSavedLinks()) {
  const visibleLinks = links.filter((link) => !link.hiddenPreset);
  const chosenLinks = visibleLinks.filter((link) => link.showInSavedPanel);
  const sidebarLinks = (chosenLinks.length ? chosenLinks : visibleLinks.slice(0, 2)).slice(0, 4);
  return new Set(sidebarLinks.map((link) => link.id));
}

function getChecklistSettings() {
  const settings = storage.readJSON(checklistSettingsKey, {}, isRecord);
  if (settings.idleonResetTime !== undefined && settings.idleonResetTime !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.idleonResetTime)) storage.protect(checklistSettingsKey);
  return { ...settings, idleonResetTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(settings.idleonResetTime || "") ? settings.idleonResetTime : "00:00" };
}

function setChecklistSettings(settings) {
  storage.setItem(checklistSettingsKey, JSON.stringify(settings));
}

function getChecklistItems() {
  const items = storage.getItem(checklistItemsKey) === null ? defaultChecklistItems : readRecords(checklistItemsKey);
  return items.map((item, index) => ({ ...item,
    id: typeof item.id === "string" && item.id ? item.id : legacyId("task", item, index),
    text: typeof item.text === "string" ? item.text : "",
    type: ["current", "daily", "weekly"].includes(item.type) ? item.type : "daily", done: Boolean(item.done) }));
}

function setChecklistItems(items) {
  storage.setItem(checklistItemsKey, JSON.stringify(items));
}

function getChecklistState() {
  const saved = storage.readJSON(checklistStateKey, {}, isRecord);
  if (["checked", "dailyChecked", "weeklyChecked"].some((key) => saved[key] !== undefined && !isRecord(saved[key]))) storage.protect(checklistStateKey);
  return { ...saved,
    dailyChecked: isRecord(saved.dailyChecked) ? saved.dailyChecked : undefined,
    weeklyChecked: isRecord(saved.weeklyChecked) ? saved.weeklyChecked : undefined,
    checked: isRecord(saved.checked) ? saved.checked : undefined };
}

function setChecklistState(stateValue) {
  storage.setItem(checklistStateKey, JSON.stringify(stateValue));
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getChecklistResetKey() {
  const settings = getChecklistSettings();
  const [hours = 0, minutes = 0] = (settings.idleonResetTime || "00:00").split(":").map(Number);
  const resetDate = new Date();
  resetDate.setHours(hours, minutes, 0, 0);
  const now = new Date();
  if (now < resetDate) resetDate.setDate(resetDate.getDate() - 1);
  return `daily-${localDateKey(resetDate)}-${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getNextChecklistResetDate() {
  const settings = getChecklistSettings();
  const [hours = 0, minutes = 0] = (settings.idleonResetTime || "00:00").split(":").map(Number);
  const resetDate = new Date();
  resetDate.setHours(hours, minutes, 0, 0);
  if (new Date() >= resetDate) resetDate.setDate(resetDate.getDate() + 1);
  return resetDate;
}

function updateChecklistCountdown() {
  if (!checklistStatus) return;
  const seconds = (getNextChecklistResetDate().getTime() - Date.now()) / 1000;
  checklistStatus.textContent = `Daily reset ${formatDuration(seconds)}`;
}

function getWeeklyChecklistResetKey() {
  return `weekly-${currentWikiWeek()}`;
}

function getActiveChecklistState() {
  const dailyKey = getChecklistResetKey();
  const weeklyKey = getWeeklyChecklistResetKey();
  const stateValue = getChecklistState();
  const nextState = {
    ...stateValue,
    dailyKey,
    weeklyKey,
    dailyChecked: stateValue.dailyKey === dailyKey ? (stateValue.dailyChecked || stateValue.checked || {}) : {},
    weeklyChecked: stateValue.weeklyKey === weeklyKey ? (stateValue.weeklyChecked || {}) : {}
  };
  if (
    stateValue.dailyKey !== nextState.dailyKey ||
    stateValue.weeklyKey !== nextState.weeklyKey ||
    !stateValue.dailyChecked ||
    !stateValue.weeklyChecked
  ) {
    setChecklistState(nextState);
  }
  return nextState;
}

function getChecklistResetSignature() {
  return `${getChecklistResetKey()}|${getWeeklyChecklistResetKey()}`;
}

let checklistResetSignature = "";

function formatRate(value) {
  if (!Number.isFinite(value)) return "0";
  const absValue = Math.abs(value);
  const compactUnits = [
    ["Q", 1_000_000_000_000_000],
    ["T", 1_000_000_000_000],
    ["B", 1_000_000_000],
    ["M", 1_000_000]
  ];

  if (absValue >= 1_000_000_000_000_000_000) {
    return value.toExponential(3).replace("e+", "E").replace("e", "E");
  }

  const unit = compactUnits.find(([, amount]) => absValue >= amount);
  if (unit) {
    const [suffix, amount] = unit;
    return `${formatCompactNumber(value / amount)}${suffix}`;
  }

  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value < 10 ? 3 : value < 100 ? 2 : 1
  }).format(value).replace(/\.0$/, "");
}

function parseRateValue(value) {
  const match = String(value).trim().replace(/,/g, "").match(/^((?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)\s*([mMbBtTqQ])?$/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  const suffixes = {
    m: 1_000_000,
    b: 1_000_000_000,
    t: 1_000_000_000_000,
    q: 1_000_000_000_000_000
  };
  const multiplier = suffixes[match[2]?.toLowerCase()] || 1;
  return Number.isFinite(amount) ? amount * multiplier : 0;
}

function renderRateCalculator() {
  const value = parseRateValue(rateValue.value);
  const secondsByUnit = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800 };
  const sourceSeconds = secondsByUnit[rateUnit.value] || 60;
  const perSecond = Number.isFinite(value) && value > 0 ? value / sourceSeconds : 0;
  const rows = [
    ["Second", perSecond],
    ["Minute", perSecond * 60],
    ["Hour", perSecond * 3600],
    ["Day", perSecond * 86400],
    ["Week", perSecond * 604800]
  ];

  rateResults.innerHTML = rows.map(([label, result]) => `
    <div>
      <span>${label}</span>
      <strong>${formatRate(result)}</strong>
    </div>
  `).join("");
}

function renderChecklist() {
  if (!idleonResetTime || !checklistList) return;
  const settings = getChecklistSettings();
  idleonResetTime.value = settings.idleonResetTime || "00:00";

  const items = getChecklistItems();
  const stateValue = getActiveChecklistState();
  checklistResetSignature = getChecklistResetSignature();
  updateChecklistCountdown();
  checklistList.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "saved-links-empty";
    empty.textContent = "Add goals, daily tasks, or weekly tasks here.";
    checklistList.append(empty);
    return;
  }

  const groups = [
    {
      id: "current",
      title: "Current Goals",
      items: items.filter((item) => item.type === "current" && !item.done)
    },
    {
      id: "daily",
      title: "Daily",
      items: items.filter((item) => item.type === "daily")
    },
    {
      id: "weekly",
      title: "Weekly",
      items: items.filter((item) => item.type === "weekly")
    },
    {
      id: "finished",
      title: "Finished Goals",
      items: items.filter((item) => item.type === "current" && item.done)
    }
  ];

  groups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "checklist-group";
    section.innerHTML = `
      <div class="checklist-group-heading">
        <h3>${group.title}</h3>
        ${group.id === "finished" && group.items.length ? `<button type="button">Delete Finished</button>` : ""}
      </div>
    `;
    if (group.id === "finished") {
      section.querySelector("button")?.addEventListener("click", () => {
        setChecklistItems(getChecklistItems().filter((item) => !(item.type === "current" && item.done)));
        renderChecklist();
      });
    }

    if (!group.items.length) {
      const empty = document.createElement("p");
      empty.className = "saved-links-empty";
      empty.textContent = group.id === "finished" ? "No finished goals yet." : "Nothing here yet.";
      section.append(empty);
      checklistList.append(section);
      return;
    }

    group.items.forEach((item) => {
      const checked = item.type === "current"
        ? item.done
        : item.type === "weekly"
          ? Boolean(stateValue.weeklyChecked[item.id])
          : Boolean(stateValue.dailyChecked[item.id]);
    const row = document.createElement("div");
    row.className = "checklist-item";
    row.innerHTML = `
      <label>
        <input type="checkbox" ${checked ? "checked" : ""}>
        <span>${escapeHtml(item.text)}</span>
      </label>
      <button type="button" title="${group.id === "finished" ? "Move this goal back to Current Goals." : "Remove this checklist item."}">${group.id === "finished" ? "Restore" : "Remove"}</button>
    `;
    row.querySelector("input").addEventListener("change", (event) => {
      if (item.type === "current") {
        const nextItems = getChecklistItems().map((savedItem) => (
          savedItem.id === item.id ? { ...savedItem, done: event.target.checked } : savedItem
        ));
        setChecklistItems(nextItems);
      } else {
        const nextState = getActiveChecklistState();
        const bucket = item.type === "weekly" ? nextState.weeklyChecked : nextState.dailyChecked;
        bucket[item.id] = event.target.checked;
        setChecklistState(nextState);
      }
      renderChecklist();
    });
    row.querySelector("button").addEventListener("click", () => {
      if (group.id === "finished") {
        setChecklistItems(getChecklistItems().map((savedItem) => (
          savedItem.id === item.id ? { ...savedItem, done: false } : savedItem
        )));
      } else {
        setChecklistItems(getChecklistItems().filter((savedItem) => savedItem.id !== item.id));
        const nextState = getActiveChecklistState();
        delete nextState.dailyChecked[item.id];
        delete nextState.weeklyChecked[item.id];
        setChecklistState(nextState);
      }
      renderChecklist();
    });
      section.append(row);
    });
    checklistList.append(section);
  });
}

function refreshChecklistIfResetChanged() {
  updateChecklistCountdown();
  const nextSignature = getChecklistResetSignature();
  if (nextSignature !== checklistResetSignature) {
    renderChecklist();
  }
}

function renderSavedLinks() {
  const links = getSavedLinks();
  const visibleLinks = links.filter((link) => !link.hiddenPreset);
  const savedPanelIds = getSavedPanelLinkIds(links);
  const sidebarLinks = links.filter((link) => savedPanelIds.has(link.id));
  savedLinks.innerHTML = "";

  if (visibleLinks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "saved-links-empty";
    empty.textContent = "Add spreadsheets, docs, or extra Idleon sites here.";
    savedLinks.append(empty);
    return;
  }

  sidebarLinks.forEach((link) => {
    const index = links.findIndex((savedLink) => savedLink.id === link.id);
    const row = document.createElement("div");
    row.className = "saved-link";
    row.classList.toggle("is-in-controls", link.inControls);
    const isPreset = link.preset;
    row.innerHTML = `
      <div class="saved-link-main">
        <strong>${escapeHtml(link.name)}</strong>
      </div>
      <div class="saved-link-actions ${isPreset ? "" : "saved-link-actions-single"}">
        ${isPreset ? `<a class="saved-link-open-original" href="${escapeHtml(safeWebUrl(link.url))}" target="_blank" rel="noopener noreferrer" title="Open the original ${escapeHtml(link.name)} resource.">Original</a>` : `<a class="saved-link-open-custom" href="${escapeHtml(safeWebUrl(savedLinkTarget(link)))}" target="_blank" rel="noopener noreferrer" title="Open ${escapeHtml(link.name)}.">Open</a>`}
      </div>
      ${isPreset ? `
        <label class="saved-link-copy-field">
          <input class="saved-link-personal-url" type="url" value="${escapeHtml(link.personalUrl)}" placeholder="Paste your copied sheet link" title="Paste your personal copy of ${escapeHtml(link.name)} here.">
        </label>
      ` : ""}
    `;
    row.querySelector(".saved-link-open-original")?.addEventListener("click", (event) => {
      event.preventDefault();
      launchUrl(link.url);
    });
    row.querySelector(".saved-link-open-custom")?.addEventListener("click", (event) => {
      event.preventDefault();
      launchUrl(savedLinkTarget(link));
    });
    row.querySelector(".saved-link-personal-url")?.addEventListener("change", (event) => {
      const nextLinks = getSavedLinks();
      const nextIndex = nextLinks.findIndex((savedLink) => savedLink.id === link.id);
      if (nextIndex < 0) return;
      let personalUrl;
      try { personalUrl = event.target.value.trim() ? requireWebUrl(event.target.value.trim()) : ""; }
      catch { event.target.value = link.personalUrl; return; }
      nextLinks[nextIndex] = {
        ...nextLinks[nextIndex],
        personalUrl,
        hiddenPreset: false,
        inControls: Boolean(personalUrl)
      };
      saveSavedLinks(nextLinks);
      render();
    });
    row.querySelector(".saved-link-remove")?.addEventListener("click", () => {
      const button = row.querySelector(".saved-link-remove");
      if (button.dataset.confirm !== "true") {
        button.dataset.confirm = "true";
        button.textContent = "Confirm";
        setTimeout(() => {
          button.dataset.confirm = "false";
          button.textContent = "Remove";
        }, 3500);
        return;
      }

      const nextLinks = getSavedLinks();
      const nextIndex = nextLinks.findIndex((savedLink) => savedLink.id === link.id);
      if (nextIndex < 0) return;
      if (isPreset) {
        nextLinks[nextIndex] = {
          ...nextLinks[nextIndex],
          hiddenPreset: true
        };
      } else {
        nextLinks.splice(nextIndex, 1);
      }
      saveSavedLinks(nextLinks);
      render();
    });
    savedLinks.append(row);
  });

  if (visibleLinks.length > sidebarLinks.length) {
    const more = document.createElement("button");
    more.className = "saved-links-more";
    more.type = "button";
    more.textContent = `Manage ${visibleLinks.length} resources`;
    more.addEventListener("click", () => {
      renderSavedLinksManager();
      savedLinksModal.hidden = false;
    });
    savedLinks.append(more);
  }
}

function renderSavedLinksManager() {
  if (!savedLinksManagerList) return;
  const links = getSavedLinks();
  const savedPanelIds = getSavedPanelLinkIds(links);
  savedLinksManagerList.innerHTML = "";
  let currentGroup = "";

  links.forEach((link, index) => {
    const group = link.preset ? link.group : "custom";
    if (group !== currentGroup) {
      currentGroup = group;
      const heading = document.createElement("h3");
      heading.className = "saved-manager-group";
      heading.textContent = savedLinkGroupLabel(group);
      savedLinksManagerList.append(heading);
    }

    const row = document.createElement("div");
    const visibleInSavedPanel = savedPanelIds.has(link.id);
    const sideButtonText = link.showInSavedPanel ? "Unpin Side" : visibleInSavedPanel ? "Keep Side" : "Show Side";
    row.className = "saved-manager-item";
    row.classList.toggle("is-preset-resource", link.preset);
    row.classList.toggle("is-hidden-preset", link.hiddenPreset);
    row.innerHTML = `
      <div class="saved-manager-title">
        <strong>${escapeHtml(link.name)}</strong>
        <small>${escapeHtml([savedLinkKindLabel(link), link.hiddenPreset ? "hidden" : "", link.note].filter(Boolean).join(" - "))}</small>
      </div>
      ${link.preset ? `
        <div class="saved-manager-actions">
          <a class="saved-manager-open" href="${escapeHtml(safeWebUrl(link.url))}" target="_blank" rel="noopener noreferrer" title="Open the original ${escapeHtml(link.name)} resource.">Original</a>
          <button class="saved-manager-restore" type="button" title="${link.hiddenPreset ? "Restore this built-in resource." : "Clear your copy and reset this resource."}">${link.hiddenPreset ? "Restore" : "Clear Copy"}</button>
          <button class="saved-manager-sidebar" type="button" title="${link.showInSavedPanel ? "Remove this resource from the sidebar preview." : "Show this resource in the sidebar preview."}">${sideButtonText}</button>
          <button class="saved-manager-remove" type="button" title="Hide this built-in resource from saved links.">Hide</button>
        </div>
        <label class="saved-manager-copy">
          <span>Your copy</span>
          <input class="saved-manager-personal-url" type="url" value="${escapeHtml(link.personalUrl)}" placeholder="Paste your copied sheet link">
        </label>
      ` : `
        <input class="saved-manager-name" type="text" value="${escapeHtml(link.name)}" aria-label="Custom link name">
        <input class="saved-manager-url" type="url" value="${escapeHtml(safeWebUrl(link.url))}" aria-label="Custom link URL">
        <div class="saved-manager-actions">
          <a class="saved-manager-open" href="${escapeHtml(safeWebUrl(link.url))}" target="_blank" rel="noopener noreferrer" title="Open ${escapeHtml(link.name)}.">Open</a>
          <button class="saved-manager-sidebar" type="button" title="${link.showInSavedPanel ? "Remove this link from the sidebar preview." : "Show this link in the sidebar preview."}">${sideButtonText}</button>
          <button class="saved-manager-remove" type="button" title="Remove this custom link.">Remove</button>
        </div>
      `}
      <div class="saved-manager-icon-editor">
        <label>
          <span>Icon</span>
          <input class="saved-manager-icon-text" type="text" maxlength="3" value="${escapeHtml(link.iconText)}" placeholder="ABC">
        </label>
        <label>
          <span>Color</span>
          <input class="saved-manager-icon-color" type="color" value="${escapeHtml(link.iconColor)}">
        </label>
      </div>
    `;
    row.querySelector(".saved-manager-open")?.addEventListener("click", (event) => {
      event.preventDefault();
      launchUrl(link.url);
    });
    row.querySelector(".saved-manager-sidebar")?.addEventListener("click", () => {
      const nextLinks = getSavedLinks();
      const nextIndex = nextLinks.findIndex((savedLink) => savedLink.id === link.id);
      if (nextIndex < 0) return;
      const nextPanelIds = getSavedPanelLinkIds(nextLinks);
      const isVisible = nextPanelIds.has(nextLinks[nextIndex].id);
      nextLinks[nextIndex] = {
        ...nextLinks[nextIndex],
        hiddenPreset: false,
        showInSavedPanel: !isVisible
      };
      saveSavedLinks(nextLinks);
      render();
    });
    row.querySelector(".saved-manager-restore")?.addEventListener("click", () => {
      const nextLinks = getSavedLinks();
      const nextIndex = nextLinks.findIndex((savedLink) => savedLink.id === link.id);
      if (nextIndex < 0) return;
      nextLinks[nextIndex] = {
        ...nextLinks[nextIndex],
        hiddenPreset: false,
        ...(link.hiddenPreset ? {} : { personalUrl: "", inControls: false })
      };
      saveSavedLinks(nextLinks);
      render();
    });
    row.querySelector(".saved-manager-personal-url")?.addEventListener("change", (event) => {
      const nextLinks = getSavedLinks();
      const nextIndex = nextLinks.findIndex((savedLink) => savedLink.id === link.id);
      if (nextIndex < 0) return;
      let personalUrl;
      try { personalUrl = event.target.value.trim() ? requireWebUrl(event.target.value.trim()) : ""; }
      catch { event.target.value = link.personalUrl; return; }
      nextLinks[nextIndex] = {
        ...nextLinks[nextIndex],
        personalUrl,
        hiddenPreset: false,
        inControls: Boolean(personalUrl)
      };
      saveSavedLinks(nextLinks);
      render();
    });
    row.querySelector(".saved-manager-name")?.addEventListener("change", (event) => {
      const nextLinks = getSavedLinks();
      const nextIndex = nextLinks.findIndex((savedLink) => savedLink.id === link.id);
      if (nextIndex < 0) return;
      nextLinks[nextIndex] = { ...nextLinks[nextIndex], name: event.target.value.trim() || nextLinks[nextIndex].name };
      saveSavedLinks(nextLinks);
      render();
    });
    row.querySelector(".saved-manager-url")?.addEventListener("change", (event) => {
      try {
        const nextUrl = requireWebUrl(event.target.value.trim());
        const nextLinks = getSavedLinks();
      const nextIndex = nextLinks.findIndex((savedLink) => savedLink.id === link.id);
      if (nextIndex < 0) return;
        nextLinks[nextIndex] = { ...nextLinks[nextIndex], url: nextUrl };
        saveSavedLinks(nextLinks);
        render();
      } catch {
        event.target.value = link.url;
      }
    });
    row.querySelector(".saved-manager-icon-text").addEventListener("change", (event) => {
      const nextLinks = getSavedLinks();
      const nextIndex = nextLinks.findIndex((savedLink) => savedLink.id === link.id);
      if (nextIndex < 0) return;
      nextLinks[nextIndex] = {
        ...nextLinks[nextIndex],
        iconText: event.target.value.trim().slice(0, 3) || nextLinks[nextIndex].iconText
      };
      saveSavedLinks(nextLinks);
      render();
    });
    row.querySelector(".saved-manager-icon-color").addEventListener("change", (event) => {
      const nextLinks = getSavedLinks();
      const nextIndex = nextLinks.findIndex((savedLink) => savedLink.id === link.id);
      if (nextIndex < 0) return;
      nextLinks[nextIndex] = { ...nextLinks[nextIndex], iconColor: event.target.value };
      saveSavedLinks(nextLinks);
      render();
    });
    row.querySelector(".saved-manager-remove").addEventListener("click", () => {
      const button = row.querySelector(".saved-manager-remove");
      if (button.dataset.confirm !== "true") {
        button.dataset.confirm = "true";
        button.textContent = "Confirm";
        setTimeout(() => {
          button.dataset.confirm = "false";
          button.textContent = link.preset ? "Hide" : "Remove";
        }, 3500);
        return;
      }

      const nextLinks = getSavedLinks();
      const nextIndex = nextLinks.findIndex((savedLink) => savedLink.id === link.id);
      if (nextIndex < 0) return;
      if (link.preset) {
        nextLinks[nextIndex] = {
          ...nextLinks[nextIndex],
          hiddenPreset: true
        };
      } else {
        nextLinks.splice(nextIndex, 1);
      }
      saveSavedLinks(nextLinks);
      render();
    });
    savedLinksManagerList.append(row);
  });
}

function getProfilePayloadForCopy(payload) {
  if (!payload) return null;
  return {
    data: payload.data || {},
    charNames: payload.charNames || [],
    companion: payload.companion || null,
    guildData: payload.guildData || null,
    tournament: payload.tournament || null,
    serverVars: payload.serverVars || {},
    parsedData: payload.parsedData || null,
    accountCreateTime: payload.accountCreateTime || null,
    lastUpdated: payload.lastUpdated || null
  };
}

function getUsername() {
  return toolboxUsername.value.trim();
}

function getProfileLink(username = getUsername()) {
  return username ? `${toolboxBaseUrl}?profile=${encodeURIComponent(username)}` : "";
}

function syncProfileLink() {
  const username = getUsername();
  const link = getProfileLink(username);
  accountLink.value = link;
  storage.setItem(usernameKey, username);
  storage.setItem(accountLinkKey, link);
  return { username, link };
}

async function copyAccountLinkField() {
  const { link } = syncProfileLink();
  const value = link || accountLink.value.trim() || getSavedAccountLink();
  if (!value) {
    setStatus("No Link", "Enter a Toolbox username first.");
    return;
  }
  const copied = await copyText(value);
  setStatus(copied ? "Copied Link" : "Copy Failed", copied ? "Copied the Toolbox profile link." : "Your browser blocked clipboard access.");
}

function cancelProfileRequest() {
  profileRequestId += 1;
  profileController?.abort();
  profileController = null;
  document.querySelector("#fetchProfileData").disabled = false;
}
async function fetchProfileData(options = {}) {
  const silent = Boolean(options.silent);
  cancelProfileRequest();
  const requestId = profileRequestId;
  const { username, link } = syncProfileLink();
  if (!username) { setStatus("Missing Username", "Enter a Toolbox username first."); return; }
  const button = document.querySelector("#fetchProfileData");
  button.disabled = true;
  const current = () => requestId === profileRequestId && username === getUsername();
  if (!silent) setStatus("Checking", `Getting the public Toolbox upload for ${username}.`);
  const urls = [`${localProfilesApiUrl}?profile=${encodeURIComponent(username)}`];
  let lastError;
  try {
    for (const url of urls) {
      const controller = new AbortController();
      profileController = controller;
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url, { method: "GET", cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 404 ? "This public profile was not found. Check the username and public upload." : `Profile service returned ${response.status}. Please try again.`);
        const content = await response.json();
        const payload = DashboardProfile.normalize(content, username, link);
        if (!current()) return;
        const saved = persistToolboxPayload(payload);
        setIntelSource("toolbox");
        renderPublicRotations();
        setStatus(saved ? "Checked" : "Loaded for this tab", `${username} — ${formatTime(payload.lastUpdated)}.${saved ? "" : " Download a backup before closing this tab."}`);
        return;
      } catch (error) {
        if (!current()) return;
        lastError = error.name === "AbortError" ? new Error("The profile request timed out. Your previous data is still available.") : error;
      } finally { clearTimeout(timeout); }
    }
    throw lastError;
  } catch (error) {
    if (current()) setStatus("Check failed", `${error?.message || "Could not load this public profile."} Previous data has been kept.`);
  } finally { if (current()) { button.disabled = false; profileController = null; } }
}

function renderCards() {
  grid.innerHTML = "";
  const toolsLayout = getLayoutState().tools || getDefaultLayoutSection();
  const hiddenTools = new Set(toolsLayout.hidden || []);
  const visibleTools = tools.filter((tool) => matchesTool(tool) && !hiddenTools.has(tool.id));
  const orderedToolIds = [
    ...(toolsLayout.order || []).filter((id) => visibleTools.some((tool) => tool.id === id)),
    ...visibleTools.map((tool) => tool.id).filter((id) => !(toolsLayout.order || []).includes(id))
  ];
  const orderedTools = orderedToolIds
    .map((id) => visibleTools.find((tool) => tool.id === id))
    .filter(Boolean);
  const displayedTools = toolsLayout.compact ? orderedTools.slice(0, 24) : orderedTools.slice(0, 6);
  const visibleSavedLinks = toolsLayout.compact ? getSavedLinks().filter((link) => link.showInTools && !link.hiddenPreset) : [];
  toolCount.textContent = toolsLayout.compact || orderedTools.length <= displayedTools.length
    ? `${orderedTools.length} tools`
    : `${displayedTools.length} of ${orderedTools.length} tools`;

  if (displayedTools.length === 0 && visibleSavedLinks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No tools match that search.";
    grid.append(empty);
    return;
  }

  displayedTools.forEach((tool) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const favicon = card.querySelector(".favicon");
    const category = card.querySelector(".category");
    const title = card.querySelector("h2");
    const description = card.querySelector(".description");
    const tagRow = card.querySelector(".tag-row");
    const open = card.querySelector(".primary-action");
    const copy = card.querySelector(".copy-link");

    favicon.src = toolIcon(tool);
    favicon.alt = "";
    favicon.title = tool.name;
    category.textContent = tool.category;
    title.textContent = tool.name;
    description.textContent = tool.description;
    open.href = tool.url;
    open.title = `Open ${tool.name}`;
    copy.title = `Copy ${tool.name} URL`;
    open.addEventListener("click", (event) => {
      event.preventDefault();
      launchUrl(tool.url);
    });

    tool.tags.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag";
      chip.textContent = tag;
      chip.title = `${tool.name} tag: ${tag}`;
      tagRow.append(chip);
    });

    copy.addEventListener("click", () => copyUrl(tool.url, copy));
    setupCustomCard(card, "tools", tool.id);
    grid.append(card);
  });

  visibleSavedLinks.forEach((link) => {
    const card = document.createElement("article");
    card.className = "tool-card saved-tool-card";
    card.innerHTML = `
      <div class="card-top">
        <button class="saved-tool-icon" type="button" title="Open ${escapeHtml(link.name)}" style="background:${safeColor(link.iconColor)}">
          ${escapeHtml(link.iconText)}
        </button>
      </div>
      <div>
        <p class="category">${link.type === "sheet" ? "Sheet" : "Saved Link"}</p>
        <h2>${escapeHtml(link.name)}</h2>
        <p class="description">${link.type === "sheet" ? "Your saved copy or the original community sheet." : "Custom saved link."}</p>
      </div>
      <div class="tag-row"></div>
      <div class="card-actions">
        <a class="primary-action" target="_blank" rel="noopener noreferrer">Open</a>
        <button class="copy-link" type="button">Copy URL</button>
      </div>
    `;
    const target = savedLinkTarget(link);
    const open = card.querySelector(".primary-action");
    const copy = card.querySelector(".copy-link");
    card.querySelector(".saved-tool-icon").addEventListener("click", () => launchUrl(target));
    open.href = safeWebUrl(target);
    open.addEventListener("click", (event) => {
      event.preventDefault();
      launchUrl(target);
    });
    copy.addEventListener("click", () => copyUrl(target, copy));
    setupCustomCard(card, "tools", savedLinkCardId(link));
    grid.append(card);
  });
}

function renderQuickList() {
  quickList.innerHTML = "";
  const hiddenTools = new Set(getLayoutState().tools.hidden);

  tools.forEach((tool) => {
    const row = document.createElement("div");
    row.className = "control-row";
    row.classList.toggle("is-favorite", state.favorites.has(tool.id));
    row.classList.toggle("is-hidden-tool", hiddenTools.has(tool.id));
    row.innerHTML = `
      <button class="control-star" type="button" title="${state.favorites.has(tool.id) ? "Remove" : "Add"} ${escapeHtml(tool.name)} ${state.favorites.has(tool.id) ? "from" : "to"} favorites."><span class="icon icon-star" aria-hidden="true"></span></button>
      <a class="control-open control-tool-icon" href="${escapeHtml(tool.url)}" target="_blank" rel="noopener noreferrer" title="Open ${escapeHtml(tool.name)}. ${escapeHtml(tool.description)}">
        <img src="${toolIcon(tool)}" alt="">
      </a>
      <button class="control-move-up" type="button" title="Move ${escapeHtml(tool.name)} earlier in Tools."><span class="icon icon-arrow-up" aria-hidden="true"></span></button>
      <button class="control-move-down" type="button" title="Move ${escapeHtml(tool.name)} later in Tools."><span class="icon icon-arrow-down" aria-hidden="true"></span></button>
      <button class="control-hide" type="button" title="${hiddenTools.has(tool.id) ? "Show" : "Hide"} ${escapeHtml(tool.name)} in the Tools section."><span class="icon ${hiddenTools.has(tool.id) ? "icon-eye-closed" : "icon-eye-open"}" aria-hidden="true"></span></button>
    `;
    row.querySelector(".control-open").addEventListener("click", (event) => {
      event.preventDefault();
      launchUrl(tool.url);
    });
    row.querySelector(".control-star").addEventListener("click", () => {
      if (state.favorites.has(tool.id)) state.favorites.delete(tool.id);
      else state.favorites.add(tool.id);
      saveFavorites();
      renderQuickList();
    });
    row.querySelector(".control-move-up").addEventListener("click", () => moveToolInControls(tool.id, -1));
    row.querySelector(".control-move-down").addEventListener("click", () => moveToolInControls(tool.id, 1));
    row.querySelector(".control-hide").addEventListener("click", () => {
      toggleHiddenCard("tools", tool.id);
      renderCards();
      renderQuickList();
    });
    quickList.append(row);
  });

  getSavedLinks().forEach((link, index) => {
    if (link.hiddenPreset || !link.inControls) return;
    const row = document.createElement("div");
    row.className = "control-row control-row-saved";
    row.classList.toggle("is-favorite", link.favorite);
    row.classList.toggle("is-hidden-tool", !link.showInTools);
    row.innerHTML = `
      <button class="control-star" type="button" title="${link.favorite ? "Remove" : "Add"} ${escapeHtml(link.name)} ${link.favorite ? "from" : "to"} favorites."><span class="icon icon-star" aria-hidden="true"></span></button>
      <a class="control-open" href="${escapeHtml(safeWebUrl(savedLinkTarget(link)))}" target="_blank" rel="noopener noreferrer" title="Open ${escapeHtml(link.name)}.">
        <span>${escapeHtml(link.name)}</span>
      </a>
      <button class="control-hide" type="button" title="${link.showInTools ? "Hide" : "Show"} ${escapeHtml(link.name)} in compact Tools."><span class="icon ${link.showInTools ? "icon-eye-open" : "icon-eye-closed"}" aria-hidden="true"></span></button>
    `;
    row.querySelector(".control-open").addEventListener("click", (event) => {
      event.preventDefault();
      launchUrl(savedLinkTarget(link));
    });
    row.querySelector(".control-star").addEventListener("click", () => {
      const nextLinks = getSavedLinks();
      const nextIndex = nextLinks.findIndex((savedLink) => savedLink.id === link.id);
      if (nextIndex < 0) return;
      nextLinks[nextIndex] = { ...nextLinks[nextIndex], favorite: !nextLinks[nextIndex].favorite };
      saveSavedLinks(nextLinks);
    });
    row.querySelector(".control-hide").addEventListener("click", () => {
      const nextLinks = getSavedLinks();
      const nextIndex = nextLinks.findIndex((savedLink) => savedLink.id === link.id);
      if (nextIndex < 0) return;
      nextLinks[nextIndex] = { ...nextLinks[nextIndex], showInTools: !nextLinks[nextIndex].showInTools, inControls: true };
      saveSavedLinks(nextLinks);
      render();
    });
    quickList.append(row);
  });
}

function render() {
  renderCards();
  renderQuickList();
  applySectionLayout("tools");
  applySidebarLayout();
}

document.querySelector("#openFavorites").addEventListener("click", () => {
  showFavoritesModal();
});

document.querySelector("#openHelp")?.addEventListener("click", () => {
  if (onboardingModal) onboardingModal.hidden = false;
});

document.querySelector("#scrollBottom").addEventListener("click", () => {
  currentIntel.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelectorAll("[data-mobile-jump]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.querySelector(button.dataset.mobileJump);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

document.querySelector("#closeRipModal").addEventListener("click", () => {
  ripModal.hidden = true;
});

ripModal.addEventListener("click", (event) => {
  if (event.target === ripModal) ripModal.hidden = true;
});

document.querySelector("#closeFavoritesModal").addEventListener("click", () => {
  favoritesModal.hidden = true;
});

favoritesModal.addEventListener("click", (event) => {
  if (event.target === favoritesModal) favoritesModal.hidden = true;
});

function closeOnboarding(savePreference = false) {
  if (!onboardingModal) return;
  onboardingModal.hidden = true;
  if (savePreference || dontShowOnboarding?.checked) {
    storage.setItem(onboardingSeenKey, "true");
  }
}

function maybeShowOnboarding() {
  if (!onboardingModal || storage.getItem(onboardingSeenKey) === "true") return;
  onboardingModal.hidden = false;
}

document.querySelector("#closeOnboardingModal")?.addEventListener("click", () => {
  closeOnboarding(false);
});

document.querySelector("#finishOnboardingModal")?.addEventListener("click", () => {
  closeOnboarding(true);
});

onboardingModal?.addEventListener("click", (event) => {
  if (event.target === onboardingModal) closeOnboarding(false);
});

document.querySelector("#manageSavedLinks").addEventListener("click", () => {
  renderSavedLinksManager();
  savedLinksModal.hidden = false;
});

document.querySelector("#closeSavedLinksModal").addEventListener("click", () => {
  savedLinksModal.hidden = true;
});

savedLinksModal.addEventListener("click", (event) => {
  if (event.target === savedLinksModal) savedLinksModal.hidden = true;
});

rateValue.addEventListener("input", renderRateCalculator);
rateUnit.addEventListener("change", renderRateCalculator);

idleonResetTime.addEventListener("change", () => {
  const settings = getChecklistSettings();
  setChecklistSettings({ ...settings, idleonResetTime: idleonResetTime.value });
  renderChecklist();
});

checklistForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = checklistInput.value.trim();
  if (!text) return;
  const items = getChecklistItems();
  items.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text,
    type: checklistType.value || "current",
    done: false
  });
  setChecklistItems(items);
  checklistForm.reset();
  renderChecklist();
});

savedLinkForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = savedLinkName.value.trim();
  const url = savedLinkUrl.value.trim();
  if (!name || !url) return;

  try {
    const normalizedUrl = requireWebUrl(url);
    const links = getSavedLinks();
    links.push({
      id: `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      url: normalizedUrl,
      personalUrl: "",
      type: "manual",
      inControls: true,
      showInTools: false,
      showInSavedPanel: true,
      favorite: false
    });
    saveSavedLinks(links);
    savedLinkForm.reset();
  } catch {
    savedLinkUrl.focus();
  }
});

document.querySelector("#copyLilBoProfile").addEventListener("click", () => {
  cancelProfileRequest();
  toolboxUsername.value = "Lil_bo";
  accountLink.value = lilBoProfileUrl;
  storage.setItem(usernameKey, "Lil_bo");
  storage.setItem(accountLinkKey, lilBoProfileUrl);
  copyUrl(lilBoProfileUrl, document.querySelector("#copyLilBoProfile"));
  setStatus("Copied", "Using Lil_bo. Copied and saved the Toolbox profile link.");
});

document.querySelector("#fetchProfileData").addEventListener("click", fetchProfileData);

document.querySelector("#copyRawJson").addEventListener("click", async () => {
  const payload = getSavedPayload();
  if (!payload?.data) {
    setStatus("No Data", "Fetch a Toolbox profile or paste profile data before copying JSON.");
    return;
  }
  const profilePayload = getProfilePayloadForCopy(payload);
  const copied = await copyText(JSON.stringify(profilePayload, null, 2));
  setStatus(
    copied ? "Copied" : "Copy Failed",
    copied
      ? `Copied profile JSON with ${profilePayload.charNames.length} character names.`
      : "Your browser blocked clipboard access."
  );
});

accountLink.addEventListener("click", copyAccountLinkField);
accountLink.addEventListener("focus", () => accountLink.select());

document.querySelector("#pasteManualJson").addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!DashboardProfile.parse(text)) throw new Error("This JSON does not contain a usable IdleOn profile.");
    storage.setItem(manualJsonKey, text);
    setManualJsonStatus();
    renderPublicRotations();
  } catch (error) {
    console.error(error);
    manualJsonStatus.textContent = "Paste failed — use the paste field";
  }
});

const manualDialog = document.querySelector("#manualJsonDialog");
const manualText = document.querySelector("#manualJsonText");
const manualFeedback = document.querySelector("#manualJsonFeedback");
document.querySelector("#openManualJson").addEventListener("click", () => { manualText.value = ""; manualFeedback.textContent = ""; manualDialog.showModal(); });
document.querySelector("#closeManualJson").addEventListener("click", () => manualDialog.close());
manualDialog.addEventListener("close", () => document.querySelector("#openManualJson").focus());
document.querySelector("#manualJsonFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 16 * 1024 * 1024) { manualFeedback.textContent = "Choose a profile smaller than 16 MB."; return; }
  try { manualText.value = await file.text(); manualFeedback.textContent = "File loaded. Save to keep this data."; }
  catch { manualFeedback.textContent = "This file could not be read."; }
});
document.querySelector("#saveManualJson").addEventListener("click", () => {
  const text = manualText.value.trim();
  if (text.length > 16 * 1024 * 1024 || !DashboardProfile.parse(text)) { manualFeedback.textContent = "Paste valid IdleOn profile JSON containing data or serverVars."; return; }
  const saved = storage.setItem(manualJsonKey, text);
  setManualJsonStatus(); renderPublicRotations();
  manualFeedback.textContent = saved ? "Manual JSON saved. Select Use Manual JSON For Intel to switch sources." : "Loaded for this tab. Download a backup before closing.";
});

useManualJsonForIntel?.addEventListener("click", () => {
  cancelProfileRequest();
  const manual = getManualProfileData();
  if (!manual) {
    manualJsonStatus.textContent = getManualJson() ? "Invalid" : "Empty";
    return;
  }
  setIntelSource("manual");
  renderPublicRotations();
});

document.querySelector("#copyManualJson").addEventListener("click", async () => {
  const saved = getManualJson();
  if (!saved) {
    manualJsonStatus.textContent = "Empty";
    return;
  }
  const copied = await copyText(saved);
  manualJsonStatus.textContent = copied ? "Copied" : "Copy Failed";
});

document.querySelector("#clearManualJson").addEventListener("click", () => {
  storage.removeItem(manualJsonKey);
  if (storage.getItem(intelSourceKey) === "manual") setIntelSource("toolbox");
  setManualJsonStatus();
  renderPublicRotations();
});

notes.value = storage.getItem(notesKey) || "";
notes.addEventListener("input", () => {
  storage.setItem(notesKey, notes.value);
});

toolboxUsername.value = storage.getItem(usernameKey) || "";
accountLink.value = getSavedAccountLink();
toolboxUsername.addEventListener("input", () => {
  cancelProfileRequest();
  const username = getUsername();
  accountLink.value = getProfileLink(username);
  storage.setItem(usernameKey, username);
  storage.setItem(accountLinkKey, accountLink.value);
});
const savedPayload = getSavedPayload();
if (savedPayload) {
  setStatus("Cached", `Cached public profile data: ${formatTime(savedPayload.lastUpdated)}.`);
}
setManualJsonStatus();

renderIconLinks(wikiLinks, [...publicLinks.communities, ...publicLinks.platforms, ...publicLinks.extras]);
renderPublicRotations();
renderRateCalculator();
renderSavedLinks();
renderChecklist();
setInterval(updatePublicRotationTimers, 1000);
setInterval(refreshChecklistIfResetChanged, 1000);
render();
maybeShowOnboarding();
document.addEventListener("visibilitychange", () => { if (!document.hidden) { updatePublicRotationTimers(); refreshChecklistIfResetChanged(); } });

}
initializeDashboard().catch((error) => {
  console.error("Dashboard startup failed", error);
  const warning = document.querySelector("#storageWarning");
  warning.hidden = false;
  document.querySelector("#storageWarningText").textContent = "The dashboard could not finish loading. Your saved data has not been cleared. Reload to try again.";
});
