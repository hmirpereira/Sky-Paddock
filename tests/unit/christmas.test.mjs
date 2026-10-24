// Christmas effects: the dates of the automatic mode and the layout of the lights and the snow
import test from 'node:test';
import assert from 'node:assert/strict';
import { isChristmas, lightsLayout, snowFlakes } from '../../server/scripts/modules/utils/christmas.mjs';
import { OFF, ON, AUTOMATIC } from '../../server/scripts/modules/utils/dark-mode.mjs';

test('Automatic is on from 1 to 25 December only, On always and Off never', () => {
	const day = (m, d) => new Date(2026, m - 1, d, 12);
	assert.equal(isChristmas(AUTOMATIC, day(11, 30)), false);
	assert.equal(isChristmas(AUTOMATIC, day(12, 1)), true);
	assert.equal(isChristmas(AUTOMATIC, day(12, 25)), true);
	assert.equal(isChristmas(AUTOMATIC, day(12, 26)), false);
	assert.equal(isChristmas(AUTOMATIC, day(6, 15)), false);
	assert.equal(isChristmas(ON, day(6, 15)), true);
	assert.equal(isChristmas(OFF, day(12, 10)), false);
});

test('the lights cover the width, hang near the top of the header and are the same every time', () => {
	const { spans, bulbs } = lightsLayout(854);
	assert.ok(spans[0].x0 < 0 && spans.at(-1).x1 > 854);
	spans.forEach((s, i) => { if (i) assert.equal(s.x0, spans[i - 1].x1); });
	bulbs.forEach((b) => assert.ok(b.y > 15 && b.y + b.cord < 45, 'inside the top band'));
	assert.deepEqual(lightsLayout(854), { spans, bulbs });
	assert.ok(new Set(bulbs.map((b) => b.colour)).size > 3);
});

test('the snow is a few small flakes in three depths, the near ones bigger, faster and brighter', () => {
	const flakes = snowFlakes();
	assert.ok(flakes.length <= 20);
	assert.ok(flakes.every((f) => f.left >= 0 && f.left <= 100 && f.size >= 2 && f.size < 6 && f.delay <= 0));
	const far = flakes.filter((_, i) => i % 3 === 0);
	const near = flakes.filter((_, i) => i % 3 === 2);
	assert.ok(Math.min(...near.map((f) => f.size)) > Math.max(...far.map((f) => f.size)));
	assert.ok(Math.max(...near.map((f) => f.fall)) < Math.min(...far.map((f) => f.fall)));
	assert.deepEqual(snowFlakes(), flakes);
});
