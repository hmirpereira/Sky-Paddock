// Christmas effects over every screen: a string of lights along the top of the page and a pile of snow along the bottom (the owner's pictures).
// The setting Christmas Effects is Off, On or Automatic (1 to 25 December).
import isChristmas from './utils/christmas.mjs';
import { OFF } from './utils/dark-mode.mjs';
import autoTimer from './utils/auto-timer.mjs';

let mode = OFF;
let timer = null;
let built = false;

const build = () => {
	const overlay = document.querySelector('#christmas');
	if (!overlay || built) return;
	built = true;
	[['lights', 'luzes'], ['snow', 'neve']].forEach(([className, name]) => {
		const picture = document.createElement('img');
		picture.className = className;
		picture.src = `images/christmas/${name}.png`;
		picture.alt = '';
		overlay.append(picture);
	});
};

const apply = () => {
	const on = isChristmas(mode, new Date());
	if (on) build();
	document.querySelector('#divTwc')?.classList.toggle('christmas', on);
};

// the setting changed (1 Off, 2 On, 3 Automatic); the automatic one looks at the date once a minute
const setChristmas = (value) => {
	mode = Number(value) || OFF;
	timer = autoTimer(timer, mode, apply);
	apply();
};

export default setChristmas;
