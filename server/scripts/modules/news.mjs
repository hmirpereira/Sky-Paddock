// latest Portuguese news headlines (RTP, Expresso, Publico, CNN Portugal), served by the
// skypaddock-hub service on the Pi, which reads the RSS feeds every 10 minutes and joins the same
// story from several sources. BREAKING: the source marks it as such ("Ultima hora") in the last 2 hours;
// TOP STORY: the same story in 3 or more sources in the last 3 hours. Then a page of aviation news (Aviacao TV,
// last 3 days) and a last page with the Formula 1 news of FlyingLapF1, F1PT and PlanetF1 (last 7 days). Each source is shown by its logo. Anywhere else this screen is skipped.
import { DateTime } from 'luxon';
import STATUS from './status.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import ConversionHelpers from './utils/conversionHelpers.mjs';
import {
	newsFresh, sourceLogo, isF1Source, isAviationSource,
} from './utils/news.mjs';
import { plainText } from './utils/text.mjs';
import fillFooter from './utils/footer.mjs';
import f1Title from './utils/f1-title.mjs';

const NEWS_TZ = 'Europe/Lisbon';
const ROWS_PER_PAGE = 3;
const MAX_PAGES = 4;
const F1_ROWS = 3;
// headline lengths from which the letters get smaller ("long") and smaller still ("very long"), for each kind of row,
// with a picture beside the headline (it narrows the text) and without: the lead story on top of the first page,
// the two short rows under it, and the usual rows of the other pages
const SIZES = {
	lead: { picture: [55, 105], plain: [90, 170] },
	compact: { picture: [70, Infinity], plain: [90, Infinity] },
	row: { picture: [62, 100], plain: [84, 150] },
};
const MAX_LOGOS = 3; // the source of the headline and the others that have the same story

// only https pictures (or the made-up ones of the tests)
const hasPicture = (item) => /^https:\/\//.test(item.image ?? '') || /^data:image\//.test(item.image ?? '');

// "12 min ago", "3 h ago"; nothing for news older than a day (its time already says the day)
const age = (time) => {
	const minutes = Math.floor(DateTime.now().diff(time, 'minutes').minutes);
	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes} min ago`;
	if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
	return '';
};

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
		const aviation = (data.aviation ?? []).slice(0, ROWS_PER_PAGE);
		// each page of aviation or F1 news takes the place of a page of the others
		const items = (data.items ?? []).slice(0, ROWS_PER_PAGE * (MAX_PAGES - (f1.length ? 1 : 0) - (aviation.length ? 1 : 0)));
		if (items.length === 0 && f1.length === 0 && aviation.length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}
		// the first page opens with a lead story: the breaking or top story (they come first), else the first of the
		// three latest with a picture
		const lead = items.findIndex((item, i) => i < ROWS_PER_PAGE && (item.breaking || item.top || hasPicture(item)));
		if (lead > 0) items.unshift(...items.splice(lead, 1));
		this.sources = data.sources ?? [];
		this.pages = [];
		for (let i = 0; i < items.length; i += ROWS_PER_PAGE) this.pages.push({ lead: i === 0, items: items.slice(i, i + ROWS_PER_PAGE) });
		if (aviation.length) this.pages.push({ aviation: true, items: aviation });
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
		// "Latest News", "Aviation News", or "F1 News" with the red F1 logo, in one line
		const title = this.elem.querySelector('.header .title.dual');
		title.querySelector('.top').innerHTML = page.f1 ? f1Title('News', true) : (page.aviation && 'Aviation News') || 'Latest News';
		const rows = page.items.map((item, i) => {
			let kind = 'row';
			if (page.lead) kind = i === 0 ? 'lead' : 'compact';
			const time = DateTime.fromISO(item.time).setZone(NEWS_TZ);
			const when = time.hasSame(today, 'day') ? ConversionHelpers.formatTime(time) : `${time.toFormat('ccc')} ${ConversionHelpers.formatTime(time)}`;
			const row = this.fillTemplate('news-item', {
				badge: item.breaking ? 'BREAKING' : 'TOP STORY',
				when,
				age: age(time),
				headline: plainText(item.title),
			});
			row.classList.add(kind);
			// the logo of the source, then of the others that have the same story
			const sources = [item.source, ...(item.sources ?? []).filter((source) => source !== item.source)].slice(0, MAX_LOGOS);
			const logos = document.createElement('span');
			logos.className = 'logos';
			logos.append(...sources.map(sourceLogo));
			row.querySelector('.source').replaceWith(logos);
			// the lead story has its time at the bottom, under the headline (its line on top is full of logos)
			if (kind === 'lead') {
				const stamp = document.createElement('div');
				stamp.className = 'stamp';
				stamp.append(row.querySelector('.when'), row.querySelector('.age'));
				row.append(stamp);
			}
			// a picture of the news, when the source gives one (a picture that fails is left out)
			const thumb = row.querySelector('.thumb');
			if (hasPicture(item)) {
				thumb.src = item.image;
				thumb.addEventListener('error', () => row.classList.remove('has-thumb'), { once: true });
				row.classList.add('has-thumb');
			}
			// smaller letters for long headlines
			const { length } = plainText(item.title);
			const [long, veryLong] = SIZES[kind][row.classList.contains('has-thumb') ? 'picture' : 'plain'];
			if (length > long) row.classList.add('long');
			if (length > veryLong) row.classList.add('long', 'very-long');
			if (item.breaking) row.classList.add('breaking');
			else if (item.top) row.classList.add('top');
			return row;
		});

		const list = this.elem.querySelector('.news-lines');
		list.innerHTML = '';
		list.classList.toggle('f1', !!page.f1);
		list.classList.toggle('aviation', !!page.aviation);
		list.append(...rows);

		// general sources | aviation sources | Formula 1 sources
		const groups = [
			this.sources.filter((source) => !isF1Source(source) && !isAviationSource(source)),
			this.sources.filter(isAviationSource),
			this.sources.filter(isF1Source),
		].filter((group) => group.length).map((group) => group.map(sourceLogo));
		const footer = groups.flatMap((group, i) => {
			if (i === 0) return group;
			const divider = document.createElement('span');
			divider.className = 'sources-divider';
			return [divider, ...group];
		});
		fillFooter(this.elem, footer, pageIndex, this.pages.length);

		this.finishDraw();
	}
}

// register display (off by default: it only works on the Pi running skypaddock-hub)
registerDisplay(new News('news', false));
