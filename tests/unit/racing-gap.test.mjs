// Racing gap: the F1 and GT screens are skipped only when no event starts in 21 days and the last one ended over 72 h ago
import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from '../../server/scripts/vendor/auto/luxon.mjs';
import isRacingGap from '../../server/scripts/modules/utils/racing-gap.mjs';

const now = DateTime.fromISO('2026-07-10T12:00:00', { zone: 'Europe/Lisbon' });
const event = (startDays, endDays) => ({ start: now.plus({ days: startDays }), end: now.plus({ days: endDays }) });

test('a gap: the last event ended 4 days ago and the next one is 30 days away', () => {
	assert.equal(isRacingGap([event(-5, -4), event(30, 31)], now), true);
});

test('no gap while an event starts within 21 days', () => {
	assert.equal(isRacingGap([event(-5, -4), event(10, 11)], now), false);
});

test('no gap when the last event ended less than 72 hours ago', () => {
	assert.equal(isRacingGap([event(-3, -2), event(30, 31)], now), false);
});

test('no gap while an event is on', () => {
	assert.equal(isRacingGap([event(-1, 1), event(30, 31)], now), false);
});

test('no gap without events, or when they are not known', () => {
	assert.equal(isRacingGap([], now), false);
	assert.equal(isRacingGap(null, now), false);
});
