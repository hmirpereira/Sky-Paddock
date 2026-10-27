// Plex Recommends: two pages. Page 1: the movie added most recently to the Plex library. Page 2: a movie chosen at random from
// those not watched yet. The skypaddock-hub service on the Pi asks Tautulli (on the Raspy5, connected to Plex) every 30 minutes
// and serves /plex.json and the posters, so the key of Tautulli never leaves the Pi; anywhere else the screen is skipped.
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { plainText } from './utils/text.mjs';
import fillFooter from './utils/footer.mjs';

const HUB = 'http://127.0.0.1:8095';
const SERVICE_URL = `${HUB}/plex.json`;
// the answer of the service has each movie under these names: page 1 the latest added, page 2 the unwatched one
const PAGES = ['latest', 'random'];
// the two Rotten Tomatoes scores, each with the picture of its verdict (images/plex, supplied by the owner of this project); the
// verdict comes from Plex through the Pi service (ripe or rotten, upright or spilled)
const SCORES = [['critics', 'rating', 'ripe', 'tomato-ripe', 'tomato-rotten'], ['audience', 'audience', 'upright', 'popcorn-upright', 'popcorn-spilled']];

const runtimeText = (minutes) => (minutes ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m` : '');

class Plex extends WeatherDisplay {
	constructor(elemId, defaultActive) {
		super(elemId, 'Plex Recommends', defaultActive);
		// the synopsis takes a while to read
		this.timing.baseDelay = 15000;
		this.timing.totalScreens = 2;
	}

	async getData(weatherParameters) {
		if (!super.getData(weatherParameters)) return;
		let data = null;
		try {
			data = await json(SERVICE_URL, { signal: AbortSignal.timeout(5000) });
		} catch (error) {
			console.error('Plex: no data from the Pi', error);
		}
		this.pages = PAGES.filter((name) => data?.[name]?.title).map((name) => ({ movie: data[name] }));
		if (this.pages.length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.timing.totalScreens = this.pages.length;
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		const pageIndex = Math.min(Math.max(this.screenIndex, 0), this.pages.length - 1);
		const { movie } = this.pages[pageIndex];

		const poster = this.elem.querySelector('.poster');
		poster.style.visibility = 'hidden';
		poster.onload = () => { poster.style.visibility = ''; };
		poster.onerror = () => { poster.style.visibility = 'hidden'; };
		poster.src = movie.poster ? `${HUB}${movie.poster}` : '';

		// the title in two lines at most: smaller letters for a long one
		const titleBox = this.elem.querySelector('.plex-info .title');
		titleBox.textContent = plainText(movie.title);
		titleBox.style.fontSize = '';
		const line = parseFloat(getComputedStyle(titleBox).lineHeight);
		for (let size = 22; size >= 14 && titleBox.offsetHeight > 2 * line; size -= 2) titleBox.style.fontSize = `${size}pt`;
		this.elem.querySelector('.year').textContent = movie.year ?? '';
		this.elem.querySelector('.runtime').textContent = runtimeText(movie.runtime);
		SCORES.forEach(([kind, value, good, goodPicture, badPicture]) => {
			const score = this.elem.querySelector(`.score.${kind}`);
			const known = typeof movie[value] === 'number';
			score.hidden = !known;
			if (!known) return;
			score.querySelector('.icon').src = `images/plex/${movie[good] ? goodPicture : badPicture}.svg`;
			score.querySelector('.value').textContent = `${movie[value]}%`;
		});

		// the synopsis is cut, at a word, where the box ends
		const summary = this.elem.querySelector('.summary');
		let words = plainText(movie.summary ?? '').split(' ');
		summary.textContent = words.join(' ');
		while (words.length > 3 && summary.scrollHeight > summary.clientHeight) {
			words = words.slice(0, -Math.max(1, Math.round(words.length * 0.05)));
			summary.textContent = `${words.join(' ').replace(/[.,;:!?-]+$/, '')}...`;
		}

		// only the page counter: the source (Plex) goes without saying
		fillFooter(this.elem, [], pageIndex, this.pages.length);
		this.finishDraw();
	}
}

// register display (off by default: it only works on the Pi running skypaddock-hub)
registerDisplay(new Plex('plex', false));
