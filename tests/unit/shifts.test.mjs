import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from '../../server/scripts/vendor/auto/luxon.mjs';
import {
	keepDays, stillShown, shiftTimes, gatesDay,
} from '../../server/scripts/modules/utils/shifts.mjs';

const at = (iso) => DateTime.fromISO(iso, { zone: 'Europe/Lisbon' });
const night = {
	date: '2026-11-07', code: 'N', start: '22:00', end: '06:00',
};
const day = {
	date: '2026-11-08', code: 'D', start: '14:00', end: '22:00',
};

test('a shift that ends after midnight ends on the next day', () => {
	const { start, end } = shiftTimes(night);
	assert.equal(end.toISODate(), '2026-11-08');
	assert.ok(end > start);
});

test('a day off or a day without times has no shift', () => {
	assert.equal(shiftTimes({ date: '2026-11-08', off: true }), null);
	assert.equal(shiftTimes({ date: '2026-11-08', start: null, end: null }), null);
});

test('yesterday is kept, the day before is not', () => {
	const kept = keepDays([{ date: '2026-11-06' }, night, day], at('2026-11-08T03:00'));
	assert.deepEqual(kept.map((d) => d.date), ['2026-11-07', '2026-11-08']);
});

test("yesterday's night shift is shown at 03:00 while it lasts, and gone after 06:00", () => {
	assert.equal(stillShown(night, at('2026-11-08T03:00')), true);
	assert.equal(stillShown(night, at('2026-11-08T06:30')), false);
});

test("yesterday's day off or finished day is never shown", () => {
	assert.equal(stillShown({ date: '2026-11-07', off: true }, at('2026-11-08T03:00')), false);
	assert.equal(stillShown({
		date: '2026-11-07', code: 'M', start: '07:00', end: '15:00',
	}, at('2026-11-08T03:00')), false);
});

test("today's shift leaves the list once it has ended, a day off stays", () => {
	assert.equal(stillShown(day, at('2026-11-08T21:59')), true);
	assert.equal(stillShown(day, at('2026-11-08T22:00')), false);
	assert.equal(stillShown({ date: '2026-11-08', off: true }, at('2026-11-08T23:00')), true);
});

test('later days are always shown', () => {
	assert.equal(stillShown({
		date: '2026-11-09', code: 'M', start: '07:00', end: '15:00',
	}, at('2026-11-08T03:00')), true);
});

test('the Gates page shows today until its last flight has left, then tomorrow or a message', () => {
	const gates = [{ dests: ['MUC'], with: ['ANA M'], flights: [{ number: 'LH1785', time: '06:40' }, { number: 'LH1783', etd: '12:10', time: '11:50' }] }];
	const today = { date: '2026-11-08', gates };
	const pick = (tomorrow, time) => gatesDay([today, { date: '2026-11-09', ...tomorrow }], at(`2026-11-08T${time}`));
	assert.equal(pick({ gates }, '12:05').day, today);
	assert.deepEqual([pick({ gates }, '12:15').day.date, pick({ gates }, '12:15').tomorrow, pick({ gates }, '12:15').message], ['2026-11-09', true, '']);
	assert.equal(pick({}, '12:15').message, 'No gates assigned');
	assert.equal(pick({ off: true }, '12:15').message, 'Day off');
	// a day with no gates looks at tomorrow from the start
	assert.equal(gatesDay([{ date: '2026-11-08' }, { date: '2026-11-09', gates }], at('2026-11-08T08:00')).day.date, '2026-11-09');
	// every gate of the day (Personal Gates off): a day of mine with no gates, or off, still has the gates of the others
	const others = [{ dests: ['FRA'], with: ['RUI T'], flights: [{ number: 'LH1175', time: '12:35' }] }];
	const all = gatesDay([{ date: '2026-11-08', off: true, allGates: others }], at('2026-11-08T08:00'), true);
	assert.deepEqual([all.day.gates, all.tomorrow, all.message], [others, false, '']);
	assert.equal(gatesDay([{ date: '2026-11-08', off: true }, { date: '2026-11-09', off: true }], at('2026-11-08T08:00'), true).message, 'No gates assigned');
});
