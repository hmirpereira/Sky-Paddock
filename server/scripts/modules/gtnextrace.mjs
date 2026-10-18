// GT World Challenge Europe, next event: track outline, event, cup, place with flag, track length and turns,
// race date and countdown (page 1); weekend timetable in Portuguese time and the forecast at the circuit
// for the start of the main race (page 2). Same layout as F1 Next Race.
// The skypaddock-hub service on the Pi reads the event page of the official site and serves it in /gt.json
// ('next'); anywhere else this screen is skipped. Outlines and positions: utils/gt-circuits.mjs.
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import ConversionHelpers from './utils/conversionHelpers.mjs';
import { getConditionText } from './utils/weather.mjs';
import { getWeatherRegionalIconFromIconLink } from './icons.mjs';
import GT_CIRCUITS from './utils/gt-circuits.mjs';

const SERVICE_URL = 'http://127.0.0.1:8095/gt.json';
const LOCAL_TZ = 'Europe/Lisbon';
// the event is treated as over this long after the start of its last race
const RACE_DURATION_HOURS = 4;
const MAX_ROWS = 6;
// flags are named after the F1 countries
const FLAG_ALIASES = { 'great-britain': 'uk', 'united-kingdom': 'uk', england: 'uk' };

// the Star4000 fonts draw accented letters blank, so accents are removed
const stripAccents = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (text) => stripAccents(text).toLowerCase().trim().replace(/\s+/g, '-');

const findCircuit = (event) => {
	const name = stripAccents(event).toLowerCase();
	return GT_CIRCUITS.find((c) => c.match.some((word) => name.includes(word)));
};

// shorter session names so they fit the row
const sessionName = (name) => stripAccents(name)
	.replace(/^Free Practice/i, 'Practice')
	.replace(/\s+Combined$/i, '')
	.replace(/^Main Race$/i, 'Race');

const isRace = (name) => /race/i.test(name);

// forecast for the hour the main race starts, only when it is within Open-Meteo's 16 days
const getForecast = async (start, circuit) => {
	if (!start || !circuit?.lat) return null;
	const time = DateTime.fromISO(start).toUTC();
	if (time > DateTime.now().plus({ days: 15 })) return null;
	try {
		const day = time.toISODate();
		const response = await json(`https://api.open-meteo.com/v1/forecast?latitude=${circuit.lat}&longitude=${circuit.lon}&hourly=weather_code,temperature_2m,precipitation_probability,is_day&timezone=GMT&start_date=${day}&end_date=${day}`);
		const index = response?.hourly?.time?.indexOf(time.startOf('hour').toFormat("yyyy-MM-dd'T'HH:mm"));
		if (index === undefined || index < 0) return null;
		const condition = getConditionText(Number(response.hourly.weather_code[index]));
		return {
			condition,
			icon: getWeatherRegionalIconFromIconLink(condition, response.hourly.is_day[index]),
			temperature: Math.round(ConversionHelpers.convertTemperatureUnits(response.hourly.temperature_2m[index])),
			rain: response.hourly.precipitation_probability[index],
		};
	} catch (error) {
		console.error('GT World Next: unable to get the forecast', error);
		return null;
	}
};

class GtNextRace extends WeatherDisplay {
	constructor(navId, elemId, defaultActive) {
		super(navId, elemId, 'GT World Next Event', defaultActive);

		// two pages, 10 seconds each
		this.timing.baseDelay = 10000;
		this.timing.totalScreens = 2;
	}

	async getData(weatherParameters) {
		if (!super.getData(weatherParameters)) return;
		let data = null;
		try {
			data = await json(SERVICE_URL, { signal: AbortSignal.timeout(5000) });
		} catch (error) {
			console.warn('GT World Next: no data from the Pi', error.message);
		}
		const next = data?.next;
		const all = (next?.sessions ?? []).filter((s) => s.start);
		// "Qualifying Combined" is the combined result of Q1 to Q3 and starts with Q1: drop it when the parts are listed
		const sessions = all
			.filter((s) => !(/combined/i.test(s.name) && all.some((o) => o !== s && o.start === s.start)))
			.sort((a, b) => a.start.localeCompare(b.start));
		const last = sessions.at(-1)?.start;
		const end = last ?? next?.race;
		// no event announced, or the last session is over: skip the screen
		if (!next?.event || (end && DateTime.fromISO(end) < DateTime.now().minus({ hours: RACE_DURATION_HOURS }))) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.next = { ...next, sessions };
		this.circuit = findCircuit(next.event);
		this.forecast = await getForecast(next.race, this.circuit);

		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		const { next } = this;
		const page = Math.min(Math.max(this.screenIndex, 0), 1);

		this.elem.querySelector('.f1-race-page.info').style.display = page === 0 ? 'block' : 'none';
		this.elem.querySelector('.f1-race-page.weekend').style.display = page === 1 ? 'block' : 'none';
		this.elem.querySelector('.header .title.dual .top').innerHTML = 'GT World Next';
		const round = next.round ? `Round ${next.round}` : 'Event';
		this.elem.querySelector('.header .title.dual .bottom').innerHTML = page === 0 ? round : 'Weekend';

		if (page === 0) this.drawInfo(next);
		else this.drawWeekend(next);

		this.finishDraw();
	}

	drawInfo(next) {
		// track outline
		const svg = this.elem.querySelector('.track svg');
		const { circuit } = this;
		if (circuit?.path) {
			svg.setAttribute('viewBox', `-40 -40 ${circuit.w + 80} ${circuit.h + 80}`);
			svg.querySelector('.outline').setAttribute('points', circuit.path);
			svg.querySelector('.outline-shadow').setAttribute('points', circuit.path);
			svg.style.visibility = 'visible';
		} else {
			svg.style.visibility = 'hidden';
		}
		// without an outline the details use the whole width
		this.elem.querySelector('.f1-race-page.info').classList.toggle('no-track', !circuit?.path);

		let date = next.dates ?? '';
		let countdown = '';
		if (next.race) {
			const start = DateTime.fromISO(next.race).setZone(LOCAL_TZ);
			const days = Math.round(start.startOf('day').diff(DateTime.now().setZone(LOCAL_TZ).startOf('day'), 'days').days);
			countdown = `In ${days} days`;
			if (days === 1) countdown = 'Tomorrow';
			if (days <= 0) countdown = 'Race day';
			date = `Race ${start.toFormat('ccc d LLL')}`;
		}
		const track = [next.length ? next.length.replace(/\s*km$/i, ' km') : '', next.turns ? `${next.turns} turns` : ''].filter(Boolean).join(', ');

		const lines = [
			['name', next.event],
			['circuit', circuit?.name ?? ''],
			['cup', next.cup ?? ''],
			['place', next.country ?? ''],
			['length', track],
			['date', date],
			['countdown', countdown],
		].filter(([, text]) => text);
		// at most six lines: the circuit name goes first if there are more
		if (lines.length > 6) lines.splice(lines.findIndex(([cls]) => cls === 'circuit'), 1);

		const info = this.elem.querySelector('.race-info');
		info.innerHTML = '';
		lines.forEach(([cls, text]) => {
			const div = document.createElement('div');
			div.className = cls;
			div.textContent = stripAccents(text);
			// 8-bit flag after the country: images/flags/<country>.png (hidden if missing)
			if (cls === 'place') {
				const flag = document.createElement('img');
				flag.className = 'flag';
				flag.alt = '';
				flag.addEventListener('error', () => flag.remove());
				const country = slug(next.country);
				flag.src = `images/flags/${FLAG_ALIASES[country] ?? country}.png`;
				div.append(flag);
			}
			info.append(div);
		});

		// shrink lines that do not fit, down to 70%
		info.querySelectorAll(':scope > div').forEach((div) => {
			let size = parseFloat(window.getComputedStyle(div).fontSize);
			const minimum = size * 0.7;
			while (div.clientWidth > 0 && div.scrollWidth > div.clientWidth && size > minimum) {
				size -= 1;
				div.style.fontSize = `${size}px`;
			}
		});
	}

	drawWeekend(next) {
		// a sprint weekend can have more sessions than rows: keep the last ones (qualifying and races)
		const sessions = next.sessions.slice(-MAX_ROWS);
		const rows = sessions.map((session) => {
			const start = DateTime.fromISO(session.start).setZone(LOCAL_TZ);
			const row = this.fillTemplate('session-row', {
				day: start.toFormat('ccc d'),
				session: sessionName(session.name),
				time: ConversionHelpers.formatTime(start),
			});
			if (isRace(session.name)) row.classList.add('race');
			return row;
		});
		const list = this.elem.querySelector('.session-lines');
		list.innerHTML = '';
		list.append(...rows);

		const forecast = this.elem.querySelector('.race-forecast');
		if (this.forecast) {
			forecast.querySelector('.icon img').src = this.forecast.icon;
			forecast.querySelector('.text').innerHTML = `Race: ${this.forecast.condition}, ${this.forecast.temperature}°${ConversionHelpers.getTemperatureUnitText()}, rain ${this.forecast.rain ?? 0}%`;
			forecast.style.visibility = 'visible';
		} else {
			forecast.style.visibility = 'hidden';
		}
	}
}

// register display (off by default: it only works on the Pi running skypaddock-hub)
registerDisplay(new GtNextRace(24, 'gt-next-race', false));
