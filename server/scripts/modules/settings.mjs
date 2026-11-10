import Setting from './utils/setting.mjs';
import { IPMA_AREAS } from './utils/ipma-areas.mjs';
import { DEFAULT_DETAIL_CITY, detailCityChoices } from './utils/travel-cities.mjs';
import { setDarkMode } from './darkmode.mjs';
import setChristmas from './christmas.mjs';
import setHalloween from './halloween.mjs';
import setMusicName from './utils/music-name.mjs';
import { OFF, ON, AUTOMATIC } from './utils/dark-mode.mjs';

document.addEventListener('DOMContentLoaded', () => {
	init();
});

// default speed
const settings = {
	// shown first on the page
	airportIcao: { value: '' },
	ipmaArea: { value: 0 },
	travelCity: { value: DEFAULT_DETAIL_CITY },
	windUnits: { value: 2 },
	temperatureUnits: { value: 1 },
	distanceUnits: { value: 1 },
	pressureUnits: { value: 1 },
	hoursFormat: { value: 2 },
	speed: { value: 1.0 },
	kiosk: { value: false },
	debugMode: { value: false },
	scanLines: { value: false },
	vignette: { value: false },
	colorFringe: { value: false },
	imageFringe: { value: false },
	newsTicker: { value: false },
	personalSchedule: { value: ON },
	personalGates: { value: ON },
	darkMode: { value: OFF },
	christmas: { value: AUTOMATIC },
	halloween: { value: AUTOMATIC },
};

const init = () => {
	// local airport (Airport METAR, Departures and Cancellations titles) and IPMA warning area (Hazards);
	// nothing is set by default, so the code has no place in it: the Pi's address sets them
	settings.airportIcao = new Setting('airportIcao', 'Airport ICAO code', 'text', '', null, true, { placeholder: 'e.g. EDDF', maxLength: 4 });
	settings.ipmaArea = new Setting('ipmaArea', 'IPMA warning area', 'select', 0, null, true, [
		[0, 'none'],
		...IPMA_AREAS.map(([n, , name]) => [n, name]),
	]);

	// city on the second page of the Travel Forecast (utils/travel-cities.mjs)
	settings.travelCity = new Setting('travelCity', 'Travel Forecast city', 'select', DEFAULT_DETAIL_CITY, null, true, detailCityChoices());

	// Customizable measurement units
	settings.windUnits = new Setting('windUnits', 'Wind Units', 'select', 2, windUnitsChange, true, [
		[1, 'm/s'],
		[2, 'km/h'],
		[3, 'knots'],
		[4, 'mph'],
		[5, 'bft'],
	]);
	settings.temperatureUnits = new Setting('temperatureUnits', 'Temperature Units', 'select', 1, temperatureChangeUnits, true, [
		[1, 'C'],
		[2, 'F'],
		[3, 'K'],
	]);
	settings.distanceUnits = new Setting('distanceUnits', 'Distance Units', 'select', 1, distanceChangeUnits, true, [
		[1, 'km'],
		[2, 'mi'],
		[3, 'ft'],
		[4, 'meters'],
		[5, 'bananas'],
	]);
	settings.pressureUnits = new Setting('pressureUnits', 'Pressure Units', 'select', 1, pressureChangeUnits, true, [
		[1, 'hPa'],
		[2, 'inHG'],
		[3, 'mmHG'],
	]);
	settings.hoursFormat = new Setting('hoursFormat', 'Hours Format', 'select', 2, hoursChangeFormat, true, [
		[1, '12-hour'],
		[2, '24-hour'],
	]);

	settings.speed = new Setting('speed', 'Speed', 'select', 1.0, null, true, [
		[0.5, 'Very Fast'],
		[0.75, 'Fast'],
		[1.0, 'Normal'],
		[1.25, 'Slow'],
		[1.5, 'Very Slow'],
	]);
	// Work Schedule: the (R) schedule of each day in small under the shift (On), or the big text only (Off)
	settings.personalSchedule = new Setting('personalSchedule', 'Personal Schedule', 'select', ON, null, true, [
		[ON, 'On'],
		[OFF, 'Off'],
	]);
	// Work Schedule, Gates page: shown greyed out and does nothing yet (its function is still to come), so it is not stored
	settings.personalGates = new Setting('personalGates', 'Personal Gates', 'select', ON, null, false, [
		[ON, 'On'],
		[OFF, 'Off'],
	]);
	// dark weather screens: Off, On, or Automatic (10 minutes after the sunset until 10 minutes after the sunrise)
	settings.darkMode = new Setting('darkMode', 'Dark Mode', 'select', OFF, setDarkMode, true, [
		[OFF, 'Off'],
		[ON, 'On'],
		[AUTOMATIC, 'Auto'],
	]);
	// string of lights along the top of every screen: Auto (1 to 25 December), On or Off
	settings.christmas = new Setting('christmas', 'Christmas Effects', 'select', AUTOMATIC, setChristmas, true, [
		[AUTOMATIC, 'Auto'],
		[ON, 'On'],
		[OFF, 'Off'],
	]);
	// cobwebs in the top corners and jack-o'-lanterns over every screen: Auto (30 and 31 October), On or Off
	settings.halloween = new Setting('halloween', 'Halloween Effects', 'select', AUTOMATIC, setHalloween, true, [
		[AUTOMATIC, 'Auto'],
		[ON, 'On'],
		[OFF, 'Off'],
	]);
	settings.scanLines = new Setting('scanLines', 'Enable Scan Lines', 'checkbox', false, scanLinesChange, true);
	// analogue look (_scan-lines.scss): darker corners like a picture tube, red and blue fringe on the text like VHS
	settings.vignette = new Setting('vignette', 'Enable Vignette', 'checkbox', false, (value) => document.body.classList.toggle('vignette', !!value), true);
	settings.colorFringe = new Setting('colorFringe', 'Enable Colour Fringe on Text (VHS)', 'checkbox', false, (value) => document.body.classList.toggle('color-fringe', !!value), true);
	settings.imageFringe = new Setting('imageFringe', 'Enable Colour Fringe on Pictures (VHS)', 'checkbox', false, (value) => document.body.classList.toggle('image-fringe', !!value), true);

	// Portuguese breaking news crawling in the bottom line, between the weather lines (Pi only, utils/news.mjs)
	settings.newsTicker = new Setting('newsTicker', 'Show Breaking News in the Bottom Line', 'checkbox', false, null, true);
	settings.wide = new Setting('wide', 'Widescreen', 'checkbox', false, wideScreenChange, true);
	settings.kiosk = new Setting('kiosk', 'Kiosk', 'checkbox', false, kioskChange, false);
	// last of the list, for the owner only: version, commit date and the track playing on the Pi in the bottom right corner
	// (utils/music-name.mjs), and the Status screen with the last answer of every source of the Pi service
	settings.debugMode = new Setting('debugMode', 'Debug mode', 'checkbox', false, setDebugMode, true);

	// generate html objects, in groups with a title (a setting not named here is not shown); Debug mode is last of the page
	const GROUPS = [
		['Location', ['airportIcao', 'ipmaArea', 'travelCity']],
		['Units', ['windUnits', 'temperatureUnits', 'distanceUnits', 'pressureUnits', 'hoursFormat']],
		['Screens', ['speed', 'personalSchedule', 'personalGates', 'newsTicker']],
		['Look', ['darkMode', 'wide', 'scanLines', 'vignette', 'colorFringe', 'imageFringe', 'christmas', 'halloween']],
		['Advanced', ['kiosk', 'debugMode']],
	];
	const groupHtml = GROUPS.map(([title, keys]) => {
		const box = document.createElement('div');
		box.className = 'display-group';
		const heading = document.createElement('div');
		heading.className = 'display-group-title';
		heading.textContent = title;
		box.append(heading, ...keys.map((key) => settings[key].generate()).filter((el) => el));
		return box;
	});

	const gates = settings.personalGates.element;
	gates.querySelector('select').disabled = true;
	gates.style.opacity = '0.5';

	// write to page
	const settingsSection = document.querySelector('#settings');
	settingsSection.innerHTML = '';
	settingsSection.append(...groupHtml);
};

const setDebugMode = (value) => {
	document.body.classList.toggle('debug-mode', !!value);
	setMusicName(value);
	// later: on start-up this runs inside the constructor of the setting, and settings.debugMode is still the default one
	setTimeout(() => window.dispatchEvent(new Event('debug-mode')), 0);
};

const temperatureChangeUnits = (value) => {
	if (value) {
		document.documentElement.setAttribute('temperature-units', value);
	}
};

const distanceChangeUnits = (value) => {
	if (value) {
		document.documentElement.setAttribute('distance-units', value);
	}
};

const pressureChangeUnits = (value) => {
	if (value) {
		document.documentElement.setAttribute('pressure-units', value);
	}
};

const windUnitsChange = (value) => {
	if (value) {
		document.documentElement.setAttribute('wind-units', value);
	}
};

const hoursChangeFormat = (value) => {
	if (value) {
		document.documentElement.setAttribute('hours-format', value);
	}
};

const scanLinesChange = (value) => {
	const container = document.querySelector('#divTwc');
	// also on the page body: in kiosk mode the lines are drawn over the whole window (_scan-lines.scss)
	container.classList.toggle('scan-lines', !!value);
	document.body.classList.toggle('scan-lines', !!value);
};

const wideScreenChange = (value) => {
	const container = document.querySelector('#divTwc');
	if (value) {
		container.classList.add('wide');
	} else {
		container.classList.remove('wide');
	}
};

const kioskChange = (value) => {
	const body = document.querySelector('body');
	if (value) {
		body.classList.add('kiosk');
		window.dispatchEvent(new Event('resize'));
	} else {
		body.classList.remove('kiosk');
	}
};

export default settings;
