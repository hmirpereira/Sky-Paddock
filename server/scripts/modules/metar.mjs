// airport observation (METAR) display, decoded into plain English
import STATUS from './status.mjs';
import { text } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import decodeMetar from './utils/metar-decoder.mjs';
import { airport, loadAirportCity, placeTitle } from './utils/local-place.mjs';
import fillFooter from './utils/footer.mjs';

// metar.vatsim.net mirrors real-world METARs and allows browser (CORS) requests without a key
const METAR_URL = (icao) => `https://metar.vatsim.net/${icao}`;

class Metar extends WeatherDisplay {
	constructor(elemId, defaultActive) {
		super(elemId, 'Airport METAR', defaultActive);

		// set timings (seconds on screen)
		this.timing.baseDelay = 12000;
	}

	async getData(_weatherParameters) {
		if (!super.getData(_weatherParameters)) return;

		// no airport set: nothing to show
		const { icao } = airport();
		if (!icao) {
			this.setStatus(STATUS.noData);
			return;
		}
		const [metar] = await Promise.all([getMetar(icao), loadAirportCity()]);
		if (!metar) {
			this.setStatus(STATUS.failed);
			return;
		}

		// busy reports are split over several pages instead of squeezing the text
		this.pages = metarPages(metar);
		this.timing.totalScreens = this.pages.length;

		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();

		const pageIndex = Math.min(Math.max(this.screenIndex, 0), this.pages.length - 1);
		const { rows, raw } = this.pages[pageIndex];

		const lines = rows.map(([label, value]) => this.fillTemplate('metar-row', { label, value }));

		const list = this.elem.querySelector('.metar-lines');
		list.innerHTML = '';
		list.append(...lines);

		const rawElem = this.elem.querySelector('.metar-raw');
		rawElem.textContent = raw;

		// spread the rows over the space left above the raw report
		const main = this.elem.querySelector('.main');
		const available = main.clientHeight - rawElem.offsetHeight - this.elem.querySelector('.source-footer').offsetHeight - 24;
		list.style.height = `${Math.max(available, 0)}px`;

		this.elem.querySelector('.header .title.dual .top').textContent = placeTitle('Airport');
		this.elem.querySelector('.header .title.dual .bottom').innerHTML = `${airport().icao} METAR`;
		fillFooter(this.elem, [], pageIndex, this.pages.length);

		this.finishDraw();
	}
}

// decoded lines per page that fit with comfortable spacing, with and without the raw report
const ROWS_WITH_RAW = 7;
const ROWS_WITHOUT_RAW = 10;

const getMetar = async (icao) => {
	try {
		const raw = (await text(METAR_URL(icao))).trim().split('\n')[0];
		if (!raw) throw new Error('Empty METAR response');
		return decodeMetar(raw);
	} catch (error) {
		console.error(`Metar: unable to get METAR for ${icao}`, error);
		return null;
	}
};

const metarPages = (data) => {
	const rows = buildRows(data);
	// pages are balanced (13 rows -> 7 + 6, not 10 + 3)
	const fitsWithRaw = rows.length <= ROWS_WITH_RAW;
	const pageCount = fitsWithRaw ? 1 : Math.ceil(rows.length / ROWS_WITHOUT_RAW);
	const perPage = Math.ceil(rows.length / pageCount);
	const pages = [];
	for (let i = 0; i < rows.length; i += perPage) {
		const page = rows.slice(i, i + perPage).map((row) => [...row]);
		// a page that starts mid-group (e.g. the third cloud layer) repeats the group label
		if (page[0][0] === '') page[0][0] = rows.slice(0, i).reverse().find((row) => row[0])?.[0] ?? '';
		pages.push({ rows: page, raw: '' });
	}
	// the raw report goes on the last page, only if that page has room for it
	const last = pages.at(-1);
	if (last.rows.length <= ROWS_WITH_RAW) last.raw = data.raw;
	return pages;
};

// decoded METAR as [label, value] rows; continuation lines have an empty label
const buildRows = (d) => {
	const rows = [];

	if (d.observed) {
		const hh = String(d.observed.getUTCHours()).padStart(2, '0');
		const mm = String(d.observed.getUTCMinutes()).padStart(2, '0');
		rows.push(['Observed', `${hh}:${mm} UTC (${d.ageMinutes} min ago)`]);
	}
	if (d.wind) rows.push(['Wind', d.wind]);
	if (d.windVariable) rows.push(['', d.windVariable]);
	if (d.visibility) rows.push(['Visibility', d.visibility]);
	d.weather.forEach((weather, index) => rows.push([index === 0 ? 'Weather' : '', weather]));
	d.clouds.forEach((cloud, index) => rows.push([index === 0 ? 'Clouds' : '', cloud]));
	if (d.temperature !== null) {
		const dew = d.dewPoint !== null ? `, dew point ${d.dewPoint}°C` : '';
		rows.push(['Temperature', `${d.temperature}°C${dew}`]);
	}
	if (d.humidity !== null) rows.push(['Humidity', `${d.humidity}%`]);
	if (d.pressure) rows.push(['Pressure', d.pressure]);
	if (d.trend) rows.push(['Trend', d.trend]);

	return rows;
};

// register display
registerDisplay(new Metar('metar', true));
