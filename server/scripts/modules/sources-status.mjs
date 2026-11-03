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
const ROWS_PER_PAGE = 6;
const NOTE_MAX = 18;

// "now", "5 min", "3 h" or "2 d" since the time of the last answer
const ago = (iso) => {
	const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
	if (minutes < 1) return 'now';
	if (minutes < 60) return `${minutes} min`;
	if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h`;
	return `${Math.round(minutes / 1440)} d`;
};

class SourcesStatus extends WeatherDisplay {
	constructor(elemId, defaultActive) {
		super(elemId, 'Status', defaultActive);
		this.timing.baseDelay = 10000;
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
		this.pages = [];
		const pageCount = Math.ceil(rows.length / ROWS_PER_PAGE);
		const perPage = Math.ceil(rows.length / pageCount);
		for (let i = 0; i < rows.length; i += perPage) this.pages.push(rows.slice(i, i + perPage));
		this.timing.totalScreens = this.pages.length;
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		const pageIndex = Math.min(Math.max(this.screenIndex, 0), this.pages.length - 1);
		const lines = this.pages[pageIndex].map((row) => {
			const line = this.fillTemplate('status-row', {
				name: plainText(row.name),
				age: row.ok ? ago(row.ok) : 'no signal',
				note: plainText(row.note ?? '').slice(0, NOTE_MAX),
			});
			line.classList.toggle('silent', !row.ok);
			return line;
		});
		const list = this.elem.querySelector('.status-lines');
		list.innerHTML = '';
		list.append(...lines);
		fillFooter(this.elem, [], pageIndex, this.pages.length);
		this.finishDraw();
	}
}

// register display (on by default; it only shows with Debug mode and on the Pi running skypaddock-hub)
registerDisplay(new SourcesStatus('status', true));
