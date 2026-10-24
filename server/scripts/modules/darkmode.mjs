// dark mode of the weather screens (setting Dark Mode: Off, On, Automatic): sets the class dark-mode on the page
// (_dark-mode.scss) and the state in the version mark. Automatic follows the sun at the chosen location.
import {
	OFF, LABELS, isDark,
} from './utils/dark-mode.mjs';

let mode = OFF;
let place = null;
let timer = null;
// the version mark as the page wrote it, without the state of the dark mode
let versionText = null;

const apply = () => {
	let times = null;
	if (place) {
		// the sun of today at the place, asked at noon so that it is never the sun of another day
		const noon = new Date();
		noon.setHours(12, 0, 0, 0);
		times = window.SunCalc.getTimes(noon, place.lat, place.lon);
	}
	document.querySelector('#divTwc')?.classList.toggle('dark-mode', isDark(mode, new Date(), times));

	const mark = document.querySelector('#version-mark');
	if (mark) {
		versionText ??= mark.textContent;
		mark.textContent = `${versionText} DARK ${String(LABELS[mode]).toUpperCase()}`;
	}
};

// the setting changed (1 Off, 2 On, 3 Automatic); the automatic one looks at the sun once a minute
const setDarkMode = (value) => {
	mode = Number(value) || OFF;
	clearInterval(timer);
	timer = mode === 3 ? setInterval(apply, 60 * 1000) : null;
	apply();
};

// the place the screens are about (the automatic mode needs it)
const setDarkModePlace = ({ lat, lon }) => {
	place = { lat, lon };
	apply();
};

export { setDarkMode, setDarkModePlace };
