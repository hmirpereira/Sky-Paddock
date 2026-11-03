// Status (Debug mode only): when each source of the Pi service last answered, and a short note (credits, error).
// Comes from /sources.json of skypaddock-hub; anywhere else, or without Debug mode, the screen is skipped.
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import settings from './settings.mjs';
import { plainText } from './utils/text.mjs';
import fillFooter from './utils/footer.mjs';

const SERVICE_URL = 'http://127.0.0.1:8095/sources.json';
const NOTE_MAX = 40;

const minutesSince = (iso) => Math.round((Date.now() - Date.parse(iso)) / 60000);

// "now", "5 min", "3 h" or "2 d"
const ago = (minutes) => {
	if (minutes < 1) return 'now';
	if (minutes < 60) return `${minutes} min`;
	if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h`;
	return `${Math.round(minutes / 1440)} d`;
};

// ok until the limit of the source (set by the Pi service), warn until twice that, then bad; never answered is bad
const level = (minutes, limit) => {
	if (minutes === null) return 'bad';
	if (!limit || minutes < limit) return 'ok';
	return minutes < 2 * limit ? 'warn' : 'bad';
};

// the Pi's own health: the dot follows the worse of the temperature (the Pi 3 throttles from 80 C) and the free memory
const piLevel = ({ temp, memFreeMb }) => {
	if (temp >= 80 || memFreeMb < 50) return 'bad';
	return temp >= 70 || memFreeMb < 100 ? 'warn' : 'ok';
};

const piCard = (display, pi) => {
	const card = display.fillTemplate('status-pi', {
		'pi-temp': pi.temp === null ? '? C' : `${pi.temp} C`,
		'pi-mem': pi.memFreeMb === null ? '? MB free' : `${pi.memFreeMb} MB free`,
		'pi-up': pi.uptimeMin === null ? '?' : ago(pi.uptimeMin),
	});
	card.classList.add(pi.temp === null ? 'ok' : piLevel(pi));
	return card;
};

class SourcesStatus extends WeatherDisplay {
	constructor(elemId, defaultActive) {
		super(elemId, 'Status', defaultActive);
		this.timing.baseDelay = 12000;
		// the Debug mode setting switches the screen on and off while the page is open
		window.addEventListener('debug-mode', () => this.getData());
	}

	async getData(weatherParameters) {
		if (!super.getData(weatherParameters)) return;
		if (!settings.debugMode?.value) {
			this.setStatus(STATUS.noData);
			return;
		}
		let data = null;
		try {
			data = await json(SERVICE_URL, { signal: AbortSignal.timeout(5000) });
		} catch (error) {
			console.warn('Status: no data from the Pi', error.message);
		}
		const rows = data?.rows ?? [];
		if (rows.length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.rows = rows;
		this.pi = data.pi;
		this.timing.totalScreens = 1;
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		const cards = this.rows.map((row) => {
			const minutes = row.ok ? minutesSince(row.ok) : null;
			const card = this.fillTemplate('status-card', {
				name: plainText(row.name),
				age: minutes === null ? 'no signal' : ago(minutes),
				note: plainText(row.note ?? '').slice(0, NOTE_MAX),
			});
			card.classList.add(level(minutes, row.limit));
			return card;
		});
		if (this.pi) cards.push(piCard(this, this.pi));
		const grid = this.elem.querySelector('.status-grid');
		grid.innerHTML = '';
		grid.append(...cards);
		fillFooter(this.elem, [], 0, 1);
		this.finishDraw();
	}
}

// register display (on by default; it only shows with Debug mode and on the Pi running skypaddock-hub)
registerDisplay(new SourcesStatus('status', true));
