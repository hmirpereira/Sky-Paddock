// GT World Challenge Europe: result of the latest race(s), one page per race (a sprint weekend has two),
// with the highlighted team (Verstappen's, set on the Pi) always shown on a light band. The skypaddock-voos
// service on the Pi reads the public pages of the official site (no API, no CORS) and serves /gt.json;
// anywhere else this screen is skipped.
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';

const SERVICE_URL = 'http://127.0.0.1:8095/gt.json';
const ROWS = 7;
const stripAccents = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const surname = (name) => stripAccents(name).trim().split(/\s+/).slice(-1)[0] ?? '';
const drivers = (row) => row.drivers.map(surname).join('/');
const gap = (row) => {
	if (row.pos === 1) return 'Winner';
	return row.gap ? `+${row.gap.replace(/^\+/, '')}` : '';
};
const ordinal = (n) => `P${n}`;

class GtRace extends WeatherDisplay {
	constructor(navId, elemId, defaultActive) {
		super(navId, elemId, 'GT World Race', defaultActive);
		this.timing.baseDelay = 12000;
	}

	async getData(weatherParameters) {
		if (!super.getData(weatherParameters)) return;
		try {
			this.data = await json(SERVICE_URL, { signal: AbortSignal.timeout(5000) });
		} catch (error) {
			console.warn('GT World: no data from the Pi', error.message);
			this.data = null;
		}
		if (!this.data?.races?.length) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.timing.totalScreens = this.data.races.length;
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		const { data } = this;
		const race = data.races[Math.min(Math.max(this.screenIndex, 0), data.races.length - 1)];
		this.elem.querySelector('.header .title.dual .top').innerHTML = 'GT World';
		this.elem.querySelector('.header .title.dual .bottom').innerHTML = stripAccents(race.race);
		this.elem.querySelector('.gt-event').textContent = stripAccents(`${data.event} ${data.season}${data.dates ? `   ${data.dates}` : ''}`);

		// the highlighted team: position, car and drivers of each of its cars
		const mine = race.results.filter((r) => r.highlight);
		const box = this.elem.querySelector('.gt-highlight');
		box.innerHTML = '';
		if (mine.length) {
			mine.slice(0, 2).forEach((r) => {
				const line = document.createElement('div');
				line.innerHTML = `<span class="who">${ordinal(r.pos)}</span>  #${r.car} ${drivers(r)}  ${gap(r)}`;
				box.append(line);
			});
			const team = document.createElement('div');
			if (mine.length === 1) team.textContent = stripAccents(mine[0].team);
			box.append(team);
		} else {
			box.textContent = `${stripAccents(data.highlight ?? '')}: not classified`;
		}

		const rows = race.results.slice(0, ROWS).map((r) => {
			const row = this.fillTemplate('gt-row', {
				pos: String(r.pos),
				car: `#${r.car}`,
				drivers: drivers(r),
				team: stripAccents(r.team),
				gap: gap(r),
			});
			if (r.drivers.length > 2) row.classList.add('three');
			if (r.highlight) row.classList.add('highlight');
			return row;
		});
		const list = this.elem.querySelector('.gt-lines');
		list.innerHTML = '';
		list.append(...rows);
		this.finishDraw();
	}
}

// register display (off by default: it only works on the Pi running skypaddock-voos)
registerDisplay(new GtRace(27, 'gt-race', false));
