// the timing of the screens that scroll: hold, scroll at 50 px/s, hold
import test from 'node:test';
import assert from 'node:assert/strict';
import { HOLD, scrollSteps, scrollOffset } from '../../server/scripts/modules/utils/scroll-timing.mjs';

test('a screen that does not scroll is shown for the two holds', () => {
	assert.equal(scrollSteps(0), 2 * HOLD);
});

test('the time of the scroll follows the distance, one step per pixel', () => {
	assert.equal(scrollSteps(1449), 1449 + 2 * HOLD);
	assert.equal(scrollSteps(10.2), 11 + 2 * HOLD);
});

test('the box stays at the top during the first hold, scrolls, then stays at the end', () => {
	assert.equal(scrollOffset(0, 500), 0);
	assert.equal(scrollOffset(HOLD, 500), 0);
	assert.equal(scrollOffset(HOLD + 200, 500), 200);
	assert.equal(scrollOffset(HOLD + 500, 500), 500);
	assert.equal(scrollOffset(HOLD + 9999, 500), 500);
});

test('a distance below zero does not move the box', () => {
	assert.equal(scrollOffset(HOLD + 100, -20), 0);
});
