// lap records and corner labels of the F1 Next Race map: each one must sit on a circuit the screen can draw
import test from 'node:test';
import assert from 'node:assert/strict';
import FACTS from '../../server/scripts/modules/utils/circuit-facts.mjs';
import CIRCUITS from '../../server/scripts/modules/utils/f1-circuits.mjs';

test('circuit facts: every circuit has an outline, a lap record and corners on the outline', () => {
	Object.entries(FACTS).forEach(([id, { record, corners }]) => {
		const circuit = CIRCUITS[id];
		assert.ok(circuit, `${id} has no outline`);
		assert.match(record.time, /^\d:\d\d\.\d{3}$/);
		assert.ok(record.driver && record.year >= circuit.firstgp, id);
		const points = circuit.path.split(' ').map((p) => p.split(',').map(Number));
		corners.forEach(([name, x, y, , , side]) => {
			assert.match(name, /^[A-Za-z ]+$/, 'the Star4000 fonts have no accents');
			assert.ok(['l', 'r'].includes(side), name);
			// the dot sits on the outline: close to one of its points or to a line between two
			const near = (a, b) => {
				const [ax, ay] = a; const [bx, by] = b;
				const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1)));
				return Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
			};
			const distance = Math.min(...points.slice(1).map((p, i) => near(points[i], p)));
			assert.ok(distance < 30, `${id} ${name} is ${Math.round(distance)} from the outline`);
		});
	});
});
