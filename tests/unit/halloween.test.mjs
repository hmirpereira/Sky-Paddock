// Halloween effects: the dates of the automatic mode and the layout of the spiders and the bats
import test from 'node:test';
import assert from 'node:assert/strict';
import {
	isHalloween, spidersLayout, batsLayout, pumpkinsLayout, OVERSCAN,
} from '../../server/scripts/modules/utils/halloween.mjs';
import { OFF, ON, AUTOMATIC } from '../../server/scripts/modules/utils/dark-mode.mjs';

test('Automatic is on only on 30 and 31 October, On always and Off never', () => {
	const day = (m, d) => new Date(2026, m - 1, d, 12);
	assert.equal(isHalloween(AUTOMATIC, day(10, 29)), false);
	assert.equal(isHalloween(AUTOMATIC, day(10, 30)), true);
	assert.equal(isHalloween(AUTOMATIC, day(10, 31)), true);
	assert.equal(isHalloween(AUTOMATIC, day(11, 1)), false);
	assert.equal(isHalloween(AUTOMATIC, day(12, 30)), false);
	assert.equal(isHalloween(ON, day(6, 15)), true);
	assert.equal(isHalloween(OFF, day(10, 31)), false);
});

test('the bats come in different sizes and the spiders walk on different lines', () => {
	const bats = batsLayout();
	assert.ok(bats.every((b) => b.top >= 30 && b.top <= 330 && b.delay <= 0));
	assert.ok(Math.max(...bats.map((b) => b.size)) > 1.5 * Math.min(...bats.map((b) => b.size)));
	assert.equal(new Set(bats.map((b) => b.delay.toFixed(1))).size, bats.length);
	const spiders = spidersLayout();
	assert.equal(new Set(spiders.map((s) => Math.round(s.top / 20))).size, spiders.length);
	assert.deepEqual(spidersLayout(), spiders);
});

test('a jack-o-lantern on each side, on different rounds', () => {
	const [left, right] = pumpkinsLayout();
	assert.deepEqual([left.side, right.side], ['left', 'right']);
	assert.notEqual(left.delay, right.delay);
});

test('the jack-o-lanterns stay clear of the TV overscan', () => {
	pumpkinsLayout().forEach((p) => assert.ok(p.edge > OVERSCAN, `${p.side} edge ${p.edge}`));
});
