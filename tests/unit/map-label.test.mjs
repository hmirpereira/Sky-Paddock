import test from 'node:test';
import assert from 'node:assert/strict';
import placeLabel from '../../server/scripts/modules/utils/map-label.mjs';

const W = 392;
const H = 278;
const inside = ([x, y]) => x - 12.8 >= 0 && x + 12.8 <= W && y - 16 >= 0 && y <= H;

test('a label beside the track goes on the side away from the middle', () => {
	// a point right of the middle, the track going up: the normal points right
	const [x] = placeLabel(250, 140, 1, 0, W, H);
	assert.ok(x > 250);
});

test('a label that would leave the box goes to the other side, or is pushed inside', () => {
	// near the right edge, away from the middle is outside: the other side
	assert.ok(placeLabel(380, 140, 1, 0, W, H)[0] < 380);
	// near a corner on both sides: still inside
	[[5, 5, 1, 0], [387, 5, 0, 1], [5, 273, 0, 1], [387, 273, 1, 0], [200, 2, 0, 1], [200, 276, 0, 1]].forEach(([px, py, sx, sy]) => {
		assert.ok(inside(placeLabel(px, py, sx, sy, W, H)), `${px},${py}`);
	});
});
