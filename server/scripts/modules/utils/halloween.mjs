// Halloween effects (bats flying, spiders walking across the screen, a jack-o'-lantern now and then at the sides):
// Off, On, or Automatic on 30 and 31 October, the days of the [Halloween] songs
import { ON, AUTOMATIC } from './dark-mode.mjs';
import { random } from './christmas.mjs';

const isHalloween = (mode, now) => {
	if (Number(mode) === ON) return true;
	return Number(mode) === AUTOMATIC && now.getMonth() === 9 && now.getDate() >= 30;
};

// bats: height of each flight (px from the top of the page), size, how long it takes to cross, when it starts,
// how much it rises and falls on the way, and whether it flies from right to left
const batsLayout = (count = 7, seed = 9) => {
	const rnd = random(seed);
	return Array.from({ length: count }, (_, i) => ({
		top: 30 + rnd() * 300,
		size: 0.6 + rnd() * rnd() * 2,
		cross: 9 + rnd() * 12,
		delay: -(i * 3.4 + rnd() * 5),
		wave: 8 + rnd() * 26,
		reverse: rnd() < 0.4,
		flap: 0.32 + rnd() * 0.3,
	}));
};

// spiders walking: the height they walk at, size, how long they take to cross, when they start and the way they go.
// They go along three lines of the page, one each, so that they do not walk over each other.
const spidersLayout = (count = 3, seed = 5) => {
	const rnd = random(seed);
	const lines = [118, 262, 388];
	return Array.from({ length: count }, (_, i) => ({
		top: lines[i % lines.length] + (rnd() - 0.5) * 10,
		size: 5 + rnd() * 4,
		cross: 38 + rnd() * 22,
		delay: -(i * 17 + rnd() * 10),
		reverse: i % 2 === 1,
		wobble: 3 + rnd() * 5,
	}));
};

// the jack-o'-lanterns: which side, size, how long a round lasts and when it starts. They show in the side bands of the
// widescreen page, on the line above the bottom line, one side at a time
const pumpkinsLayout = (seed = 3) => {
	const rnd = random(seed);
	return [
		{
			side: 'left', size: 88 + rnd() * 4, round: 70, delay: -50,
		},
		{
			side: 'right', size: 80 + rnd() * 4, round: 70, delay: -15,
		},
	];
};

export {
	isHalloween, batsLayout, spidersLayout, pumpkinsLayout,
};
