// smoke test of the built site: every screen turned on, in kiosk mode, at 16:9 and at 4:3.
// It checks that no screen fails or stays loading, that each loaded screen is drawn without a page error,
// and (when replaying) that each screen ends as it did when the answers were recorded.
//
// The weather, F1 and other sites are not asked: their answers were recorded once (npm run test:record)
// into tests/recorded/sites.har, and the page clock is set to the time of that recording, so the result
// is the same every time. The Pi service is replaced by made-up answers (tests/pi-fixtures.mjs).
// With SCREENSHOTS=1 every page of every screen is saved in test-results/.
import fs from 'node:fs';
import path from 'node:path';
import { test as base, expect } from '@playwright/test';
import piResponses from './pi-fixtures.mjs';

const test = base.extend({ record: [false, { option: true }] });

const RECORDED = path.resolve('tests', 'recorded');
const HAR = path.join(RECORDED, 'sites.har');
const META = path.join(RECORDED, 'recorded.json');
// what is recorded and replayed: every https site
const SITES = /^https:\/\//;

// a public place, not anyone's home
const LOCATION = {
	query: 'Lisbon, PRT', latLon: { lat: 38.7223, lon: -9.1393 }, airportIcao: 'LPPT', airportName: 'Lisbon', ipmaArea: '11',
};
// screens that load without pages of their own when there is nothing to show (Hazards: no warnings)
const MAY_HAVE_NO_PAGES = ['hazards'];
const STATUS_CLASSES = ['loading', 'press-here', 'failed', 'no-data', 'disabled', 'retrying'];
const STATUS_NAMES = {
	loading: 'loading', 'press-here': 'loaded', failed: 'failed', 'no-data': 'no data', disabled: 'disabled', retrying: 'retrying',
};

const readMeta = () => JSON.parse(fs.readFileSync(META, 'utf8'));

// status of each screen, read from its checkbox under the page ({ 'hazards': 'loaded', ... })
const screenStatuses = (page) => page.evaluate(({ classes, names }) => Object.fromEntries(
	[...document.querySelectorAll('#enabledDisplays label')].map((label) => {
		const cls = classes.find((c) => label.classList.contains(c));
		return [label.id.replace(/-label$/, ''), names[cls] ?? 'unknown'];
	}),
), { classes: STATUS_CLASSES, names: STATUS_NAMES });

const shownScreen = (page) => page.evaluate(() => document.querySelector('.weather-display.show')?.id.replace(/-html$/, '') ?? null);

[true, false].forEach((wide) => {
	const name = wide ? '16:9' : '4:3';
	test(`every screen loads and draws (${name})`, async ({ page, record }, testInfo) => {
		// one recording is enough: both layouts ask for the same data
		test.skip(record && !wide, 'recorded in the 16:9 run');

		const meta = record ? { time: Date.now() } : readMeta();
		const pi = piResponses(meta.time);

		// page errors (uncaught exceptions and unhandled rejections)
		const pageErrors = [];
		page.on('pageerror', (error) => pageErrors.push(error.message));
		const consoleErrors = [];
		page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

		// anything outside the page and the Pi that was not recorded is refused (and listed)
		const missing = [];
		if (!record) {
			await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (route) => {
				missing.push(route.request().url());
				return route.abort();
			});
		}
		await page.route('http://127.0.0.1:8095/**', (route) => {
			const answer = pi[new URL(route.request().url()).pathname];
			if (!answer) return route.fulfill({ status: 404, body: '' });
			return route.fulfill({
				status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(answer),
			});
		});
		if (record) {
			fs.mkdirSync(RECORDED, { recursive: true });
			await page.routeFromHAR(HAR, {
				url: SITES, update: true, updateContent: 'embed', updateMode: 'minimal',
			});
		} else {
			await page.routeFromHAR(HAR, { url: SITES, notFound: 'fallback' });
			await page.clock.install({ time: meta.time });
		}

		// the list of screens comes from the page, so new screens are tested too
		await page.goto('./', { waitUntil: 'domcontentloaded' });
		const screens = await page.locator('#enabledDisplays input[type=checkbox]')
			.evaluateAll((inputs) => inputs.map((input) => input.id.replace(/-checkbox$/, '')));
		expect(screens.length).toBeGreaterThan(20);

		const params = new URLSearchParams();
		screens.forEach((screen) => params.set(`${screen}-checkbox`, 'true'));
		params.set('latLonQuery', LOCATION.query);
		params.set('latLon', JSON.stringify(LOCATION.latLon));
		params.set('settings-airportIcao-text', LOCATION.airportIcao);
		params.set('settings-airportName-text', LOCATION.airportName);
		params.set('settings-ipmaArea-select', LOCATION.ipmaArea);
		params.set('settings-wide-checkbox', String(wide));
		// as on the TV (TV_SETTINGS in share.mjs)
		params.set('kiosk', 'true');
		params.set('settings-scanLines-checkbox', 'true');
		params.set('settings-versionMark-checkbox', 'true');
		await page.goto(`./?${params}`, { waitUntil: 'domcontentloaded' });

		// every screen has finished loading (loaded, no data, or failed)
		await page.waitForFunction((count) => {
			const labels = [...document.querySelectorAll('#enabledDisplays label')];
			const done = ['press-here', 'failed', 'no-data', 'disabled'];
			return labels.length === count && labels.every((label) => done.some((c) => label.classList.contains(c)));
		}, screens.length, { timeout: 120_000 });
		const statuses = await screenStatuses(page);
		await testInfo.attach('statuses.json', { body: JSON.stringify(statuses, null, 1), contentType: 'application/json' });

		// go through every page of every screen with the Next button
		const loaded = Object.keys(statuses).filter((screen) => statuses[screen] === 'loaded' && !MAY_HAVE_NO_PAGES.includes(screen));
		await page.waitForFunction(() => document.querySelector('.weather-display.show'), null, { timeout: 30_000 });
		const seen = new Set();
		let escaped = false;
		const first = await shownScreen(page);
		let steps = 0;
		for (; steps < 200; steps += 1) {
			const screen = await shownScreen(page);
			seen.add(screen);
			// text from other sites is shown as text: the fixture headline has <b>x</b> and a bare < in it
			if (screen === 'news' && !escaped) {
				escaped = await page.evaluate(() => {
					const news = document.querySelector('#news-html');
					return news.innerText.includes('<b>x</b> & a < b') && !news.querySelector('.news-lines b');
				});
			}
			if (process.env.SCREENSHOTS) {
				await page.locator('#container').screenshot({ path: testInfo.outputPath(`${String(steps).padStart(3, '0')}-${screen}.png`) });
			}
			if (steps > 0 && screen === first && loaded.every((s) => seen.has(s))) break;
			await page.evaluate(() => document.querySelector('#NavigateNext').click());
			// drawing is asynchronous (some screens fetch a little more when shown)
			await page.waitForTimeout(400);
		}

		if (missing.length) await testInfo.attach('not-recorded.txt', { body: [...new Set(missing)].join('\n'), contentType: 'text/plain' });
		if (consoleErrors.length) await testInfo.attach('console-errors.txt', { body: consoleErrors.join('\n'), contentType: 'text/plain' });

		expect(pageErrors, 'page errors').toEqual([]);
		expect(Object.entries(statuses).filter(([, status]) => status === 'failed' || status === 'unknown'), 'failed screens').toEqual([]);
		expect(loaded.filter((screen) => !seen.has(screen)), 'loaded screens never shown').toEqual([]);
		expect(escaped, 'a news headline with < and & must be shown as text').toBe(true);

		if (record) {
			fs.writeFileSync(META, `${JSON.stringify({ time: meta.time, recorded: new Date(meta.time).toISOString(), statuses }, null, '\t')}\n`);
		} else {
			expect(statuses, 'screens that ended differently from the recording').toEqual(meta.statuses);
		}
	});
});

// a link edited by hand: the airport name is shown as text (no script runs), and a location that is not JSON
// does not stop the page from starting
test('a link with odd settings shows the airport name as text', async ({ page }) => {
	const pageErrors = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));
	await page.routeFromHAR(HAR, { url: SITES, notFound: 'fallback' });
	// a location that is not JSON: the page still starts (and asks for a location)
	await page.goto('./?latLonQuery=x&latLon=abc', { waitUntil: 'domcontentloaded' });
	await expect(page.locator('#divTwc')).toBeVisible();
	const params = new URLSearchParams({
		'metar-checkbox': 'true',
		latLonQuery: LOCATION.query,
		latLon: JSON.stringify(LOCATION.latLon),
		'settings-airportIcao-text': LOCATION.airportIcao,
		'settings-airportName-text': '<img src="x" onerror="window.injected = true">',
	});
	await page.goto(`./?${params}`, { waitUntil: 'domcontentloaded' });
	// the other screens that are on by default come first: go on until the Airport METAR is shown
	for (let steps = 0; steps < 100 && !(await page.evaluate(() => document.querySelector('.weather-display.show')?.id === 'metar-html')); steps += 1) {
		await page.evaluate(() => document.querySelector('#NavigateNext').click());
		await page.waitForTimeout(300);
	}
	// the title is drawn (as text, or as the element that a script would make)
	await page.waitForFunction(() => window.injected || document.querySelector('#metar-html .title.dual .top')?.textContent.includes('<img'), null, { timeout: 60_000 });
	expect(await page.evaluate(() => window.injected ?? false)).toBe(false);
	expect(await page.locator('img[src="x"]').count()).toBe(0);
	expect(pageErrors, 'page errors').toEqual([]);
});
