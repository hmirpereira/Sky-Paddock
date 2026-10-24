import { elemForEach } from './utils/elem.mjs';
import getCurrentWeather from './currentweather.mjs';
import { currentDisplay } from './navigation.mjs';
import { getConditionText } from './utils/weather.mjs';
import piProblems from './utils/pi-health.mjs';
import { newsNow } from './utils/news.mjs';
// eslint-disable-next-line import/no-cycle
import settings from './settings.mjs';
import { plainText } from './utils/text.mjs';

// constants
const degree = String.fromCharCode(176);
const LINE_MS = 4000;
// breaking news: shown from the start for a moment, then crawl slowly to the end, then stay a while
const NEWS_HOLD_MS = 3000;
const NEWS_END_MS = 3500;
const NEWS_PX_PER_S = 60;
const BREAKING_PER_ROUND = 2;

// local variables
let timer;
let screenIndex = 0;
let roundNews = [];

// next step after `ms`
const schedule = (ms) => {
	clearTimeout(timer);
	timer = setTimeout(incrementInterval, ms);
};

// start drawing conditions
// reset starts from the first item in the text scroll list
const start = async () => {
	schedule(LINE_MS);
	// draw the data
	const ms = await drawScreen();
	if (ms) schedule(ms);
};

const stop = (reset) => {
	if (reset) screenIndex = 0;
};

// increment interval, roll over
const incrementInterval = async () => {
	// test current screen
	const display = currentDisplay();
	if (!display?.okToDrawCurrentConditions) {
		stop(display?.elemId === 'progress');
		schedule(LINE_MS);
		return;
	}
	screenIndex = (screenIndex + 1) % (allScreens().length);
	// a new round: choose its headlines
	if (screenIndex === 0) pickNews();
	// draw new text
	schedule(LINE_MS);
	const ms = await drawScreen();
	if (ms) schedule(ms);
};

// how long the line stays (ms), or nothing for the usual 4 seconds
const drawScreen = async () => {
	// get the conditions
	const data = await getCurrentWeather();

	// nothing to do if there's no data yet
	if (!data) return undefined;

	const list = allScreens();
	if (screenIndex >= list.length) screenIndex = 0;
	const item = list[screenIndex];
	if (item?.news) return drawNews(item);
	// Pi warnings are drawn in red
	drawCondition(typeof item === 'string' ? item : item(data), typeof item === 'string');
	return undefined;
};

// headlines for the next round of the bottom line: only breaking news (the rest is on the News screen)
const pickNews = () => {
	roundNews = [];
	if (!settings.newsTicker?.value) return;
	const items = newsNow().items ?? [];
	roundNews = items.filter((item) => item.breaking).slice(0, BREAKING_PER_ROUND).map((item) => ({
		news: true, breaking: item.breaking, top: item.top, source: plainText(item.source), text: plainText(item.title),
	}));
};

// the "screens" are stored in an array for easy addition and removal
const screens = [
	// station name
	(data) => {
		let sanitizedText = 'Conditions at ';
		// Typically an airport with "International" at the second position
		if (data.city.split(' ').length > 2 && data.city.split(' ')[1].toLowerCase() === 'international') {
			sanitizedText += `${data.city.split(' ')[0]} Intl. ${data.city.split(' ')[2]} `;
		// or a very long city name...this will
		// truncate very long airports too, like
		// "John F. Kennedy International Airport"
		} else if (data.city.length > 20) {
			sanitizedText += `${data.city.slice(0, 18)}...`;
		} else {
			sanitizedText += `${data.city} `;
		}
		return sanitizedText;
	},

	// condition
	(data) => `Condition: ${getConditionText(data.TextConditions)}`,

	// temperature
	(data) => {
		const text = `Temp: ${data.Temperature}${degree}${data.TemperatureUnit}`;
		return text;
	},

	// humidity
	(data) => `Humidity: ${data.Humidity}%   Dewpoint: ${data.DewPoint}${degree}${data.TemperatureUnit}`,

	// barometric pressure
	(data) => `Barometric Pressure: ${data.Pressure} ${data.PressureUnit}`,

	// wind
	(data) => {
		let text = data.WindSpeed > 0
			? `Wind: ${data.WindDirection} ${data.WindSpeed} ${data.WindUnit}`
			: 'Wind: Calm';

		if (data.WindGust > 0) {
			text += `   Gusts to ${data.WindGust}`;
		}
		return text;
	},

	// visibility
	(data) => {
		const distance = `${data.Ceiling} ${data.CeilingUnit}`;
		return `Visib: ${data.Visibility} ${data.VisibilityUnit}   Ceiling: ${data.Ceiling === 0 ? 'Unlimited' : distance}`;
	},
];

// the weather lines, then one line per warning from the Pi services (only when there is a problem),
// then this round's news headlines (if turned on)
const allScreens = () => [...screens, ...piProblems(), ...roundNews];

// a headline: the source, then the text, which crawls to the left until its end is shown
const drawNews = (item) => {
	const layers = drawCondition(item.text, false, item);
	// measure on the screen being shown (hidden screens have no size)
	let overflow = 0;
	layers.forEach((layer) => {
		const content = layer.querySelector('.text-content');
		if (layer.offsetParent) overflow = Math.max(overflow, content.scrollWidth - layer.clientWidth);
	});
	if (overflow <= 0) return NEWS_HOLD_MS + NEWS_END_MS + 1000;
	const crawlMs = Math.round((overflow / NEWS_PX_PER_S) * 1000);
	layers.forEach((layer) => {
		const content = layer.querySelector('.text-content');
		content.style.transition = `clip-path 0.2s ease-out, transform ${crawlMs}ms linear ${NEWS_HOLD_MS}ms`;
		content.style.transform = `translateX(-${overflow}px)`;
	});
	return NEWS_HOLD_MS + crawlMs + NEWS_END_MS;
};

// internal draw function with preset parameters
const drawCondition = (text, warning = false, news = null) => {
	const layersAdded = [];
	elemForEach('.weather-display .scroll .fixed', (elem) => {
		// Remove old text-layers with exit
		const layers = elem.querySelectorAll('.text-layer');
		layers.forEach((layer) => {
			layer.classList.remove('active');
			layer.classList.add('exit');
			// not on transitionend: on a screen that is not being shown no transition runs, and the old lines piled up
			// there (and showed over the new one when the screen came back)
			setTimeout(() => layer.remove(), 1000);
		});

		// Create new layer with wrapped content
		const newLayer = document.createElement('div');
		newLayer.className = warning ? 'text-layer warning' : 'text-layer';
		const content = document.createElement('div');
		content.className = 'text-content';
		if (news) {
			// "BREAKING  Headline..." with a red label; the source is not shown (it is on the News screen)
			newLayer.classList.add('news');
			if (news.breaking) newLayer.classList.add('breaking');
			const source = document.createElement('span');
			source.className = 'news-source';
			source.textContent = news.breaking ? 'BREAKING' : news.source;
			content.append(source, ` ${text}`);
		} else {
			content.textContent = text;
		}
		newLayer.appendChild(content);
		layersAdded.push(newLayer);
		elem.appendChild(newLayer);

		// Force reflow
		// eslint-disable-next-line no-void
		void newLayer.offsetWidth;

		// Trigger wipe
		newLayer.classList.add('active');
	});
	return layersAdded;
};
document.addEventListener('DOMContentLoaded', () => {
	start();
});
