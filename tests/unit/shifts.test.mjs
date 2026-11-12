import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from '../../server/scripts/vendor/auto/luxon.mjs';
import {
	keepDays, stillShown, shiftTimes, gatesDay, flightsToCome, gatesLabel,
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
	assert.deepEqual([pick({ gates }, '12:15').day.date, pick({ gates }, '12:15').later, pick({ gates }, '12:15').message], ['2026-11-09', true, '']);
	assert.equal(pick({}, '12:15').message, 'No gates assigned');
	assert.equal(pick({ off: true }, '12:15').message, 'Day off');
	// a day with no gates looks at tomorrow from the start
	assert.equal(gatesDay([{ date: '2026-11-08' }, { date: '2026-11-09', gates }], at('2026-11-08T08:00')).day.date, '2026-11-09');
	// the next day with gates, however far ahead: tomorrow and the day after have none, so the Gates page goes to the one after
	const later = gatesDay([{ date: '2026-11-08', gates }, { date: '2026-11-09', off: true }, { date: '2026-11-10' }, { date: '2026-11-11', gates }], at('2026-11-08T12:15'));
	assert.deepEqual([later.day.date, later.later, later.message], ['2026-11-11', true, '']);
	// every gate of the day (Personal Gates off): a day of mine with no gates, or off, still has the gates of the others
	const others = [{ dests: ['FRA'], with: ['RUI T'], flights: [{ number: 'LH1175', time: '12:35' }] }];
	const all = gatesDay([{ date: '2026-11-08', off: true, allGates: others }], at('2026-11-08T08:00'), true);
	assert.deepEqual([all.day.gates, all.later, all.message], [others, false, '']);
	assert.equal(gatesDay([{ date: '2026-11-08', off: true }, { date: '2026-11-09', off: true }], at('2026-11-08T08:00'), true).message, 'No gates assigned');
});

test('a flight leaves the Gates list once its departure has passed', () => {
	const flights = [{ number: 'A', time: '06:40' }, { number: 'B', time: '11:50', etd: '12:10' }, { number: 'C' }, { number: 'D', time: '16:00' }];
	const numbers = (time) => flightsToCome(flights, '2026-11-08', at(`2026-11-08T${time}`)).map((f) => f.number).join('');
	assert.equal(numbers('06:00'), 'ABCD');
	// the etd counts, not the time of the roster; a flight with no time stays
	assert.equal(numbers('12:05'), 'BCD');
	assert.equal(numbers('12:15'), 'CD');
	assert.equal(numbers('17:00'), 'C');
});

test('the title of the Gates page: Today, Tomorrow, then the date from two days on', () => {
	const now = at('2026-11-12T09:00');
	assert.deepEqual(['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-20'].map((date) => gatesLabel(date, now)), ['Today', 'Tomorrow', 'Sat 14/11', 'Fri 20/11']);
});
