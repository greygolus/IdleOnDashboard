# IdleOn Dashboard

IdleOn Dashboard is a community launch board for **Legends of IdleOn** tools, current intel, wiki timers, community sheets, Toolbox profile data, notes, goals, and quick links.

Live site: https://idleon-dashboard.vercel.app/

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
