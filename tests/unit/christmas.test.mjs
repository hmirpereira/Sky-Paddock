// Christmas effects: the dates of the automatic mode
import test from 'node:test';
import assert from 'node:assert/strict';
import isChristmas from '../../server/scripts/modules/utils/christmas.mjs';
import { OFF, ON, AUTOMATIC } from '../../server/scripts/modules/utils/dark-mode.mjs';

const day = (month, date) => new Date(2026, month - 1, date);

test('the automatic mode runs from 1 to 25 December', () => {
	assert.equal(isChristmas(AUTOMATIC, day(11, 30)), false);
	assert.equal(isChristmas(AUTOMATIC, day(12, 1)), true);
	assert.equal(isChristmas(AUTOMATIC, day(12, 25)), true);
	assert.equal(isChristmas(AUTOMATIC, day(12, 26)), false);
	assert.equal(isChristmas(ON, day(6, 15)), true);
	assert.equal(isChristmas(OFF, day(12, 10)), false);
});
