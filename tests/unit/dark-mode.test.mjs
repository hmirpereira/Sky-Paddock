// dark mode: Off, On and Automatic (10 minutes after the sunset until 10 minutes after the sunrise)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
	OFF, ON, AUTOMATIC, isDark,
} from '../../server/scripts/modules/utils/dark-mode.mjs';

const at = (time) => new Date(`2026-10-24T${time}:00`);
const times = { sunrise: at('07:55'), sunset: at('18:48') };

test('Off is never dark and On is always dark', () => {
	assert.equal(isDark(OFF, at('23:00'), times), false);
	assert.equal(isDark(ON, at('12:00'), times), true);
});

test('Automatic turns dark 10 minutes after the sunset and normal 10 minutes after the sunrise', () => {
	assert.equal(isDark(AUTOMATIC, at('12:00'), times), false);
	assert.equal(isDark(AUTOMATIC, at('18:57'), times), false);
	assert.equal(isDark(AUTOMATIC, at('18:58'), times), true);
	assert.equal(isDark(AUTOMATIC, at('23:59'), times), true);
	assert.equal(isDark(AUTOMATIC, at('00:30'), times), true);
	assert.equal(isDark(AUTOMATIC, at('08:04'), times), true);
	assert.equal(isDark(AUTOMATIC, at('08:05'), times), false);
});

test('Automatic without a sunrise or sunset (polar day or night, or no place yet) stays normal', () => {
	assert.equal(isDark(AUTOMATIC, at('23:00'), { sunrise: new Date(NaN), sunset: new Date(NaN) }), false);
	assert.equal(isDark(AUTOMATIC, at('23:00'), null), false);
	assert.equal(isDark('3', at('23:00'), times), true);
});
