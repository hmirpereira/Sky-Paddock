// F1 Telemetry: lap time text, interpolation, the share of the lap along the speed trace, and driver colours
import test from 'node:test';
import assert from 'node:assert/strict';
import {
	driverColours, interp, isStale, lapProfile, lapTime,
} from '../../server/scripts/modules/utils/f1-telemetry-math.mjs';

test('lapTime', () => {
	assert.equal(lapTime(91.373), '1:31.373');
	assert.equal(lapTime(59.5), '59.500');
	assert.equal(lapTime(120), '2:00.000');
	assert.equal(lapTime(Number.NaN), '');
	assert.equal(lapTime(undefined), '');
});

test('interp: inside, on a knot and outside the range', () => {
	const xs = [0, 1, 2];
	const ys = [0, 10, 30];
	assert.equal(interp(xs, ys, 0.5), 5);
	assert.equal(interp(xs, ys, 1.5), 20);
	assert.equal(interp(xs, ys, 1), 10);
	assert.equal(interp(xs, ys, -1), 0);
	assert.equal(interp(xs, ys, 5), 30);
});

const samples = (count, duration, speed) => Array.from({ length: count }, (_, i) => ({
	date: new Date(Date.UTC(2026, 9, 10, 14, 19, 2) + (i * duration * 1000) / count).toISOString(),
	speed,
}));

test('lapProfile: constant speed gives the distance and a share of the lap from 0 to 1', () => {
	const p = lapProfile(samples(40, 90, 200), '2026-10-10T14:19:02Z', 90);
	assert.equal(p.fs[0], 0);
	assert.equal(p.fs.at(-1), 1);
	assert.ok(p.fs.every((f, i) => i === 0 || f >= p.fs[i - 1]), 'the share never goes back');
	assert.equal(Math.round(p.length), 5000);
});

test('lapProfile: too few samples give nothing', () => {
	assert.equal(lapProfile(samples(10, 90, 200), '2026-10-10T14:19:02Z', 90), null);
});

const lightness = (hex) => {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
	return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
};

test('driverColours: team colours, kept when they differ', () => {
	assert.deepEqual(driverColours([{ teamColour: '#4781D7' }, { teamColour: '#ED1131' }]), ['#4781d7', '#f24a63']);
});

test('driverColours: same team gives the second driver a lighter tint', () => {
	const [a, b] = driverColours([{ teamColour: '#4781D7' }, { teamColour: '#4781D7' }]);
	assert.equal(a, '#4781d7');
	assert.ok(lightness(b) > lightness(a));
});

test('driverColours: without team colours, two different colours', () => {
	const [a, b] = driverColours([{}, {}]);
	assert.match(a, /^#[0-9a-f]{6}$/);
	assert.match(b, /^#[0-9a-f]{6}$/);
	assert.notEqual(a, b);
});

test('isStale: three days after the end of the weekend', () => {
	const end = Date.UTC(2026, 9, 25, 16, 0);
	const hours = (h) => end + h * 3600 * 1000;
	assert.equal(isStale(end, hours(1)), false);
	assert.equal(isStale(end, hours(72)), false);
	assert.equal(isStale(end, hours(72) + 1), true);
	assert.equal(isStale(Number.NaN, hours(1)), true);
	assert.equal(isStale(end, hours(24), 1), false);
});
