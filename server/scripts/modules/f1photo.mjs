// F1 Photo from r/F1Porn: one picture an hour, chosen at random and kept by the skypaddock-hub service on the Pi
// (hub_f1photo.py reads the public Atom feed of the subreddit and downloads the file from i.redd.it); anywhere else the
// screen is skipped. The title of the post is shown under the picture, without the resolution the posts usually carry.
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { plainText } from './utils/text.mjs';

const SERVICE_URL = 'http://127.0.0.1:8095';

// the picture is fetched before the screen is drawn, so it never shows half loaded
const loadPicture = (src) => new Promise((resolve, reject) => {
	const picture = new Image();
	picture.onload = () => resolve(picture);
	picture.onerror = () => reject(new Error('picture not loaded'));
	picture.src = src;
	setTimeout(() => reject(new Error('picture timed out')), 15000);
});

class F1Photo extends WeatherDisplay {
	constructor(elemId, defaultActive) {
		super(elemId, 'F1 Photo', defaultActive);
		this.timing.baseDelay = 15000;
		this.timing.totalScreens = 1;
	}

	async getData(weatherParameters) {
		if (!super.getData(weatherParameters)) return;
		try {
			const photo = await json(`${SERVICE_URL}/f1photo.json`, { signal: AbortSignal.timeout(5000) });
			if (!photo?.title || !photo?.image) throw new Error('no photo yet');
			this.src = `${SERVICE_URL}${photo.image}`;
			this.title = photo.title;
			await loadPicture(this.src);
		} catch (error) {
			console.error('F1 Photo: no photo from the Pi', error);
			this.setStatus(STATUS.noData);
			return;
		}
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		this.elem.querySelector('.picture').src = this.src;
		this.elem.querySelector('.caption').textContent = plainText(this.title);
		this.finishDraw();
	}
}

// register display (off by default: it only works on the Pi running skypaddock-hub)
registerDisplay(new F1Photo('f1-photo', false));
