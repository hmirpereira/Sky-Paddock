// GT World Challenge Europe: result of the latest race(s), one page per race (a sprint weekend has two),
// with the highlighted team's car(s) (Verstappen's, set on the Pi) marked in the list and always shown: a car below
// the visible rows takes the last row, after a gap line. Team logos replace names where the owner supplied one. The skypaddock-hub
// service on the Pi reads the public pages of the official site (no API, no CORS) and serves /gt.json;
// anywhere else this screen is skipped.
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
// eslint-disable-next-line import/no-cycle
import settings from './settings.mjs';
import gtTeamLogo from './utils/gt-team-logos.mjs';

const SERVICE_URL = 'http://127.0.0.1:8095/gt.json';
const ROWS = 8;
const stripAccents = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const surname = (name) => stripAccents(name).trim().split(/\s+/).slice(-1)[0] ?? '';
const drivers = (row) => row.drivers.map(surname).join('/');
const gap = (row) => {
	if (row.pos === 1) return 'Winner';
	return row.gap ? `+${row.gap.replace(/^\+/, '')}` : '';
};

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
		this.elem.querySelector('.header .title.dual .bottom').textContent = stripAccents(race.race);
		this.elem.querySelector('.gt-event').textContent = stripAccents(`${data.event} ${data.season}${data.dates ? `   ${data.dates}` : ''}`);

		// first rows, with the highlighted car(s) moved into the last rows when they finished further down
		const mine = race.results.map((r, index) => ({ r, index })).filter(({ r }) => r.highlight).slice(0, 2);
		const outside = (n) => mine.filter(({ index }) => index >= ROWS - n).length;
		let moved = 0;
		while (outside(moved) > moved) moved += 1;
		const below = mine.filter(({ index }) => index >= ROWS - moved);
		const list = [...race.results.slice(0, ROWS - moved).map((r, index) => ({ r, index })), ...below];
		const useLogos = settings.gtTeamLogos?.value ?? true;
		const rows = list.map(({ r, index }, i) => {
			const row = this.fillTemplate('gt-row', {
				pos: String(r.pos),
				car: `#${r.car}`,
				drivers: drivers(r),
				team: stripAccents(r.team),
				gap: gap(r),
			});
			if (r.drivers.length > 2) row.classList.add('three');
			if (r.highlight) row.classList.add('highlight');
			// gap line where positions are skipped (a car pulled up from below)
			if (i > 0 && index > list[i - 1].index + 1) row.classList.add('jump');
			const logo = useLogos && gtTeamLogo(r.team);
			if (logo) {
				const team = row.querySelector('.team');
				const img = document.createElement('img');
				img.alt = '';
				img.src = `images/gt-teams/${logo}`;
				// no logo file: back to the name
				img.addEventListener('error', () => { team.textContent = stripAccents(r.team); });
				team.textContent = '';
				team.classList.add('logo');
				team.append(img);
			}
			return row;
		});
		const lines = this.elem.querySelector('.gt-lines');
		lines.innerHTML = '';
		lines.append(...rows);
		this.finishDraw();
	}
}

// register display (off by default: it only works on the Pi running skypaddock-hub)
registerDisplay(new GtRace(23, 'gt-race', false));
