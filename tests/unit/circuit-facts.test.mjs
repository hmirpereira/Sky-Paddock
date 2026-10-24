// lap records and corner labels of the F1 Next Race map: each one must sit on a circuit the screen can draw
import test from 'node:test';
import assert from 'node:assert/strict';
import FACTS from '../../server/scripts/modules/utils/circuit-facts.mjs';
import CIRCUITS from '../../server/scripts/modules/utils/f1-circuits.mjs';
import {
	circuitView, lapOf, LETTER_WIDTH, TEXT_ABOVE,
} from '../../server/scripts/modules/utils/circuit-view.mjs';

test('circuit facts: every circuit has an outline and a lap record', () => {
	Object.keys(CIRCUITS).forEach((id) => assert.ok(FACTS[id], `${id} has no facts`));
	Object.entries(FACTS).forEach(([id, { record }]) => {
		const circuit = CIRCUITS[id];
		assert.ok(circuit, `${id} has no outline`);
		assert.match(record.time, /^\d:\d\d\.\d{3}$/);
		assert.match(record.driver, /^[A-Za-z ]+$/, 'the Star4000 fonts have no accents');
		assert.ok(record.year >= circuit.firstgp && record.year <= 2030, id);
	});
});

test('circuit facts: the start line is a share of the lap and the corners are on the outline and fit in the map', () => {
	Object.entries(FACTS).forEach(([id, { start, corners = [] }]) => {
		const circuit = CIRCUITS[id];
		if (start !== undefined) assert.ok(start >= 0 && start < 1, `${id} start`);
		assert.ok(corners.length === 0 || start !== undefined, `${id} has corners but no checked start`);
		const points = circuit.path.split(' ').map((p) => p.split(',').map(Number));
		// distance of a point to the outline, in outline units
		const distance = (x, y) => Math.min(...points.slice(1).map(([bx, by], i) => {
			const [ax, ay] = points[i];
			const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1)));
			return Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
		}));
		corners.forEach(([name, x, y, side]) => {
			assert.match(name, /^[A-Za-z0-9 ]+$/, 'the Star4000 fonts have no accents');
			assert.ok(['l', 'r', 'm'].includes(side), `${id} ${name}`);
			assert.ok(distance(x, y) < 3, `${id} ${name} is not on the outline`);
		});
		const view = circuitView(circuit.w, circuit.h, corners);
		view.labels.forEach(({
			x, y, side, name,
		}) => {
			const width = name.length * LETTER_WIDTH * view.u;
			const [left, right] = { l: [x - width, x], r: [x, x + width], m: [x - width / 2, x + width / 2] }[side];
			assert.ok(left >= view.x - 1 && right <= view.x + view.width + 1, `${id} ${name} is cut at the side`);
			assert.ok(y - TEXT_ABOVE * view.u >= view.y - 1 && y <= view.y + view.height + 1, `${id} ${name} is cut at the top or bottom`);
		});
		// the outline is not shrunk too much to make room for the names (270 px wide, 280 px high box)
		assert.ok(1 / view.u > 0.14, `${id} is drawn too small: ${(1 / view.u).toFixed(3)}`);
	});
});

test('lap: a point at the start, one a lap later and the way it is going', () => {
	const square = '0,0 100,0 100,100 0,100 0,0';
	const lap = lapOf(square);
	assert.equal(lap.total, 400);
	assert.deepEqual([lap.at(50).x, lap.at(50).y, lap.at(50).ux, lap.at(50).uy], [50, 0, 1, 0]);
	assert.deepEqual([lap.at(450).x, lap.at(450).y], [50, 0]);
	assert.deepEqual([lap.at(-50).x, lap.at(-50).y], [0, 50]);
	const back = lapOf(square, true);
	assert.deepEqual([back.at(50).x, back.at(50).y, back.at(50).ux, back.at(50).uy], [0, 50, 0, 1]);
});

test('circuit view: a circuit without names keeps the plain margin', () => {
	const view = circuitView(800, 1000);
	assert.deepEqual([view.x, view.y, view.width, view.height], [-40, -40, 880, 1080]);
});
