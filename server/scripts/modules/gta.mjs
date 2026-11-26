// GTA VI on PC: how close the community projects are to running the leaked Xbox build on a PC.
// The leader with its progress bar (0 to 100 on the PortWatch VI ladder: exe runs, first frame, menu, world, playable,
// then story, picture, speed and stability), the next three projects, whether the missing executable is out and the
// latest headline. The skypaddock-hub service on the Pi reads the public tracker of portwatch-vi.xyz every 3 hours and
// serves it in /gta.json; anywhere else this screen is skipped. Scores are PortWatch VI's estimates, not ours.
import { DateTime } from 'luxon';
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { plainText } from './utils/text.mjs';

const SERVICE_URL = 'http://127.0.0.1:8095/gta.json';
const LOCAL_TZ = 'Europe/Lisbon';
// the Pi asks every 3 hours: older than this and the screen is skipped rather than show stale numbers
const MAX_AGE_HOURS = 12;
const OTHERS = 3;
// the headline has one line in the box (the Star4000 Small font is about 10 px a letter at this size)
const HEADLINE_LETTERS = 44;

const percent = (score) => `${Math.round(score)}%`;
const shorten = (title) => (title.length <= HEADLINE_LETTERS ? title : `${title.slice(0, HEADLINE_LETTERS - 3).replace(/\s+\S*$/, '')}...`);
const speed = (fps) => (Number.isFinite(fps) ? `${Math.round(fps)} fps` : '');

class Gta extends WeatherDisplay {
	constructor(elemId, defaultActive) {
		super(elemId, 'GTA VI on PC', defaultActive);
		this.timing.baseDelay = 12000;
	}

	async getData(weatherParameters) {
		if (!super.getData(weatherParameters)) return;
		let data = null;
		try {
			data = await json(SERVICE_URL, { signal: AbortSignal.timeout(5000) });
		} catch (error) {
			console.warn('GTA VI: no data from the Pi', error.message);
		}
		const fresh = data?.ok && DateTime.fromISO(data.ok) > DateTime.now().minus({ hours: MAX_AGE_HOURS });
		if (!fresh || !data.leaders?.length) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.data = data;
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		const { leaders, exe, news } = this.data;
		const [leader, ...rest] = leaders;
		const text = (selector, value) => { this.elem.querySelector(selector).textContent = plainText(value ?? ''); };

		const released = exe?.status === 'released';
		const since = released && exe.releasedAt ? DateTime.fromISO(exe.releasedAt).setZone(LOCAL_TZ).toFormat('d LLL') : '';
		text('.exe', released ? `Exe out${since ? ` ${since}` : ''}` : 'Exe not out');
		this.elem.querySelector('.exe').classList.toggle('out', released);

		text('.leader .name', leader.name);
		text('.leader .score', percent(leader.score));
		this.elem.querySelector('.bar .fill').style.width = `${Math.min(100, Math.max(0, leader.score))}%`;
		text('.leader .stage', [leader.stage, speed(leader.fps)].filter(Boolean).join('  '));

		const rows = rest.slice(0, OTHERS).map((project, index) => this.fillTemplate('gta-row', {
			pos: String(index + 2),
			name: project.name,
			fps: speed(project.fps),
			score: percent(project.score),
		}));
		const list = this.elem.querySelector('.gta-lines');
		list.innerHTML = '';
		list.append(...rows);

		text('.headline', shorten(plainText(news?.[0] ?? '')));
		this.finishDraw();
	}
}

// register display (off by default: it only works on the Pi running skypaddock-hub)
registerDisplay(new Gta('gta', false));
