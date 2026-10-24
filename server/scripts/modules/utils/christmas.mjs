// Christmas effects (hanging lights, falling snow): Off, On, or Automatic from 1 to 25 December, the days of the Christmas songs
import { ON, AUTOMATIC } from './dark-mode.mjs';

const isChristmas = (mode, now) => {
	if (Number(mode) === ON) return true;
	return Number(mode) === AUTOMATIC && now.getMonth() === 11 && now.getDate() <= 25;
};

// a small seeded random generator, so that the lights and the snow are laid out the same way on every start
const random = (seed) => {
	let state = seed;
	// a linear congruential generator: the product stays below 2^53, so the arithmetic is exact
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
};

// the wire of the lights: spans between irregular fixing points near the top of the header, each one sagging by its own
// amount, with bulbs hanging at random places of the span on cords of different lengths. Sizes are in px of the page
// (640 x 480, or 854 wide). Returns the wire spans and the bulbs.
const lightsLayout = (width, seed = 7) => {
	const rnd = random(seed);
	const spans = [];
	const bulbs = [];
	let x = -10;
	let y = 20 + rnd() * 3;
	while (x < width + 10) {
		const length = 90 + rnd() * 90;
		const x1 = x + length;
		const y1 = 19 + rnd() * 4;
		const sag = 3 + rnd() * 6;
		const cx = x + length / 2 + (rnd() - 0.5) * 24;
		const cy = (y + y1) / 2 + sag * 2;
		spans.push({
			x0: x, y0: y, cx, cy, x1, y1,
		});
		const count = 3 + Math.floor(rnd() * 4);
		for (let i = 0; i < count; i += 1) {
			const t = (i + 0.3 + rnd() * 0.5) / count;
			// the point of the quadratic curve at t
			const px = (1 - t) ** 2 * x + 2 * (1 - t) * t * cx + t ** 2 * x1;
			const py = (1 - t) ** 2 * y + 2 * (1 - t) * t * cy + t ** 2 * y1;
			bulbs.push({
				x: px, y: py, cord: 2 + rnd() * 3, lean: (rnd() - 0.5) * 3, radius: 2.4 + rnd() * 1.2, colour: Math.floor(rnd() * 5), group: Math.floor(rnd() * 4), delay: rnd() * 2,
			});
		}
		x = x1;
		y = y1;
	}
	return { spans, bulbs };
};

// the snow: a few small flakes, each in three depths (far: small, slow, faint; near: big, fast, bright). Few and small on purpose:
// every flake is a layer of its own for the compositor and the Pi pays for the size of the layers. Returns, for each flake,
// where it starts across the page (%), its size (px), how long it takes to fall (s), how far it drifts (px), when it starts and its opacity.
const snowFlakes = (count = 18, seed = 11) => {
	const rnd = random(seed);
	return Array.from({ length: count }, (_, i) => {
		const depth = i % 3;
		return {
			left: rnd() * 100,
			size: [2, 3, 4.5][depth] + rnd() * 0.8,
			fall: [20, 14, 9][depth] + rnd() * 3,
			drift: (rnd() - 0.5) * 50,
			delay: -rnd() * 20,
			opacity: [0.55, 0.8, 0.95][depth],
		};
	});
};

export {
	isChristmas, random, lightsLayout, snowFlakes,
};
