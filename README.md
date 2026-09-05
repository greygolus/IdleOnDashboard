# IdleOn Dashboard

IdleOn Dashboard is a community launch board for **Legends of IdleOn** tools, current intel, wiki timers, community sheets, Toolbox profile data, notes, goals, and quick links.

Live site: https://idleondashboard.com/

## What It Does

- Launches popular IdleOn tools from one page.
- Shows Current Intel for events, weekly reset, weekly battle, lab rotation, exotic market, and Multi Meritocracy.
- Uses public IdleOn Toolbox profile data when you enter a Toolbox username and click `Check Profile`.
- Lets you paste manual JSON and use it as the Current Intel data source.
- Stores community sheets and personal links locally in your browser.
- Includes a checklist/goals area, notes, favorites, and a rate calculator.

## Important Data Notes

- This is not live game data.
- Toolbox-based information is only as fresh as the public Toolbox profile you checked.
- To refresh account data, update your public profile in IdleOn Toolbox, then use `Check Profile` on the dashboard.
- Manual JSON is stored locally in your browser and can be selected as the Current Intel source.
- Saved links, notes, checklist items, layout settings, and favorites are local browser storage.

## Backups and upgrades

- The data-safety update keeps the existing storage keys and saved-data formats. Normal startup does not migrate or clear saved links, notes, favorites, or layouts.
- Before application writes start, the browser saves an exact recovery copy of the original dashboard data, including readable legacy session profile data. IndexedDB stores this copy separately from localStorage; a localStorage fallback is available.
- If a backup or normal save cannot be made, existing data is kept and a visible warning explains which edits only last in the current tab. The Backups menu can download those edits.
- Backups → Download current backup exports links, notes, tasks, settings, and optionally profile JSON. Recovery copies contain all data. Backups stay on the device or in the downloaded file; they are not uploaded.
- Restoring a file first saves a before-restore copy and an operation journal. Failed writes roll back, and unfinished restores are recovered before the next startup permits writes. Omitted sections are kept; explicit null values restore absence. Close other dashboard tabs before restoring.
- Browser Web Locks coordinate restores and startup recovery across tabs. Browsers without this capability can keep using and downloading their data, but must be updated before restoring a backup. Edits made during a restore remain in their tab for export, and rollback preserves newer saved values from older tabs.
- Damaged records are retained for recovery. They are not silently replaced by empty defaults when another setting is edited.
- Automatic copies share the device's browser-data lifecycle. A downloaded file is the independent backup if browser data is cleared.

## Validation

```bash
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

The tests cover old-to-new upgrades, personal sheet copies, duplicate names, malformed records, storage quotas, request races, backup round trips, interrupted restores, rollover without the wiki, and the recovery UI on phone-sized screens. Browser tests use synthetic data and mocked external responses.

Production must remain on `https://idleondashboard.com/` to retain access to existing browser data. Preview deployments use a separate origin and cannot see visitors' production data. Source rollback uses the prior deployment; the unchanged legacy keys remain readable by the older application. Keep the recovery files/scripts with the tested release when packaging for Vercel.

## Local Development

Requires Node.js 18 or newer.

```bash
npm start
```

Then open:

```text
http://localhost:4173/
```

## Hosting

The production site is hosted on Vercel.

- Static files are served directly from the repo.
- Mirrored icon/image assets live in `assets/`.
- `api/profiles.js` provides the `/api/profiles` serverless route for the `Check Profile` button.
- `server.js` is the local development server and profile/wiki proxy.

## Project Files

- `index.html` - dashboard markup and metadata
- `styles.css` - layout and IdleOn-themed styling
- `app.js` - dashboard logic and local saved state
- `server.js` - local static server plus profile/wiki proxy
- `api/profiles.js` - Vercel serverless Toolbox profile proxy
- `assets/` - published local icons/images
- `robots.txt` and `sitemap.xml` - search indexing helpers

## Contributing

Feedback and suggestions are welcome through GitHub issues:

https://github.com/greygolus/IdleOnDashboard/issues

Good issue topics include:

- broken links or icons
- layout problems at specific screen sizes
- missing community sheets or tools
- confusing wording or controls
- Current Intel data that does not match the source data

## Credits

Built with help from the IdleOn community. Big thanks to Morta1, the IdleOn Wiki contributors, the Discord community, and everyone who helped test the dashboard.

IdleOn Dashboard is an unofficial community project and is not affiliated with or endorsed by LavaFlame2.
