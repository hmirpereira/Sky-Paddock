// Christmas effects over every screen: lights hanging along the header and snow falling over the text.
// The setting Christmas Effects is Auto (1 to 25 December), On or Off. Everything is animated with CSS (_christmas.scss) and
// on as few layers as possible, because the Pi has no GPU worth the name: the wire is one picture, the bulbs are four
// pictures that blink (one animation each) and the snow is a few small flakes.
import { isChristmas, lightsLayout, snowFlakes } from './utils/christmas.mjs';
import { OFF } from './utils/dark-mode.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const COLOURS = ['#ff3b3b', '#4dff7a', '#ffd83b', '#4da6ff', '#ff6fd8'];
// the widest page (widescreen); on the 640 px page the right side is cut by the container
const WIDTH = 854;
const GROUPS = 4;

let mode = OFF;
let timer = null;
let built = false;

const svg = (name, attributes) => {
	const element = document.createElementNS(SVG_NS, name);
	Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
	return element;
};

const picture = (className) => svg('svg', {
	class: className, viewBox: `0 0 ${WIDTH} 70`, width: WIDTH, height: 70,
});

const build = () => {
	const overlay = document.querySelector('#christmas');
	if (!overlay || built) return;
	built = true;

	const { spans, bulbs } = lightsLayout(WIDTH);
	const wire = picture('lights wire');
	spans.forEach((s) => wire.append(svg('path', { class: 'wire', d: `M${s.x0.toFixed(1)} ${s.y0.toFixed(1)} Q${s.cx.toFixed(1)} ${s.cy.toFixed(1)} ${s.x1.toFixed(1)} ${s.y1.toFixed(1)}` })));
	const groups = Array.from({ length: GROUPS }, (_, i) => picture(`lights bulbs g${i}`));
	bulbs.forEach((b) => {
		const by = b.y + b.cord;
		const bx = b.x + b.lean;
		groups[b.group % GROUPS].append(
			svg('line', {
				class: 'cord', x1: b.x.toFixed(1), y1: b.y.toFixed(1), x2: bx.toFixed(1), y2: by.toFixed(1),
			}),
			svg('circle', {
				class: 'glow', cx: bx.toFixed(1), cy: (by + b.radius).toFixed(1), r: (b.radius * 2.6).toFixed(1), fill: COLOURS[b.colour],
			}),
			svg('circle', {
				class: 'light', cx: bx.toFixed(1), cy: (by + b.radius).toFixed(1), r: b.radius.toFixed(1), fill: COLOURS[b.colour],
			}),
		);
	});

	const snow = document.createElement('div');
	snow.className = 'snow';
	snowFlakes().forEach((f) => {
		const flake = document.createElement('i');
		flake.style.cssText = `left:${f.left.toFixed(1)}%;width:${f.size.toFixed(1)}px;height:${f.size.toFixed(1)}px;opacity:${f.opacity};`
			+ `animation-duration:${f.fall.toFixed(1)}s;animation-delay:${f.delay.toFixed(1)}s;--drift:${f.drift.toFixed(0)}px`;
		snow.append(flake);
	});
	overlay.append(wire, ...groups, snow);
};

const apply = () => {
	const on = isChristmas(mode, new Date());
	if (on) build();
	document.querySelector('#divTwc')?.classList.toggle('christmas', on);
};

// the setting changed (1 Off, 2 On, 3 Automatic); the automatic one looks at the date once a minute
const setChristmas = (value) => {
	mode = Number(value) || OFF;
	clearInterval(timer);
	timer = mode === 3 ? setInterval(apply, 60 * 1000) : null;
	apply();
};

export default setChristmas;
