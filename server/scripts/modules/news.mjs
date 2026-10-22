// latest Portuguese news headlines (RTP, Expresso, Publico, CNN Portugal, Sabado), served by the
// skypaddock-hub service on the Pi, which reads the RSS feeds every 10 minutes and joins the same
// story from several sources. BREAKING: the source marks it as such ("Ultima hora") in the last 2 hours;
// TOP STORY: the same story in 3 or more sources in the last 3 hours. The last page has the Formula 1
// news of FlyingLapF1 and F1PT (last 7 days). Each source is shown by its logo. Anywhere else this screen is skipped.
import STATUS from './status.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import ConversionHelpers from './utils/conversionHelpers.mjs';
import {
	newsFresh, sourceLogo, isF1Source,
} from './utils/news.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import { plainText } from './utils/text.mjs';

const NEWS_TZ = 'Europe/Lisbon';
const ROWS_PER_PAGE = 3;
const MAX_PAGES = 4;
const F1_ROWS = 3;
const LONG_HEADLINE = 84;

class News extends WeatherDisplay {
	constructor(elemId, defaultActive) {
		super(elemId, 'News', defaultActive);

		// set timings (seconds on screen)
		this.timing.baseDelay = 12000;
	}

	async getData(_weatherParameters) {
		if (!super.getData(_weatherParameters)) return;

		const data = await newsFresh();
		// the most recent first, at most two from each source, so both F1 sources get a place
		const perSource = {};
		const f1 = (data.f1 ?? []).filter((item) => {
			perSource[item.source] = (perSource[item.source] ?? 0) + 1;
			return perSource[item.source] <= 2;
		}).slice(0, F1_ROWS);
		// with F1 news, one page less of the others
		const items = (data.items ?? []).slice(0, ROWS_PER_PAGE * (MAX_PAGES - (f1.length ? 1 : 0)));
		if (items.length === 0 && f1.length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.sources = data.sources ?? [];
		this.pages = [];
		for (let i = 0; i < items.length; i += ROWS_PER_PAGE) this.pages.push({ f1: false, items: items.slice(i, i + ROWS_PER_PAGE) });
		if (f1.length) this.pages.push({ f1: true, items: f1 });
		this.timing.totalScreens = this.pages.length;

		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();

		const pageIndex = Math.min(Math.max(this.screenIndex, 0), this.pages.length - 1);
		const today = DateTime.now().setZone(NEWS_TZ);

		const page = this.pages[pageIndex];
		this.elem.querySelector('.header .title.dual .bottom').textContent = page.f1 ? 'F1 News' : 'News';
		const rows = page.items.map((item) => {
			const time = DateTime.fromISO(item.time).setZone(NEWS_TZ);
			const when = time.hasSame(today, 'day') ? ConversionHelpers.formatTime(time) : `${time.toFormat('ccc')} ${ConversionHelpers.formatTime(time)}`;
			const sources = item.sources?.length ?? 1;
			const row = this.fillTemplate('news-item', {
				badge: item.breaking ? 'BREAKING' : 'TOP STORY',
				when,
				count: sources > 1 ? `${sources} sources` : '',
				headline: plainText(item.title),
			});
			// more than two lines at the usual size
			if (plainText(item.title).length > LONG_HEADLINE) row.classList.add('long');
			row.querySelector('.source').replaceWith(sourceLogo(item.source));
			if (item.breaking) row.classList.add('breaking');
			else if (item.top) row.classList.add('top');
			return row;
		});

		const list = this.elem.querySelector('.news-lines');
		list.innerHTML = '';
		list.append(...rows);

		const footer = this.elem.querySelector('.news-footer');
		// general sources | Formula 1 sources
		const general = this.sources.filter((source) => !isF1Source(source)).map(sourceLogo);
		const f1Sources = this.sources.filter(isF1Source).map(sourceLogo);
		const divider = document.createElement('span');
		divider.className = 'sources-divider';
		footer.querySelector('.sources').replaceChildren(...general, ...(general.length && f1Sources.length ? [divider] : []), ...f1Sources);
		footer.querySelector('.page').textContent = this.pages.length > 1 ? `${pageIndex + 1}/${this.pages.length}` : '';

		this.finishDraw();
	}
}

// register display (off by default: it only works on the Pi running skypaddock-hub)
registerDisplay(new News('news', false));
