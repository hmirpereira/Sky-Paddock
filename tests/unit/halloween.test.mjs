// Halloween effects: the dates of the automatic mode and the layout of the jack-o-lanterns
import test from 'node:test';
import assert from 'node:assert/strict';
import {
	isHalloween, pumpkinsLayout, OVERSCAN,
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

test('a jack-o-lantern on each side, on different rounds', () => {
	const [left, right] = pumpkinsLayout();
	assert.deepEqual([left.side, right.side], ['left', 'right']);
	assert.notEqual(left.delay, right.delay);
});

test('the jack-o-lanterns stay clear of the TV overscan', () => {
	pumpkinsLayout().forEach((p) => assert.ok(p.edge > OVERSCAN, `${p.side} edge ${p.edge}`));
});
