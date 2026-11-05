import test from 'node:test';
import assert from 'node:assert/strict';
import { Settings } from '../../server/scripts/vendor/auto/luxon.mjs';
import { isFresh } from '../../server/scripts/modules/utils/f1-update.mjs';

// isFresh(copy) is true when the copy was saved after the latest update time (Friday to Monday, 22:00 Lisbon)
const at = (iso) => { Settings.now = () => Date.parse(iso); };
const fresh = (fetched) => isFresh({ fetched });

test.after(() => { Settings.now = () => Date.now(); });

test('F1 data: a new download is due at 22:00 Lisbon from Friday to Monday', () => {
	// Sunday 8 November 2026, winter time (Lisbon = UTC)
	at('2026-11-08T21:59:00Z');
	assert.equal(fresh('2026-11-07T22:05:00Z'), true, 'Saturday 22:05 copy is still fresh before Sunday 22:00');
	at('2026-11-08T22:01:00Z');
	assert.equal(fresh('2026-11-08T21:59:00Z'), false, 'Sunday 21:59 copy is old after 22:00');
	assert.equal(fresh('2026-11-08T22:00:30Z'), true);
	// Wednesday: the last update time is Monday 22:00
	at('2026-11-11T12:00:00Z');
	assert.equal(fresh('2026-11-09T22:05:00Z'), true);
	assert.equal(fresh('2026-11-09T21:00:00Z'), false);
	assert.equal(fresh(undefined), false);
});

test('F1 data: summer time, 22:00 Lisbon is 21:00 UTC', () => {
	at('2026-07-05T21:30:00Z');
	assert.equal(fresh('2026-07-05T20:59:00Z'), false);
	assert.equal(fresh('2026-07-05T21:00:30Z'), true);
});
