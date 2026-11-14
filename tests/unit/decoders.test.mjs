// METAR decoder: what the Airport screen shows comes from here
import test from 'node:test';
import assert from 'node:assert/strict';
import decodeMetar from '../../server/scripts/modules/utils/metar-decoder.mjs';

test('METAR: wind, visibility, clouds, temperature, humidity and pressure', () => {
	const m = decodeMetar('LPPR 221930Z 03014KT 9999 FEW020 BKN080 20/09 Q1013 NOSIG', new Date('2026-10-22T19:40:00Z'));
	assert.equal(m.station, 'LPPR');
	assert.equal(m.observed.toISOString(), '2026-10-22T19:30:00.000Z');
	assert.equal(m.ageMinutes, 10);
	assert.equal(m.wind, 'NNE (030°) at 14 kt');
	assert.equal(m.visibility, '10 km or more');
	assert.deepEqual(m.clouds, ['Few clouds at 2,000 ft', 'Broken clouds at 8,000 ft']);
	assert.equal(m.temperature, 20);
	assert.equal(m.dewPoint, 9);
	assert.equal(m.humidity, 49);
	assert.equal(m.pressure, '1013 hPa');
	assert.equal(m.trend, 'No significant change expected');
});

test('METAR: variable wind, CAVOK and temperatures below zero', () => {
	const m = decodeMetar('LPPT 221900Z VRB02KT CAVOK M02/M05 Q0998', new Date('2026-10-22T19:10:00Z'));
	assert.equal(m.wind, 'Variable at 2 kt');
	assert.deepEqual(m.clouds, ['No significant cloud']);
	assert.equal(m.temperature, -2);
	assert.equal(m.dewPoint, -5);
	assert.equal(m.pressure, '998 hPa');
});

test('METAR: malformed text does not throw', () => {
	['', 'garbage', 'LPPR'].forEach((raw) => {
		assert.doesNotThrow(() => decodeMetar(raw, new Date()));
	});
});
