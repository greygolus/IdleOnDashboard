# IdleOn Dashboard improvement plan

Prepared September 5, 2026.

## Implementation progress

- **Reliability release delivered:** automatic local recovery copies, backup/restore, protected saves, honest profile/source labels, request cancellation, and independent timer rollover. Live baseline: `71c01b7`.
- **Resource discovery release:** all chosen resources in both densities; a separate library view; search, category and favorite filtering; direct favorite/visibility actions; named ordering controls that preserve mixed layouts; natural desktop scrolling; narrow-screen layouts; and keyboard-safe dialogs. Verified with 25 storage/profile/proxy tests and 27 browser scenarios, including upgrades from both prior live versions.
- **Still planned:** checklist editing/reordering/undo, a unified profile panel, more contextual help, content review, and measured performance/accessibility work. The historical audit below describes the starting state; it is not a list of unresolved defects after these releases.

**Recommendation:** evolve the existing dashboard in staged releases. Start with trustworthy data and protection of saved work, then simplify the daily experience and refresh the design. Keep its IdleOn identity, quick access to community tools, and browser-local ownership of personal information.

The earlier rebuild brief is useful context. A complete replacement is a possible implementation approach, but the audit does not establish a need to replace the whole technology stack. The immediate improvements can be delivered without waiting for that decision.

## Project understanding

IdleOn Dashboard serves players who already use several community resources and need a convenient place to open them, check rotations, and plan their next actions.

The current product includes nine built-in tools; community sheets and personal links; favorites and layout controls; public Toolbox profile retrieval and manual JSON; Current Intel; daily, weekly, and one-time tasks; notes; and a rate calculator. Personal state lives in browser storage. The production profile endpoint proxies public Toolbox uploads.

The implementation is static HTML, CSS, and JavaScript with a small Node/Vercel endpoint. There are no declared runtime package dependencies. The main application is approximately 3,100 lines, and the base stylesheet is approximately 2,580 lines. There are 190 mirrored game assets available to preserve the site's character.

The checkout is on `codex/idleon-dashboard-redesign-lab`, with the latest commit dated July 9, 2026. It contains Foundry, Atlas, and Orbit visual concepts. These are explicitly visual skins: they preserve the underlying layout and behavior. The live site's application script matches the local script, but its HTML and stylesheet differ, and it does not load those concepts. The existing Vercel packaging list also omits the concept files. Treat the concepts as design exploration, not a completed redesign or a production defect.

## Findings that should shape the work

| Priority | Finding | Why it matters |
| --- | --- | --- |
| First | Favorites are parsed without a recovery boundary during startup. Invalid JSON or an unexpected object stops initialization. | A damaged preference can prevent the whole dashboard from starting. |
| First | Custom link names are escaped in some views but inserted directly as HTML in favorites and custom tool cards. URL parsing does not restrict links to HTTP/HTTPS. | User-controlled data needs consistent safe rendering before imports or richer sharing are added. |
| First | Manual data can be selected by fallback while the source label still says Toolbox. Session data always takes precedence over a newer local cache. | The displayed source and the actual data can disagree. |
| First | Upload labels show a time of day without a date. Missing upload timestamps become the current time. | Old or undated uploads can appear more recent than they are. A successful sample profile request returned a May 20 upload during this September audit. |
| First | Wiki parsing updates shared rotation objects, then rendering recomputes and overwrites many of those fields. The one-second timer loop does not recompute weekly rotations or random-event/happy-hour content. | Source precedence is unclear, and rollover can depend on the five-minute wiki request succeeding or another render occurring. |
| Next | Full mode displays only six of nine tools; saved tool cards appear only in compact mode. Configuration is separated into Controls. | Players have to understand display modes and move between sections to manage the same resource. |
| Next | Desktop styles repeatedly combine viewport constraints, hidden overflow, and small type. Mobile retains a large header and a long stack of sidebar sections. | Readability and access to content need to drive the layout. Actual clipping and device-specific behavior still require browser validation. |
| Next | Dialogs have ARIA roles but no dedicated focus management or Escape handling. Some clickable intel cards are non-focusable articles. | Keyboard operation is incomplete even though semantic groundwork exists. |
| Ongoing | Catalogs, storage, calculations, rendering, and events share one large script. There are no test or lint scripts or repository CI workflows. | Small changes are harder to verify and game-data updates risk unrelated regressions. |

The initial diagnostic probes reproduced the favorites startup failure, source-label mismatch, stale session-cache precedence, and interpretation of a custom favorite name as markup. These were isolated code checks, not browser exploit tests.

## Release 1: make the existing dashboard dependable

**Outcome:** players can trust the displayed source and freshness, and a storage or network failure does not destroy the session.

- Add one safe storage layer with defaults, shape validation, versioned migrations, and visible handling of unavailable or full storage. Preserve recoverable original data instead of silently overwriting it.
- Add dashboard backup and restore for notes, tasks, favorites, personal links, and settings. Make inclusion of profile JSON optional and explicit; validate a backup before applying it and provide a rollback copy. Keep backup files on the user's device.
- Normalize profile data once. Keep `uploadedAt`, `fetchedAt`, profile identity, and selected source separate. Show both date and relative age; use “upload time unknown” when needed. Derive the visible source label from the source actually used.
- Prevent older concurrent requests from replacing newer profile selections. Add bounded timeouts, clear retry behavior, and useful distinctions between private/missing profiles, bad data, and upstream outages.
- Retain the last usable data with a stale label. Keep an explicit choice between Toolbox and manual data; provide a paste field or file input when clipboard access is denied.
- Replace raw user-text HTML interpolation with safe text rendering. Validate URL schemes and imported color/icon values at the boundary.
- Separate public schedules from upload-dependent data. Define which source wins for each field; attach source and freshness information to Current Intel cards.
- Recompute schedules at daily/weekly boundaries and on return to a backgrounded tab. Keep countdown updates lightweight. Validate current game rules against upstream sources before changing the algorithms.

**Done when:** existing saved state survives an upgrade; a backup restores accurately; malformed and oversized data cannot break startup; source labels match the data; old and unknown timestamps are honest; request races and failures preserve usable state; and rollover works without a successful wiki fetch. Add focused regression tests around these failure cases.

## Release 2: improve the everyday experience and visual hierarchy

**Outcome:** opening a favorite, checking what is due, and completing a task are immediately apparent.

Recommended direction: retain the game assets, dark surfaces, and green/gold accents, while using clearer typography, fewer competing borders, and more consistent spacing. The Foundry palette is a reasonable starting hypothesis from the existing design work; choose the final treatment after seeing it with realistic content.

| Area | Proposed change |
| --- | --- |
| First screen | Compact header, direct favorite links, and a brief view of upcoming resets or due tasks. Keep the useful dashboard visible immediately. |
| Tool discovery | Add search and category filtering across tools and saved resources. Make all tools reachable regardless of density mode. |
| Configuration | Place favorite/hide actions beside the resource and move ordering/layout changes into a clear Customize mode. |
| Resource library | Unify the management of built-ins, personal copies, and custom links. Make “Original” versus “My copy” explicit; separate current and archived references. |
| Profile workflow | One data panel with Toolbox and manual source choices, a persistent source/age summary, clear loading/error feedback, and copy actions associated with the correct payload. Move the sample testing account into Help. |
| Checklist | Group daily, weekly, and current goals; show useful completion counts; support editing, ordering, and undo for deletion. Clearly label local daily reset time and server weekly reset. |
| Notes | Show saved/error feedback and preserve text reliably. Keep notes within easy reach of the task list. |
| Calculator | Show an understandable empty state, supported number suffixes, explicit invalid-input feedback, and clear result units. |
| Help | Offer a short, dismissible introduction and contextual help that works on touch and keyboard. Move maintenance/test language out of the primary workflow. |

Comfortable and compact density should change presentation without changing which features or resources are available. On desktop, favor natural page flow and deliberate scrolling regions over squeezing every panel into a fixed viewport. On mobile, emphasize Tools, Intel, Tasks, and Data; preserve quick access to Notes and account for the on-screen keyboard and bottom safe area.

**Done when:** representative tasks can be completed without instructions; pinned resources remain available in either density; long names and filled task lists stay usable; and first-time and returning-user states both make sense.

## Release 3: accessibility, performance, and maintainability

Accessibility is part of each rebuilt component, with a complete verification pass here:

- Move focus into dialogs, contain it, support Escape, make the background inert, and restore focus on close. Follow the [W3C dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- Use links for navigation and buttons for actions; preserve normal browser link behavior and keyboard access to intel destinations.
- Provide explicit labels, visible focus, accessible names for icon controls, and restrained status announcements. Do not announce every timer tick.
- Make routine labels comfortably readable, provide generous touch targets, support text enlargement and reduced motion, and verify contrast and reflow.
- Check narrow phones through wide desktops, short laptop windows, 200% zoom, keyboard-only use, and both density modes. These checks have not yet been performed in this audit.

Refactor along product boundaries: catalog data, storage/migrations, profile adapters, schedule calculations, tools/resources, checklist/notes, and shared UI. Keep calculations independent of rendering and give them an injectable clock for boundary tests. Consolidate repeated CSS overrides into a coherent layout and token system.

Keep the lightweight static delivery model unless a specific component or routing requirement justifies adding a framework. A framework migration should have its own acceptance criteria and preserve the storage contract.

Measure performance before setting optimization priorities. The sample profile response was about 1.29 MB, and the current code serializes it into both local and session storage. Cache parsed state in memory, avoid repeated parsing and full-card recreation, pause unnecessary work in hidden tabs, and consider IndexedDB for large payloads if measurements and quota behavior justify it. Preserve lightweight assets and make future asset replacements cache-safe.

Use [Core Web Vitals](https://web.dev/articles/defining-core-web-vitals-thresholds) as eventual field targets: LCP at or below 2.5 seconds, INP at or below 200 milliseconds, and CLS at or below 0.1 at the 75th percentile, evaluated for mobile and desktop. These are targets, not measured results for this site.

**Done when:** major flows pass keyboard/mobile checks, storage and schedule tests run automatically, the production package contains every referenced asset, and measurements show no material performance regression.

## Release 4: keep content and releases healthy

- Maintain tools and community resources as data with owner, category, source, and last-reviewed date. Verify destinations and descriptions periodically; retain an intentional archive for retired tools.
- Review rotation datasets when the game changes, with source attribution and dated reference fixtures. Avoid inferring correctness merely because a countdown is moving.
- Preserve the custom domain, canonical URL, metadata, and indexing files. Put useful core resource content in initial HTML so the site is useful when scripts fail and easier to discover.
- Replace the tiny game-item social image with a deliberate share preview during a separately scoped asset pass. Keep credits, unofficial status, and browser-local data behavior easy to find.
- Establish one documented production path. The repository currently contains both Vercel configuration and Sites project metadata; confirm the intended deployment owner before a future release. This audit does not propose a hosting migration.
- Use preview releases, repeatable validation, and rollback. Protect existing storage keys during rollout. If the production origin ever changes, provide export/import first because browser storage does not follow a domain change.
- Build on existing analytics only where useful: aggregate tool launches, profile-request failures, and performance. Keep usernames, profile JSON, notes, personal URLs, and checklist text out of telemetry.

**Done when:** catalog updates are straightforward, broken destinations are actionable, releases are reproducible, and product decisions have useful aggregate evidence.

## Recommended starting scope

The first implementation should deliver safe storage, backup/restore, consistent rendering of user text, accurate profile/source labels, and reliable timer rollover. Introduce only the module boundaries necessary to make those changes testable. Follow with the unified resource experience and responsive redesign.

Consider offline installation, multiple named profiles, or richer progression planning only after the core releases demonstrate a need. Accounts, cloud sync, notifications, and AI recommendations would materially expand the product and are not prerequisites for this plan.

## Audit evidence and limits

Reviewed the application, styles, HTML, local server, profile proxy, deployment configuration, recent history, assets, and existing rebuild handoff. Checked the live [dashboard](https://idleondashboard.com/), compared its application script to the checkout, and confirmed expected missing-username and successful public sample-profile responses. Syntax checks passed for the four JavaScript files. No application source was changed or deployed.

This is a source and HTTP review. It does not include rendered browser inspection, screen-reader testing, measured performance, a complete external-link audit, production analytics, or independent verification of every current game schedule. Those remain explicit validation work, not assumed findings.

Useful implementation anchors: `app.js:292` (startup), `app.js:487` (source selection), `app.js:831` (rotation derivation), `app.js:1521` (favorites rendering), `app.js:1599` (freshness label), `app.js:1724` (rotation rendering), `app.js:1788` (timer tick), `app.js:1880` (wiki refresh), `app.js:1896` (profile storage), `app.js:2635` (profile requests), `app.js:2703` (tool visibility), `styles.css:1624` (desktop constraints), and `api/profiles.js` (production proxy).
