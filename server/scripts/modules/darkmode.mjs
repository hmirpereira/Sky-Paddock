// dark mode of the weather screens (setting Dark Mode: Off, On, Automatic): sets the class dark-mode on the page
// (_dark-mode.scss). Automatic follows the sun at the chosen location.
import {
	OFF, isDark,
} from './utils/dark-mode.mjs';
import autoTimer from './utils/auto-timer.mjs';

let mode = OFF;
let place = null;
let timer = null;

const apply = () => {
	let times = null;
	if (place) {
		// the sun of today at the place, asked at noon so that it is never the sun of another day
		const noon = new Date();
		noon.setHours(12, 0, 0, 0);
		times = window.SunCalc.getTimes(noon, place.lat, place.lon);
	}
	document.querySelector('#divTwc')?.classList.toggle('dark-mode', isDark(mode, new Date(), times));
};

// the setting changed (1 Off, 2 On, 3 Automatic); the automatic one looks at the sun once a minute
const setDarkMode = (value) => {
	mode = Number(value) || OFF;
	timer = autoTimer(timer, mode, apply);
	apply();
};

// the place the screens are about (the automatic mode needs it)
const setDarkModePlace = ({ lat, lon }) => {
	place = { lat, lon };
	apply();
};

export { setDarkMode, setDarkModePlace };
