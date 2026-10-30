// Halloween effects over every screen: a cobweb in each top corner (still) and a jack-o'-lantern now and then at the sides.
// The setting Halloween Effects is Off, On or Automatic (30 and 31 October). The only animations are the jack-o'-lanterns'
// (_halloween.scss): the bats and spiders that crossed the page made the Hourly Forecast crawl on the Pi.
import { isHalloween, pumpkinsLayout } from './utils/halloween.mjs';
import { OFF } from './utils/dark-mode.mjs';
import autoTimer from './utils/auto-timer.mjs';

let mode = OFF;
let timer = null;
let built = false;

// the pictures supplied by the owner, in images/halloween (the webs are cut from his sheets by ferramentas/mkhalloween.py)
const PUMPKIN_PICTURE = 'images/halloween/jackolantern.png';
const WEB_PICTURES = [['left', 'images/halloween/teia.png'], ['right', 'images/halloween/aranha.png']];

const build = () => {
	const overlay = document.querySelector('#halloween');
	if (!overlay || built) return;
	built = true;

	const webs = document.createElement('div');
	webs.className = 'webs';
	WEB_PICTURES.forEach(([side, source]) => {
		const picture = document.createElement('img');
		picture.className = `web ${side}`;
		picture.src = source;
		picture.alt = '';
		webs.append(picture);
	});

	const pumpkins = document.createElement('div');
	pumpkins.className = 'pumpkins';
	pumpkinsLayout().forEach((p) => {
		const holder = document.createElement('div');
		holder.className = `pumpkin ${p.side}`;
		holder.style.cssText = `${p.side}:${p.edge}px;width:${p.size.toFixed(0)}px;animation-duration:${p.round}s;animation-delay:${p.delay}s`;
		const picture = document.createElement('img');
		picture.src = PUMPKIN_PICTURE;
		picture.alt = '';
		holder.append(picture);
		pumpkins.append(holder);
	});
	overlay.append(webs, pumpkins);
};

const apply = () => {
	const on = isHalloween(mode, new Date());
	if (on) build();
	document.querySelector('#divTwc')?.classList.toggle('halloween', on);
};

// the setting changed (1 Off, 2 On, 3 Automatic); the automatic one looks at the date once a minute
const setHalloween = (value) => {
	mode = Number(value) || OFF;
	timer = autoTimer(timer, mode, apply);
	apply();
};

export default setHalloween;
