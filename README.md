# IdleOn Dashboard

A beta launch dashboard for Legends of IdleOn community tools, public wiki timers, Toolbox profile links/data, saved community sheets, notes, a rate calculator, and a personal checklist.

## Beta Notes

- Toolbox data uses your public IdleOn Toolbox profile. It is not live game data.
- To refresh account data, update your public profile in IdleOn Toolbox, then use `Check Profile`.
- Saved community sheets live in `Saved Links > Manage`. Paste your own copied sheet URL there when a sheet is meant to be copied.
- The sidebar only shows a small selected set of saved resources. Use `Show In Side` / `Hide From Side` in Manage to control that list.
- Current Intel pulls public wiki/timer-style information where possible. Meritocracy uses public Toolbox profile data after `Check Profile`.

## Running Locally

Requires Node.js.

```bash
npm start
```

Then open:

```text
http://localhost:4173/
```

## Hosting

Best option for beta: host with the included Node server so `/api/profiles` and wiki image proxying work reliably.

```bash
npm start
```

Static hosting can work for most of the dashboard, but profile fetching depends on whether the Toolbox profile worker allows the hosted origin. The app tries `/api/profiles` first and falls back to the worker URL.

## Files

- `index.html` - dashboard markup
- `styles.css` - layout and theme
- `app.js` - dashboard logic and saved state
- `server.js` - local/hosted static server plus profile/wiki proxy
- `references/IdleonToolbox/` - cloned Toolbox reference/assets used for local icons

## Discord Beta Post Draft

IdleOn Dashboard beta is ready to test.

It is a compact dashboard for IdleOn tools, wiki/current intel, community sheets, Toolbox profile links/data, notes, a rate calculator, and a checklist/goals area.

Important beta notes:
- It uses public IdleOn Toolbox data only, so update your Toolbox profile and make it public before using `Check Profile`.
- It is not live game data.
- Saved community sheets are in `Saved Links > Manage`.
- Current Intel is public/wiki-based except Meritocracy, which uses your checked Toolbox profile.

Feedback wanted:
- Broken links/icons
- Bad layout at your screen size or browser zoom
- Missing community sheets/tools
- Confusing wording or buttons
