// Halloween effects (a cobweb in each top corner, a jack-o'-lantern now and then at the sides):
// Off, On, or Automatic on 30 and 31 October, the days of the [Halloween] songs
import { ON, AUTOMATIC } from './dark-mode.mjs';

// a small seeded random generator, so that the jack-o'-lanterns are laid out the same way on every start
const random = (seed) => {
	let state = seed;
	// a linear congruential generator: the product stays below 2^53, so the arithmetic is exact
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
};

const isHalloween = (mode, now) => {
	if (Number(mode) === ON) return true;
	return Number(mode) === AUTOMATIC && now.getMonth() === 9 && now.getDate() >= 30;
};

// the TV's overscan cuts about 25 px of the page at the sides
const OVERSCAN = 25;
// the jack-o'-lanterns: which side, how far from the edge of the page, size, how long a round lasts and when it starts. They
// show at the sides, on the line above the bottom line, one side at a time, clear of the overscan of the TV (they may go
// over the edge of the boxes, and over the content of the 4:3 page)
const pumpkinsLayout = (seed = 3) => {
	const rnd = random(seed);
	const edge = OVERSCAN + 5;
	return [
		{
			side: 'left', edge, size: 88 + rnd() * 4, round: 70, delay: -50,
		},
		{
			side: 'right', edge, size: 80 + rnd() * 4, round: 70, delay: -15,
		},
	];
};

export {
	isHalloween, pumpkinsLayout, OVERSCAN,
};
