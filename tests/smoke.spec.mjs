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
import jolpicaResponses from './f1-fixtures.mjs';
import { DateTime } from '../server/scripts/vendor/auto/luxon.mjs';

const test = base.extend({ record: [false, { option: true }] });

const RECORDED = path.resolve('tests', 'recorded');
const HAR = path.join(RECORDED, 'sites.har');
const META = path.join(RECORDED, 'recorded.json');
// what is recorded and replayed: every https site
const SITES = /^https:\/\//;
const TILE = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#222"/><path d="M0 128H256M128 0V256" stroke="#888" stroke-width="2"/><circle cx="128" cy="128" r="60" fill="none" stroke="#666" stroke-width="6"/></svg>';
const PHOTO = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#222"/><circle cx="450" cy="300" r="200" fill="#e10600"/></svg>';

// a public place, not anyone's home
const LOCATION = {
	query: 'Lisbon, PRT', latLon: { lat: 38.7223, lon: -9.1393 }, airportIcao: 'LPPT', ipmaArea: '11',
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
		// the Content-Security-Policy of the page (csp.mjs) refuses anything that is not listed: every refusal is a failure
		await page.addInitScript(() => {
			window.cspViolations = [];
			document.addEventListener('securitypolicyviolation', (event) => window.cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`));
		});

		// anything outside the page and the Pi that was not recorded is refused (and listed)
		const missing = [];
		if (!record) {
			await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (route) => {
				missing.push(route.request().url());
				return route.abort();
			});
		}
		// the Overhead radar map: made-up tiles (a grid), or the real ones with LIVE_TILES=1 to look at the map
		await page.route('https://tile.openstreetmap.org/**', (route) => {
			if (process.env.LIVE_TILES) return route.continue();
			return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: TILE });
		});
		await page.route('http://127.0.0.1:8095/**', (route) => {
			const answer = pi[new URL(route.request().url()).pathname];
			// the F1 Photo is a picture, not JSON: a made-up one (3:2, red and black)
			if (['/f1photo.jpg', '/plexnow-poster-10.jpg', '/plexnow-avatar-4.jpg'].includes(new URL(route.request().url()).pathname)) {
				return route.fulfill({
					status: 200, contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' }, body: PHOTO,
				});
			}
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
		// Jolpica F1 is made up too (registered after the recording, so it wins over it) (tests/f1-fixtures.mjs), so the F1 screens do not depend on the day the sites were recorded
		const jolpica = jolpicaResponses(meta.time);
		await page.route('https://api.jolpi.ca/**', (route) => {
			const answer = jolpica[new URL(route.request().url()).pathname];
			if (!answer) return route.fulfill({ status: 404, body: '' });
			return route.fulfill({
				status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(answer),
			});
		});

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
		params.set('settings-ipmaArea-select', LOCATION.ipmaArea);
		params.set('settings-wide-checkbox', String(wide));
		// as on the TV (TV_SETTINGS in share.mjs)
		params.set('kiosk', 'true');
		params.set('settings-scanLines-checkbox', 'true');
		params.set('settings-debugMode-checkbox', 'true');
		// other settings for a look at the screenshots: EXTRA_PARAMS="settings-personalGates-select=1.00"
		new URLSearchParams(process.env.EXTRA_PARAMS ?? '').forEach((value, key) => params.set(key, value));
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
		expect(await page.evaluate(() => window.cspViolations), 'Content-Security-Policy violations (add the host to csp.mjs)').toEqual([]);
		expect(await page.evaluate(() => !!document.querySelector('meta[http-equiv="Content-Security-Policy"]')), 'the page has its Content-Security-Policy').toBe(true);
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

// the city of the airport comes from the Pi service and is shown as text (no script runs); a link edited by hand with a location that is not JSON
// does not stop the page from starting
test('a link with odd settings shows the airport city as text', async ({ page }) => {
	const pageErrors = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));
	await page.routeFromHAR(HAR, { url: SITES, notFound: 'fallback' });
	// the time of the recording, like the other tests: with the real date the recorded forecast stops covering today
	await page.clock.install({ time: readMeta().time });
	// a location that is not JSON: the page still starts (and asks for a location)
	await page.route('http://127.0.0.1:8095/airport.json*', (route) => route.fulfill({
		status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ icao: 'LPPT', city: '<b>x</b>' }),
	}));
	await page.goto('./?latLonQuery=x&latLon=abc', { waitUntil: 'domcontentloaded' });
	await expect(page.locator('#divTwc')).toBeVisible();
	const params = new URLSearchParams({
		'metar-checkbox': 'true',
		latLonQuery: LOCATION.query,
		latLon: JSON.stringify(LOCATION.latLon),
		'settings-airportIcao-text': LOCATION.airportIcao,
	});
	await page.goto(`./?${params}`, { waitUntil: 'domcontentloaded' });
	// the other screens that are on by default come first: go on until the Airport METAR is shown
	for (let steps = 0; steps < 100 && !(await page.evaluate(() => document.querySelector('.weather-display.show')?.id === 'metar-html')); steps += 1) {
		await page.evaluate(() => document.querySelector('#NavigateNext').click());
		await page.waitForTimeout(300);
	}
	// the title is drawn as text (the tags are visible), not as the element they would make
	await page.waitForFunction(() => document.querySelector('#metar-html .title.dual .top')?.textContent.includes('<b>'), null, { timeout: 60_000 });
	expect(await page.locator('#metar-html .title.dual .top b').count()).toBe(0);
	expect(pageErrors, 'page errors').toEqual([]);
});

// loads the built site with the recorded answers and the made-up answers of the Pi (`pi`), with only the screens in `on` turned on
// (null: all of them); `extra`: other parameters of the address
const openRotation = async (page, pi, on, extra = {}) => {
	const meta = readMeta();
	await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: TILE }));
	await page.route('http://127.0.0.1:8095/**', (route) => {
		const answer = pi[new URL(route.request().url()).pathname];
		if (!answer) return route.fulfill({ status: 404, body: '' });
		return route.fulfill({
			status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(answer),
		});
	});
	await page.routeFromHAR(HAR, { url: SITES, notFound: 'fallback' });
	await page.clock.install({ time: meta.time });
	await page.goto('./', { waitUntil: 'domcontentloaded' });
	const screens = await page.locator('#enabledDisplays input[type=checkbox]')
		.evaluateAll((inputs) => inputs.map((input) => input.id.replace(/-checkbox$/, '')));
	const params = new URLSearchParams();
	screens.forEach((screen) => params.set(`${screen}-checkbox`, String(!on || on.includes(screen))));
	params.set('latLonQuery', LOCATION.query);
	params.set('latLon', JSON.stringify(LOCATION.latLon));
	params.set('settings-airportIcao-text', LOCATION.airportIcao);
	params.set('settings-ipmaArea-select', LOCATION.ipmaArea);
	Object.entries(extra).forEach(([key, value]) => params.set(key, value));
	await page.goto(`./?${params}`, { waitUntil: 'domcontentloaded' });
	await page.waitForFunction(() => document.querySelector('.weather-display.show'), null, { timeout: 90_000 });
};

// within 3 hours of the start of a shift the aviation screens go round 4 times before the rotation moves on; further away, once
[[2, 4], [5, 1]].forEach(([hours, passes]) => {
	test(`the aviation screens go round ${passes} time(s) when the shift starts in ${hours} hours`, async ({ page, record }) => {
		test.skip(record, 'it does not ask the sites');
		test.setTimeout(240_000);
		const meta = readMeta();
		const pi = piResponses(meta.time);
		// the first day has one shift, starting `hours` hours after the page clock
		const start = DateTime.fromMillis(meta.time, { zone: 'Europe/Lisbon' }).plus({ hours });
		pi['/schedule.json'].days = [{
			date: start.toISODate(), code: 'M', start: start.toFormat('HH:mm'), end: start.plus({ hours: 8 }).toFormat('HH:mm'), off: false,
		}];
		// only the aviation screens and the News, so the rotation leaves the aviation block for a screen that is easy to see
		await openRotation(page, pi, ['work-schedule', 'metar', 'departures', 'cancellations', 'overhead', 'news']);
		// walk the rotation: count the times the Airport METAR is entered, until the News is shown
		let entered = 0;
		let last = null;
		for (let steps = 0; steps < 400; steps += 1) {
			// eslint-disable-next-line no-await-in-loop
			const shown = await shownScreen(page);
			if (shown === 'metar' && last !== 'metar') entered += 1;
			if (shown === 'news') break;
			last = shown;
			// eslint-disable-next-line no-await-in-loop
			await page.evaluate(() => document.querySelector('#NavigateNext').click());
			// eslint-disable-next-line no-await-in-loop
			await page.waitForTimeout(150);
		}
		expect(await shownScreen(page)).toBe('news');
		expect(entered).toBe(passes);
	});
});

// work mode (a break room): with every screen turned on, only the screens for it are shown, and of the Work Schedule only the Gates page, of everybody's gates
test('work mode shows only Work Schedule (Gates), Departures, Cancellations, Overhead and METAR', async ({ page, record }) => {
	test.skip(record, 'it does not ask the sites');
	test.setTimeout(240_000);
	const pi = piResponses(readMeta().time);
	await openRotation(page, pi, null, { 'settings-workMode-checkbox': 'true' });
	const seen = new Set();
	const titles = new Set();
	let radar = [];
	const radarTitles = new Set();
	for (let steps = 0; steps < 150; steps += 1) {
		// eslint-disable-next-line no-await-in-loop
		const shown = await shownScreen(page);
		seen.add(shown);
		// eslint-disable-next-line no-await-in-loop
		if (shown === 'overhead') {
			radarTitles.add(await page.locator('#overhead-html .header .title.dual .bottom').textContent());
			// eslint-disable-next-line no-await-in-loop
			radar = await page.locator('#overhead-html .overhead-lines .dist').allTextContents();
		}
		// eslint-disable-next-line no-await-in-loop
		if (shown === 'work-schedule') titles.add(await page.locator('#work-schedule-html .header .title.dual .bottom').textContent());
		// eslint-disable-next-line no-await-in-loop
		await page.evaluate(() => document.querySelector('#NavigateNext').click());
		// eslint-disable-next-line no-await-in-loop
		await page.waitForTimeout(100);
	}
	expect([...seen].sort()).toEqual(['cancellations', 'departures', 'metar', 'overhead', 'work-schedule']);
	expect([...titles].every((title) => title.startsWith('All Gates'))).toBe(true);
	// the Overhead is the radar page only, measured from the airport of the settings (not from home): the distances are those from the airport
	expect([...radarTitles]).toEqual(['Within 50 km']);
	const airport = pi['/airport.json'];
	const km = (a, b) => {
		const rad = (d) => (d * Math.PI) / 180;
		const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
		return 2 * 6371 * Math.asin(Math.sqrt(h));
	};
	const expected = pi['/overhead.json'].aircraft.filter((ac) => !ac.ground).map((ac) => km(airport, ac)).filter((d) => d <= 50).map((d) => String(Math.round(d)))
		.sort();
	expect(radar.sort()).toEqual(expected);
});
