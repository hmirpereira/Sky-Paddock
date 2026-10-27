// navigation handles progress, next/previous and initial load messages from the parent frame
import noSleep from './utils/nosleep.mjs';
import STATUS from './status.mjs';
import { wrap } from './utils/calc.mjs';
import {
	getPoint, getMarinePoint, getGeocoding, aggregateWeatherForecastData,
} from './utils/weather.mjs';
// eslint-disable-next-line import/no-cycle
import settings from './settings.mjs';

import { parseQueryString } from './share.mjs';
import ConversionHelpers from './utils/conversionHelpers.mjs';
import piHeartbeat from './utils/pi-heartbeat.mjs';

document.addEventListener('DOMContentLoaded', () => {
	init();
});

// The rotation order of the screens, by elemId: a screen's position here is its navId. registerDisplay
// gives it, so there are no numbers to keep contiguous (a hole in the numbering used to crash the
// navigation). A new screen only needs its elemId here; the order of the imports in main.mjs does not matter.
const DISPLAY_ORDER = [
	'hazards', 'current-weather', 'hourly', 'hourly-graph',
	'travel', 'regional-forecast', 'extended-forecast', 'almanac',
	'radar', 'marine-forecast', 'pollen', 'work-schedule',
	'metar', 'departures', 'cancellations', 'overhead',
	'news', 'plex', 'f1-last-race', 'f1-grid', 'f1-telemetry',
	'f1-standings', 'f1-next-race', 'f1-jet', 'gt-race',
	'gt-next-race',
];
const displays = [];
let playing = false;
let progress;
const weatherParameters = {};

// auto refresh
const AUTO_REFRESH_INTERVAL_MS = 500;
const AUTO_REFRESH_TIME_MS = 600_000; // 10 min.
const CHK_AUTO_REFRESH_SELECTOR = '#chkAutoRefresh';
let AutoRefreshIntervalId = null;
let AutoRefreshCountMs = 0;

const init = async () => {
	// every screen of the list must have registered, or the navigation would find a hole
	DISPLAY_ORDER.forEach((id, i) => { if (!displays[i]) console.error(`DISPLAY_ORDER lists "${id}" but no screen registered with that elemId`); });
	// set up resize handler
	window.addEventListener('resize', resize);
	resize();

	// set up custom event listener for custom messages from displays
	window.addEventListener('custom-weather:update', (event) => {
		console.debug('Received custom-weather:update event with data:', event);
		if (event.detail) {
			// store on shared weatherParameters so displays can read it
			weatherParameters.customWeather = event.detail;

			// optionally notify displays that implement a handler
			displays.forEach((display) => {
				if (typeof display.onCustomWeather === 'function') {
					display.onCustomWeather(event.detail);
				}
			});
		}
	});

	// auto refresh
	const autoRefresh = localStorage.getItem('autoRefresh');
	if (!autoRefresh || autoRefresh === 'true') {
		document.querySelector(CHK_AUTO_REFRESH_SELECTOR).checked = true;
	} else {
		document.querySelector(CHK_AUTO_REFRESH_SELECTOR).checked = false;
	}
	document.querySelector(CHK_AUTO_REFRESH_SELECTOR).addEventListener('change', autoRefreshChange);
	generateCheckboxes();
};

const message = (data) => {
	// dispatch event
	if (!data.type) return false;
	if (data.type === 'navButton') return handleNavButton(data.message);
	return console.error(`Unknown event ${data.type}`);
};

const getWeather = async (latLon, haveDataCallback) => {
	// get initial weather data
	const point = await getPoint(latLon.lat, latLon.lon);

	const aggregatedForecastData = aggregateWeatherForecastData(point);

	if (typeof haveDataCallback === 'function') haveDataCallback(point);

	// Get locality data from open-meteo and local storage
	const localityName = localStorage.getItem('latLonQuery');
	let locality;

	// We need to check if localityName is set in localStorage
	// if it is not set, it's likely that the page was loaded from a permalink
	// and we need to derive the locality name from the latLon.

	// We can assume this is safe because the latLon would've been set by the user
	// during a previous search
	if (!localityName) {
		console.warn('getWeather:'
			+ '\nlocalityName is not set in localStorage. Origin could be a permalink.'
			+ '\nAttempting to derive localityName from latLonQuery.');

		const parsedParameters = parseQueryString();
		if (parsedParameters && parsedParameters.latLonQuery != null) {
			console.warn(`getWeather: parsed localityName as: ${parsedParameters.latLonQuery}`);
			// This is only useful if the page is refreshed
			localStorage.setItem('latLonQuery', parsedParameters.latLonQuery);
			// Pass the value from our query params
			locality = await getGeocoding(parsedParameters.latLonQuery.split(',')[0]);
		}
	} else {
		// 'latLonQuery' is set in server>scripts>index.mjs in the format of "Amsterdam, NLD"
		// therefore we need to split on the "," to get the locality name for open-meteo
		locality = await getGeocoding(localityName.split(',')[0]);
	}

	// pick the geocoding result closest to the coordinates we have weather for. Several places
	// share names (Naples, Lincoln, Springfield...), and a lookup can also return nothing at all
	// (e.g. a GPS query such as "38.7223, -9.1393"), so fall back to Open-Meteo's own timezone.
	const results = locality?.results ?? [];
	const distanceTo = (result) => Math.abs(result.latitude - latLon.lat) + Math.abs(result.longitude - latLon.lon);
	const closest = results.reduce((best, result) => (!best || distanceTo(result) < distanceTo(best) ? result : best), null);
	const fallbackName = (localStorage.getItem('latLonQuery') ?? '').split(',')[0].trim() || 'Unknown';
	const place = closest ?? {
		name: fallbackName, admin1: '', country: '', timezone: point.timezone,
	};

	// set the city and state
	const city = place.name;
	const { country } = place;
	const state = place.admin1 ?? '';	// admin1 is usually the state / province
	const timezone = place.timezone ?? point.timezone;

	// populate the weather parameters
	weatherParameters.latitude = latLon.lat;
	weatherParameters.longitude = latLon.lon;
	weatherParameters.city = city;
	weatherParameters.state = state;
	weatherParameters.country = country;
	weatherParameters.timeZone = timezone;

	// WeatherParameters to modify...
	weatherParameters.forecast = aggregatedForecastData;
	// weatherParameters.forecastGridData = point.properties.forecastGridData;
	// weatherParameters.stations = stations.features;

	// update the main process for display purposes
	populateWeatherParameters(weatherParameters);

	// draw the progress canvas and hide others
	hideAllCanvases();
	document.querySelector('#loading').style.display = 'none';
	if (progress) {
		await progress.drawCanvas();
		progress.showCanvas();
	}

	// call for new data on each display
	displays.forEach((display) => display.getData(weatherParameters));
	return point;
};

// the marine data asks Open-Meteo once per wave model (about 8 requests): only when the screen is on
const getMarineForecast = async (latLon, point, haveDataCallback) => {
	if (!displays.some((display) => display?.name === 'Marine Forecast' && display.isEnabled)) return;
	const marinePoint = await getMarinePoint(latLon.lat, latLon.lon, 'marine');

	if (typeof haveDataCallback === 'function') haveDataCallback(marinePoint);

	displays.forEach((display) => {
		if (display.name === 'Marine Forecast') {
			display.getMarineData(point, marinePoint);
		}
	});
};

// receive a status update from a module {id, value}
const updateStatus = (value) => {
	if (value.id < 0) return;
	if (!progress) return;
	progress.drawCanvas(displays, countLoadedDisplays());

	// first display is hazards and it must load before evaluating the first display
	if (displays[0].status === STATUS.loading) return;

	// calculate first enabled display
	const firstDisplayIndex = displays.findIndex((display) => display.enabled && display.timing.totalScreens > 0);

	// value.id = 0 is hazards, if they fail to load hot-wire a new value.id to the current display to see if it needs to be loaded
	// typically this plays out as current conditions loads, then hazards fails.
	if (value.id === 0 && value.status === STATUS.failed) {
		value.id = firstDisplayIndex;
		value.status = displays[firstDisplayIndex].status;
	}

	// if hazards data arrives after the firstDisplayIndex loads, then we need to hot wire this to the first display
	if (value.id === 0 && value.status === STATUS.loaded && displays[0].timing.totalScreens === 0) {
		value.id = firstDisplayIndex;
		value.status = displays[firstDisplayIndex].status;
	}

	// if this is the first display and we're playing, load it up so it starts playing
	if (isPlaying() && value.id === firstDisplayIndex && value.status === STATUS.loaded) {
		navTo(msg.command.firstFrame);
	}

	// send loaded messaged to parent
	if (countLoadedDisplays() < displays.length) return;

	// everything loaded, set timestamps
	AssignLastUpdate(new Date());
};

// a display counts as loaded once it is no longer "loading": loaded, failed, no data and disabled are all done
const countLoadedDisplays = () => displays.reduce((acc, display) => {
	if (display.status !== STATUS.loading) return acc + 1;
	return acc;
}, 0);

const hideAllCanvases = () => {
	displays.forEach((display) => display.hideCanvas());
};

// is playing interface
const isPlaying = () => playing;

// navigation message constants
const msg = {
	response: {	// display to navigation
		previous: Symbol('previous'),		// already at first frame, calling function should switch to previous canvas
		inProgress: Symbol('inProgress'),	// have data to display, calling function should do nothing
		next: Symbol('next'),				// end of frames reached, calling function should switch to next canvas
	},
	command: {	// navigation to display
		firstFrame: Symbol('firstFrame'),
		previousFrame: Symbol('previousFrame'),
		nextFrame: Symbol('nextFrame'),
		lastFrame: Symbol('lastFrame'),	// used when navigating backwards from the begining of the next canvas
	},
};

// receive navigation messages from displays
const displayNavMessage = (myMessage) => {
	if (myMessage.type === msg.response.previous) loadDisplay(-1);
	if (myMessage.type === msg.response.next) loadDisplay(1);
};

// navigate to next or previous
const navTo = (direction) => {
	// test for a current display
	const current = currentDisplay();
	progress.hideCanvas();
	if (!current) {
		// special case for no active displays (typically on progress screen)
		// find the first ready display
		let firstDisplay;
		let displayCount = 0;
		do {
			if (displays[displayCount].status === STATUS.loaded && displays[displayCount].timing.totalScreens > 0) firstDisplay = displays[displayCount];
			displayCount += 1;
		} while (!firstDisplay && displayCount < displays.length);

		if (!firstDisplay) return;

		firstDisplay.navNext(msg.command.firstFrame);
		firstDisplay.showCanvas();
		return;
	}
	if (direction === msg.command.nextFrame) currentDisplay().navNext();
	if (direction === msg.command.previousFrame) currentDisplay().navPrev();
};

// find the next or previous available display
const loadDisplay = (direction) => {
	const totalDisplays = displays.length;
	const curIdx = currentDisplayIndex();
	let idx;
	for (let i = 0; i < totalDisplays; i += 1) {
		// convert form simple 0-10 to start at current display index +/-1 and wrap
		idx = wrap(curIdx + (i + 1) * direction, totalDisplays);
		if (displays[idx].status === STATUS.loaded && displays[idx].timing.totalScreens > 0) break;
	}
	// if new display index is less than current display a wrap occurred, test for reload timeout
	if (idx <= curIdx && refreshCheck()) return;
	const newDisplay = displays[idx];
	// hide all displays
	hideAllCanvases();
	// show the new display and navigate to an appropriate display
	if (direction < 0) newDisplay.showCanvas(msg.command.lastFrame);
	if (direction > 0) newDisplay.showCanvas(msg.command.firstFrame);
	// the rotation is alive: tell the kiosk watchdog on the Pi
	piHeartbeat(newDisplay.elemId);
};

// get the current display index or value
const currentDisplayIndex = () => displays.findIndex((display) => display.active);
const currentDisplay = () => displays[currentDisplayIndex()];

const setPlaying = (newValue) => {
	playing = newValue;
	// freeze or restart the countdown bar of the screen on show
	currentDisplay()?.syncCountdown(playing);
	const playButton = document.querySelector('#NavigatePlay');
	localStorage.setItem('play', playing);

	if (playing) {
		noSleep(true);
		playButton.title = 'Pause';
		playButton.src = 'images/nav/ic_pause_white_24dp_2x.png';
	} else {
		noSleep(false);
		playButton.title = 'Play';
		playButton.src = 'images/nav/ic_play_arrow_white_24dp_2x.png';
	}
	// if we're playing and on the progress screen jump to the next screen
	if (!progress) return;
	if (playing && !currentDisplay()) navTo(msg.command.firstFrame);
};

// handle all navigation buttons
const handleNavButton = (button) => {
	// before a location is loaded there is nothing to navigate: showing the menu (progress
	// screen) here used to draw it below the start screen. Point the user to the search box.
	if (weatherParameters.latitude === undefined) {
		document.querySelector('#txtAddress')?.focus();
		return;
	}
	switch (button) {
		case 'play':
			setPlaying(true);
			break;
		case 'playToggle':
			setPlaying(!playing);
			break;
		case 'stop':
			setPlaying(false);
			break;
		case 'next':
			setPlaying(false);
			navTo(msg.command.nextFrame);
			break;
		case 'previous':
			setPlaying(false);
			navTo(msg.command.previousFrame);
			break;
		case 'menu':
			setPlaying(false);
			progress.showCanvas();
			hideAllCanvases();
			break;
		default:
			console.error(`Unknown navButton ${button}`);
	}
};

// return the specificed display
const getDisplay = (index) => displays[index];

// resize the container on a page resize
const resize = () => {
	const targetWidth = settings.wide.value ? 640 + 107 + 107 : 640;
	const container = document.querySelector('#container');
	const twc = document.querySelector('#divTwc');
	// one device pixel in CSS pixels, for the scan lines (_scan-lines.scss)
	document.body.style.setProperty('--scan-px', `${1 / (window.devicePixelRatio || 1)}px`);

	// full screen and kiosk: the screen fills the window
	if (document.fullscreenElement || settings.kiosk?.value) {
		const widthZoomPercent = (document.querySelector('#divTwcBottom').getBoundingClientRect().width) / targetWidth;
		container.style.transform = `scale(${Math.min(widthZoomPercent, window.innerHeight / 480)})`;
		container.style.marginBottom = '';
		twc.style.width = '';
		twc.style.removeProperty('--screen-height');
		return;
	}

	// on the page: as wide as its place (the layout is in _site.scss), larger than its 640 or 854 px when there is room, and, when
	// the window is tall enough to show it, not taller than the window leaves under the header and over the control bar
	twc.style.width = '';
	const place = twc.clientWidth;
	const chrome = (document.querySelector('.site-header')?.offsetHeight ?? 0) + document.querySelector('#divTwcBottom').offsetHeight + 60;
	const heightZoomPercent = window.innerHeight >= 600 ? (window.innerHeight - chrome) / 480 : Infinity;
	const scale = Math.max(0.2, Math.min(place / targetWidth, heightZoomPercent));
	container.style.transform = `scale(${scale})`;
	// the scaled screen keeps its 480 px in the layout: take or give the difference
	container.style.marginBottom = `${480 * (scale - 1)}px`;
	twc.style.width = `${Math.round(targetWidth * scale)}px`;
	twc.style.setProperty('--screen-height', `${480 * scale}px`);
};

// reset all statuses to loading on all displays, used to keep the progress bar accurate during refresh
const resetStatuses = () => {
	displays.forEach((display) => { display.status = STATUS.loading; });
};

// allow displays to register themselves
const registerDisplay = (display) => {
	const navId = DISPLAY_ORDER.indexOf(display.elemId);
	if (navId < 0) throw new Error(`registerDisplay: "${display.elemId}" is not in DISPLAY_ORDER (navigation.mjs)`);
	if (displays[navId]) throw new Error(`registerDisplay: "${display.elemId}" registered twice`);
	display.navId = navId;
	displays[navId] = display;

	// generate checkboxes
	generateCheckboxes();
};

// screens grouped on the page (in rotation order inside each group); anything not listed is weather
const DISPLAY_GROUPS = [
	{ title: 'Weather', ids: null },
	{ title: 'Personal', ids: ['work-schedule'] },
	{ title: 'Aviation', ids: ['metar', 'departures', 'cancellations', 'overhead'] },
	{ title: 'News', ids: ['news'] },
	{ title: 'Media', ids: ['plex'] },
	{ title: 'Formula 1', ids: ['f1-last-race', 'f1-grid', 'f1-telemetry', 'f1-standings', 'f1-next-race', 'f1-jet'] },
	{ title: 'GT World', ids: ['gt-race', 'gt-next-race'] },
];
// screens that read data served by the Raspberry Pi (skipped anywhere else)
const PI_ONLY = ['departures', 'cancellations', 'overhead', 'work-schedule', 'f1-jet', 'news', 'plex', 'gt-race', 'gt-next-race'];

const generateCheckboxes = () => {
	const availableDisplays = document.querySelector('#enabledDisplays');

	if (!availableDisplays) return;
	const grouped = new Set(DISPLAY_GROUPS.flatMap((g) => g.ids ?? []));
	const groups = DISPLAY_GROUPS.map((group) => {
		const members = displays.filter((d) => d && (group.ids ? group.ids.includes(d.elemId) : !grouped.has(d.elemId)));
		const checkboxes = members.map((d) => {
			const label = d.generateCheckbox(d.defaultEnabled);
			if (label && PI_ONLY.includes(d.elemId) && !label.querySelector('.pi-only')) {
				const tag = document.createElement('span');
				tag.className = 'pi-only';
				tag.textContent = 'Pi';
				label.append(tag);
			}
			return label;
		}).filter((d) => d);
		if (!checkboxes.length) return null;
		const box = document.createElement('div');
		box.className = 'display-group';
		const title = document.createElement('div');
		title.className = 'display-group-title';
		title.textContent = group.title;
		box.append(title, ...checkboxes);
		return box;
	}).filter((g) => g);

	// write to page
	availableDisplays.innerHTML = '';
	availableDisplays.append(...groups);
};

// special registration method for progress display
const registerProgress = (_progress) => {
	progress = _progress;
};

const populateWeatherParameters = (params) => {
	document.querySelector('#spanCity').textContent = `${params.city}, `;
	document.querySelector('#spanState').textContent = params.state;
};

const autoRefreshChange = (e) => {
	const { checked } = e.target;

	if (checked) {
		startAutoRefreshTimer();
	} else {
		stopAutoRefreshTimer();
	}

	localStorage.setItem('autoRefresh', checked);
};

const AssignLastUpdate = (date) => {
	if (date) {
		document.querySelector('#spanLastRefresh').innerHTML = date.toLocaleString('en-US', {
			weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short', hourCycle: ConversionHelpers.getHourCycle(),
		});
		if (document.querySelector(CHK_AUTO_REFRESH_SELECTOR).checked) startAutoRefreshTimer();
	} else {
		document.querySelector('#spanLastRefresh').innerHTML = '(none)';
	}
};

const latLonReceived = async (data, haveDataCallback) => {
	// clear the timestamp before loading (it used to be cleared afterwards, wiping the new value)
	AssignLastUpdate(null);
	try {
		const point = await getWeather(data, haveDataCallback);
		await getMarineForecast(data, point, haveDataCallback);

		// We can immediately start playing (auto play),
		// as all data has been retrieved
		setPlaying(true);
	} catch (error) {
		// a network or API failure must not stop the auto refresh for good
		console.error('latLonReceived: failed to get data, retrying on next refresh', error);
	} finally {
		// make sure the auto refresh starts even if a display is stuck in "loading"
		// or the data load failed
		if (document.querySelector(CHK_AUTO_REFRESH_SELECTOR)?.checked) startAutoRefreshTimer();
	}
};

const startAutoRefreshTimer = () => {
	// Ensure that any previous timer has already stopped.
	// check if timer is running
	if (AutoRefreshIntervalId) return;

	// Reset the time elapsed.
	AutoRefreshCountMs = 0;

	const AutoRefreshTimer = () => {
		// Increment the total time elapsed.
		AutoRefreshCountMs += AUTO_REFRESH_INTERVAL_MS;

		// Display the count down.
		let RemainingMs = (AUTO_REFRESH_TIME_MS - AutoRefreshCountMs);
		if (RemainingMs < 0) {
			RemainingMs = 0;
		}
		const dt = new Date(RemainingMs);
		// the countdown under the screen: only when its text changes (the timer runs twice a second)
		const countdown = `${dt.getMinutes().toString().padStart(2, '0')}:${dt.getSeconds().toString().padStart(2, '0')}`;
		const countdownElem = document.querySelector('#spanRefreshCountDown');
		if (countdownElem.textContent !== countdown) countdownElem.textContent = countdown;

		// Time has elapsed.
		if (AutoRefreshCountMs >= AUTO_REFRESH_TIME_MS && !isPlaying()) loadTwcData();
	};
	AutoRefreshIntervalId = window.setInterval(AutoRefreshTimer, AUTO_REFRESH_INTERVAL_MS);
	AutoRefreshTimer();
};
const stopAutoRefreshTimer = () => {
	if (AutoRefreshIntervalId) {
		window.clearInterval(AutoRefreshIntervalId);
		document.querySelector('#spanRefreshCountDown').innerHTML = '--:--';
		AutoRefreshIntervalId = null;
	}
};

const refreshCheck = () => {
	// Time has elapsed.
	if (AutoRefreshCountMs >= AUTO_REFRESH_TIME_MS && isPlaying()) {
		loadTwcData();
		return true;
	}
	return false;
};

const loadTwcData = () => {
	if (loadTwcData.callback) loadTwcData.callback();
};

const registerRefreshData = (callback) => {
	loadTwcData.callback = callback;
};

const timeZone = () => weatherParameters.timeZone;

export {
	DISPLAY_GROUPS,
	hideAllCanvases,
	updateStatus,
	displayNavMessage,
	resetStatuses,
	isPlaying,
	resize,
	registerDisplay,
	registerProgress,
	currentDisplay,
	getDisplay,
	msg,
	message,
	latLonReceived,
	stopAutoRefreshTimer,
	registerRefreshData,
	timeZone,
};
