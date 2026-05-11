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

Recommended beta host: Vercel.

- Static files are served directly from the repo.
- Mirrored icon/image assets live in `assets/` so the dashboard does not depend on wiki image hotlinking.
- `api/profiles.js` provides the `/api/profiles` serverless route for the `Check Profile` button.

The included `server.js` is still useful for local testing with `npm start`.

## Files

- `index.html` - dashboard markup
- `styles.css` - layout and theme
- `app.js` - dashboard logic and saved state
- `server.js` - local static server plus profile/wiki proxy
- `api/profiles.js` - Vercel serverless profile proxy
- `assets/` - published local icons/images

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
