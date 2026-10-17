// latest Portuguese news headlines (RTP, Observador, Publico, CNN Portugal), served by the
// skypaddock-hub service on the Pi, which reads the RSS feeds every 10 minutes and joins the same
// story from several sources. BREAKING: the source marks it as such ("Ultima hora") in the last 2 hours;
// TOP STORY: the same story in 3 or more sources in the last 3 hours. Anywhere else this screen is skipped.
import STATUS from './status.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import ConversionHelpers from './utils/conversionHelpers.mjs';
import { newsFresh, plainText } from './utils/news.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';

const NEWS_TZ = 'Europe/Lisbon';
const ROWS_PER_PAGE = 3;
const MAX_PAGES = 4;
const LONG_HEADLINE = 84;

class News extends WeatherDisplay {
	constructor(navId, elemId, defaultActive) {
		super(navId, elemId, 'News', defaultActive);

		// set timings (seconds on screen)
		this.timing.baseDelay = 12000;
	}

	async getData(_weatherParameters) {
		if (!super.getData(_weatherParameters)) return;

		const data = await newsFresh();
		const items = (data.items ?? []).slice(0, ROWS_PER_PAGE * MAX_PAGES);
		if (items.length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.sources = data.sources ?? [];
		this.pages = [];
		for (let i = 0; i < items.length; i += ROWS_PER_PAGE) this.pages.push(items.slice(i, i + ROWS_PER_PAGE));
		this.timing.totalScreens = this.pages.length;

		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();

		const pageIndex = Math.min(Math.max(this.screenIndex, 0), this.pages.length - 1);
		const today = DateTime.now().setZone(NEWS_TZ);

		const rows = this.pages[pageIndex].map((item) => {
			const time = DateTime.fromISO(item.time).setZone(NEWS_TZ);
			const when = time.hasSame(today, 'day') ? ConversionHelpers.formatTime(time) : `${time.toFormat('ccc')} ${ConversionHelpers.formatTime(time)}`;
			const sources = item.sources?.length ?? 1;
			const row = this.fillTemplate('news-item', {
				badge: item.breaking ? 'BREAKING' : 'TOP STORY',
				source: plainText(item.source),
				when,
				count: sources > 1 ? `${sources} sources` : '',
				headline: plainText(item.title),
			});
			// more than two lines at the usual size
			if (plainText(item.title).length > LONG_HEADLINE) row.classList.add('long');
			if (item.breaking) row.classList.add('breaking');
			else if (item.top) row.classList.add('top');
			return row;
		});

		const list = this.elem.querySelector('.news-lines');
		list.innerHTML = '';
		list.append(...rows);

		const footer = this.elem.querySelector('.news-footer');
		footer.querySelector('.sources').textContent = this.sources.map(plainText).join(', ');
		footer.querySelector('.page').textContent = this.pages.length > 1 ? `${pageIndex + 1}/${this.pages.length}` : '';

		this.finishDraw();
	}
}

// register display (off by default: it only works on the Pi running skypaddock-hub)
registerDisplay(new News(17, 'news', false));
