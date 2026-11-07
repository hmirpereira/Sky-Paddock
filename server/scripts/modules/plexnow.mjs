// Plex Now Playing: one page for each session playing on the Plex server now (3 at most): poster, title, who is watching and
// where, a progress bar with the time left, and the synopsis. The skypaddock-hub service on the Pi asks Tautulli (get_activity)
// and serves /plexnow.json and the posters; the key of Tautulli never leaves the Pi. With nothing playing the screen is skipped,
// as anywhere but the Pi. The page asks the service once a minute (a small local answer) and only redraws when a session starts,
// stops, pauses or resumes.
import { DateTime } from '../vendor/auto/luxon.mjs';
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { plainText } from './utils/text.mjs';
import fillFooter from './utils/footer.mjs';

const HUB = 'http://127.0.0.1:8095';
const SERVICE_URL = `${HUB}/plexnow.json`;
const CHECK_EVERY = 60_000;

const clock = (seconds) => {
	const s = Math.max(0, Math.round(seconds));
	const h = Math.floor(s / 3600);
	const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
	return h ? `${h}:${m}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// what makes a redraw worth it: which sessions there are and whether each is playing
const signature = (sessions) => sessions.map((s) => `${s.key}:${s.state}`).join(',');

const fetchSessions = async () => {
	const data = await json(SERVICE_URL, { signal: AbortSignal.timeout(5000) }).catch((error) => {
		console.error('Plex Now Playing: no data from the Pi', error);
		return null;
	});
	return { sessions: (data?.sessions ?? []).filter((s) => s?.title), at: Date.now() };
};

class PlexNow extends WeatherDisplay {
	constructor(elemId, defaultActive) {
		super(elemId, 'Plex Now Playing', defaultActive);
		this.timing.baseDelay = 15000;
		this.timing.totalScreens = 1;
		this.sessions = [];
	}

	apply({ sessions, at }) {
		this.sessions = sessions;
		this.fetchedAt = at;
		if (sessions.length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.timing.totalScreens = sessions.length;
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	async getData(weatherParameters) {
		if (!super.getData(weatherParameters)) return;
		this.apply(await fetchSessions());
		// a film can start at any time: look again every minute (the page reloads its data only every 10 minutes)
		if (!this.checkTimer) {
			this.checkTimer = setInterval(async () => {
				if (!this.isEnabled) return;
				const now = await fetchSessions();
				if (signature(now.sessions) !== signature(this.sessions)) this.apply(now);
			}, CHECK_EVERY);
		}
	}

	async drawCanvas() {
		super.drawCanvas();
		const pageIndex = Math.min(Math.max(this.screenIndex, 0), this.sessions.length - 1);
		const session = this.sessions[pageIndex];
		// the sessions can end between two draws (the list is looked at again every minute): nothing to draw then
		if (!session) return;

		const poster = this.elem.querySelector('.poster');
		poster.style.visibility = 'hidden';
		poster.onload = () => { poster.style.visibility = ''; };
		poster.onerror = () => { poster.style.visibility = 'hidden'; };
		poster.src = session.poster ? `${HUB}${session.poster}` : '';

		// the title in two lines at most: smaller letters for a long one
		const titleBox = this.elem.querySelector('.plex-info .title');
		titleBox.textContent = plainText(session.title);
		titleBox.style.fontSize = '';
		const line = parseFloat(getComputedStyle(titleBox).lineHeight);
		for (let size = 22; size >= 14 && titleBox.offsetHeight > 2 * line; size -= 2) titleBox.style.fontSize = `${size}pt`;

		// a film: its year; an episode: season, episode and its name
		this.elem.querySelector('.detail').textContent = plainText(session.detail ?? '');
		const paused = session.state !== 'playing';
		const state = this.elem.querySelector('.state');
		state.textContent = paused ? 'Paused' : 'Playing';
		state.classList.toggle('paused', paused);
		this.elem.querySelector('.where').textContent = plainText([session.user, session.player].filter(Boolean).join(' on '));

		// the position moves on while it plays: from the time the service answered
		const seconds = (session.offset ?? 0) + (paused ? 0 : (Date.now() - this.fetchedAt) / 1000);
		const total = session.duration ?? 0;
		const done = Math.min(seconds, total);
		this.elem.querySelector('.fill').style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
		this.elem.querySelector('.elapsed').textContent = total ? `${clock(done)} / ${clock(total)}` : '';
		this.elem.querySelector('.ends').textContent = total && !paused ? `Ends ${DateTime.now().plus({ seconds: total - done }).toFormat('HH:mm')}` : '';

		// the synopsis is cut, at a word, where the box ends
		const summary = this.elem.querySelector('.summary');
		let words = plainText(session.summary ?? '').split(' ');
		summary.textContent = words.join(' ');
		while (words.length > 3 && summary.scrollHeight > summary.clientHeight) {
			words = words.slice(0, -Math.max(1, Math.round(words.length * 0.05)));
			summary.textContent = `${words.join(' ').replace(/[.,;:!?-]+$/, '')}...`;
		}

		fillFooter(this.elem, [], pageIndex, this.sessions.length);
		this.finishDraw();
	}
}

// register display (off by default: it only works on the Pi running skypaddock-hub)
registerDisplay(new PlexNow('plex-now', false));
