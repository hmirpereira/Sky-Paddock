// Status (Debug mode only): when each source of the Pi service last answered, and a short note (credits, error).
// Comes from /sources.json of skypaddock-hub; anywhere else, or without Debug mode, the screen is skipped.
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import settings from './settings.mjs';
import { plainText } from './utils/text.mjs';
import fillFooter from './utils/footer.mjs';
import { OFF, ON } from './utils/dark-mode.mjs';

const SERVICE_URL = 'http://127.0.0.1:8095/sources.json';
const MUSIC_URL = 'http://127.0.0.1:8095/musica.json';
const NOTE_MAX = 40;
const MUSIC_MAX = 34;
// the Pi 3 is slow while the page starts: the first request gets a long time, the later ones (when the screen shows) a short one
const START_TIMEOUT_MS = 30000;
const REFRESH_TIMEOUT_MS = 5000;
const RETRY_MS = 60000;

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

// the temperature colours of the DietPi banner (G_OBTAIN_CPU_TEMP in dietpi-globals): 70 red, 60 orange, 50 yellow,
// 40 green, 30 cyan, below that cyan too
const tempClass = (temp) => {
	if (temp >= 70) return 'temp-critical';
	if (temp >= 60) return 'temp-hot';
	if (temp >= 50) return 'temp-warm';
	if (temp >= 40) return 'temp-optimal';
	return 'temp-cool';
};

// the Pi's own health: the dot follows the worse of the temperature (same limits as DietPi: 60 "hot", 70 "reducing the life
// of your device") and the free memory
const piLevel = ({ temp, memFreeMb }) => {
	if (temp >= 70 || memFreeMb < 50) return 'bad';
	return temp >= 60 || memFreeMb < 100 ? 'warn' : 'ok';
};

// "Off", "On" or "Auto" with what Auto is doing right now
const modeText = (value, active) => {
	if (Number(value) === OFF) return 'Off';
	if (Number(value) === ON) return 'On';
	return `Auto, ${active ? 'on' : 'off'} now`;
};

const piCard = (display, pi, track) => {
	const card = display.fillTemplate('status-pi', {
		'pi-load': pi.load === null ? 'load ?' : `load ${pi.load.toFixed(2)}`,
		'pi-temp': pi.temp === null ? '? C' : `${pi.temp} C`,
		'pi-mem': pi.memFreeMb === null ? '? MB free' : `${pi.memFreeMb} MB free`,
		'pi-disk': pi.diskFreeGb == null ? '?' : `${pi.diskFreeGb} GB free`,
		'pi-wifi': pi.wifiDbm == null ? 'no Wi-Fi' : `${pi.wifiDbm} dBm`,
		'pi-up': pi.uptimeMin === null ? '?' : `${ago(pi.uptimeMin)}, service ${ago(pi.hubMin)}`,
		'pi-music': plainText(track).slice(0, MUSIC_MAX) || 'none',
		'pi-dark': modeText(settings.darkMode.value, document.querySelector('#divTwc')?.classList.contains('dark-mode')),
	});
	if (pi.temp !== null) card.querySelector('.pi-temp').classList.add(tempClass(pi.temp));
	card.classList.add(pi.temp === null ? 'ok' : piLevel(pi));
	return card;
};

class SourcesStatus extends WeatherDisplay {
	constructor(elemId, defaultActive) {
		super(elemId, 'Status', defaultActive);
		this.timing.baseDelay = 20000;
		// the Debug mode setting switches the screen on and off while the page is open
		window.addEventListener('debug-mode', () => this.getData());
	}

	async getData(weatherParameters) {
		if (!super.getData(weatherParameters)) return;
		if (!settings.debugMode?.value) {
			this.setStatus(STATUS.noData);
			return;
		}
		const data = await this.fetchSources(START_TIMEOUT_MS);
		if (!data) {
			this.setStatus(STATUS.noData);
			// not on the Pi, or the Pi did not answer in time: ask again now and then (a no-op for this screen when it works)
			clearTimeout(this.retry);
			this.retry = setTimeout(() => this.getData(), RETRY_MS);
			return;
		}
		this.timing.totalScreens = 1;
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	// the answer of the Pi service, or null; it is kept for the screen
	async fetchSources(timeout) {
		try {
			const data = await json(SERVICE_URL, { signal: AbortSignal.timeout(timeout) });
			if (!data?.rows?.length) return null;
			this.rows = data.rows;
			this.pi = data.pi;
			return data;
		} catch (error) {
			console.warn('Status: no data from the Pi', error.message);
			return null;
		}
	}

	async drawCanvas() {
		super.drawCanvas();
		// the ages are read when the screen shows; the answer from the start would be hours old (the last one is kept if this fails)
		await this.fetchSources(REFRESH_TIMEOUT_MS);
		const cards = this.rows.filter((row) => row.name !== 'TV page').map((row) => {
			const minutes = row.ok ? minutesSince(row.ok) : null;
			const card = this.fillTemplate('status-card', {
				name: plainText(row.name),
				age: minutes === null ? 'no signal' : ago(minutes),
				note: plainText(row.note ?? '').slice(0, NOTE_MAX),
			});
			card.classList.add(level(minutes, row.limit));
			return card;
		});
		if (this.pi) {
			const track = await json(MUSIC_URL, { signal: AbortSignal.timeout(3000) }).then((d) => d.track ?? '', () => '');
			cards.push(piCard(this, this.pi, track));
		}
		const grid = this.elem.querySelector('.status-grid');
		grid.innerHTML = '';
		grid.append(...cards);
		fillFooter(this.elem, [], 0, 1);
		this.finishDraw();
	}
}

// register display (on by default; it only shows with Debug mode and on the Pi running skypaddock-hub)
registerDisplay(new SourcesStatus('status', true));
