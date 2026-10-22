# Sky Paddock

A fork of WeatherStar 4000+ International shown on a kitchen TV: weather, aviation, F1, GT World and
news screens in the 1990s WeatherStar look. It runs as a Chromium kiosk on a Raspberry Pi 3
(DietPi, 1080p, widescreen), loading the site published on GitHub Pages. Screens marked "Pi" read a
local service on the Pi (`skypaddock-hub`, http://127.0.0.1:8095) and are skipped anywhere else.

`README.md` describes every screen and option; read it before changing a screen.
Personal notes (owner, Pi, deploy, history) are in `CLAUDE.local.md`, which is not committed.

## Commands

- `npm ci` once, then `npm run dev` (Vite dev server at http://localhost:8080/, reloads on change)
- `npm run lint` (ESLint, Airbnb style with tabs), `npm run build` (Vite, into `docs/`) and `npm test`
  (Playwright smoke test of the build; `npx playwright install chromium` once)
- `.claude/`: the `/publicar` skill (the steps of a release, with `bump.mjs` for the version) and a hook that lints each `.mjs` Claude edits.
- Publishing: push to `main`. `.github/workflows/pages.yml` runs `npm ci`, lint, build, checks
  (`docs/index.html`, assets, `docs/images/flags`, the `package.json` version inside `docs/index.html`),
  the smoke test, and deploys to Pages. `docs/` is built by Actions and is not committed.

## Layout

- `views/index.ejs` and `views/partials/*.ejs`: the page, rendered with EJS by `vite.config.mjs`
  (`server/index.html` only includes it). One partial per screen; `scroll.ejs` is the bottom line.
- `server/scripts/main.mjs`: the single entry; imports every screen in rotation order.
- `server/scripts/modules/*.mjs`: one module per screen, each a `WeatherDisplay` subclass
  registered with `registerDisplay(new X(navId, elemId, defaultActive))`.
- `server/styles/scss/`: one file per screen, all imported by `main.scss`; themes in
  `_f1-theme.scss`, `_aviation-theme.scss`, `_gt-theme.scss`.
- `server/images/`: copied as they are to the build (screens load them by name at run time).

## Things that break easily

- navIds must stay contiguous (0..24 today); a hole makes navigation crash in `findIndex`.
- `STATUS` values are Symbols: wrap them in `String()` inside template strings.
- Text from other sites is never HTML: `fillTemplate` fills strings with `textContent` (HTML only as `{ html }`), and hand-built markup runs outside text through `escapeHtml` (`utils/html.mjs`).
- Templates (`.template`) are removed from the DOM at start-up and cloned by `fillTemplate`.
- Many boxes use `white-space: pre`. The build compacts the HTML (`html-minifier-terser`,
  `collapseWhitespace`) so the line breaks of the templates do not show; keep that in `vite.config.mjs`.
- The Star4000 fonts have no accented letters: pass text through `plainText` (`utils/news.mjs`).
- The page is 640x480, scaled; widescreen (`.wide`) widens the background and the bottom line to 854.
- The countdown bar (`scroll.ejs`, `syncCountdown` in `weatherdisplay.mjs`) is hidden on screens that
  scroll (those with `baseCountChange`).
- Keep the Pi light: avoid per-frame animations and constant DOM updates (it has no GPU worth using).

## Testing

- `npm test` (after `npm run build`): Playwright smoke test of every screen, 16:9 and 4:3, with the external
  sites replayed from `tests/recorded/sites.har` and the Pi service replaced by `tests/pi-fixtures.mjs`
  (made up: never put real Pi data there). Actions runs it before publishing. `npm run test:record` records
  the sites again (needed when a screen asks for new data); check the new `recorded.json` statuses.
- For a screen changed, also look at screenshots (`SCREENSHOTS=1 npm test`, in `test-results/`) in 16:9 and 4:3.
- Run `npm run lint`, `npm run build` and `npm test` before every commit.

## Rules (always)

- Versions: `package.json` (and the two version fields in `package-lock.json`); the last number for
  fixes, the middle one for new screens or features. Update `README.md` with every change.
- The repository is public: no personal data, no home coordinates, no API keys, tokens or passwords.
  Keys and credentials live only in the Pi's configuration.
- Do not scrape flightradar24. Do not spoof `Referer`/`Origin` or otherwise get round a site's
  protection (F1 Jet Tracker and Swiss Timing refuse such requests: that is accepted).
- Do not redistribute MultiViewer data.
- Logos and marks: only image files supplied by the owner, used as given (cropping or resizing is fine).
- Ask before deleting any of the owner's files.
