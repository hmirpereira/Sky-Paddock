// Halloween effects over every screen: bats flying, spiders walking and a jack-o'-lantern now and then at the sides.
// The setting Halloween Effects is Off, On or Automatic (30 and 31 October). CSS animations only (_halloween.scss),
// a few of them, to keep the Pi light.
import {
	isHalloween, batsLayout, spidersLayout, pumpkinsLayout,
} from './utils/halloween.mjs';
import { OFF } from './utils/dark-mode.mjs';
import autoTimer from './utils/auto-timer.mjs';

let mode = OFF;
let timer = null;
let built = false;

// the pictures supplied by the owner, in images/halloween
const BAT_PICTURE = 'images/halloween/morcego.png';
const PUMPKIN_PICTURE = 'images/halloween/jackolantern.png';
const SPIDER_PICTURE = 'images/halloween/aranha.png';

const build = () => {
	const overlay = document.querySelector('#halloween');
	if (!overlay || built) return;
	built = true;

	const bats = document.createElement('div');
	bats.className = 'bats';
	batsLayout().forEach((b) => {
		const bat = document.createElement('div');
		bat.className = `bat${b.reverse ? ' back' : ''}`;
		bat.style.cssText = `top:${b.top.toFixed(0)}px;animation-duration:${b.cross.toFixed(1)}s;animation-delay:${b.delay.toFixed(1)}s;--wave:${b.wave.toFixed(0)}px;--flap:${b.flap.toFixed(2)}s`;
		const picture = document.createElement('img');
		picture.src = BAT_PICTURE;
		picture.alt = '';
		picture.style.width = `${(60 * b.size).toFixed(0)}px`;
		bat.append(picture);
		bats.append(bat);
	});

	const spiders = document.createElement('div');
	spiders.className = 'spiders';
	spidersLayout().forEach((s) => {
		const walker = document.createElement('div');
		walker.className = `walker${s.reverse ? ' back' : ''}`;
		walker.style.cssText = `top:${s.top.toFixed(0)}px;animation-duration:${s.cross.toFixed(0)}s;animation-delay:${s.delay.toFixed(0)}s;--wobble:${s.wobble.toFixed(0)}px`;
		const picture = document.createElement('img');
		picture.src = SPIDER_PICTURE;
		picture.alt = '';
		picture.style.width = `${(s.size * 7).toFixed(0)}px`;
		walker.append(picture);
		spiders.append(walker);
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
	overlay.append(bats, spiders, pumpkins);
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
