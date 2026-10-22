// METAR and TAF decoders: what the Airport screen shows comes from here
import test from 'node:test';
import assert from 'node:assert/strict';
import decodeMetar from '../../server/scripts/modules/utils/metar-decoder.mjs';
import decodeTaf from '../../server/scripts/modules/utils/taf-decoder.mjs';

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

test('METAR and TAF: malformed text does not throw', () => {
	['', 'garbage', 'LPPR'].forEach((raw) => {
		assert.doesNotThrow(() => decodeMetar(raw, new Date()));
		assert.doesNotThrow(() => decodeTaf(raw, null, new Date()));
	});
	assert.equal(decodeTaf('garbage', null, new Date()).groups.length, 0);
});

const TAF = 'TAF LPPR 312300Z 0100/0206 07010KT 9999 FEW020 BECMG 0106/0108 31012KT TEMPO 0114/0118 4000 BR BKN008';

test('TAF issued on the last day of the month is valid from the 1st of the next', () => {
	const t = decodeTaf(TAF, '2026-10-31T23:00:00Z', new Date('2026-10-31T23:10:00Z'));
	assert.equal(t.from.toISOString(), '2026-11-01T00:00:00.000Z');
	assert.equal(t.to.toISOString(), '2026-11-02T06:00:00.000Z');
	assert.deepEqual(t.groups.map((g) => g.type), ['BASE', 'BECMG', 'TEMPO']);
	assert.equal(t.groups[1].from.toISOString(), '2026-11-01T06:00:00.000Z');
	assert.deepEqual(t.groups[0].conditions, ['ENE (070°) at 10 kt', 'Visibility 10 km or more', 'Few clouds at 2,000 ft']);
});

test('TAF: temporary groups that are already over are dropped', () => {
	const t = decodeTaf(TAF, '2026-10-31T23:00:00Z', new Date('2026-11-01T20:00:00Z'));
	assert.deepEqual(t.groups.map((g) => g.type), ['BASE', 'BECMG']);
});

test('TAF: FM closes the base forecast and lasts until the end', () => {
	const t = decodeTaf('TAF LPPR 221700Z 2218/2318 03010KT 9999 FEW020 FM230600 36015KT 8000 -RA', '2026-10-22T17:00:00Z', new Date('2026-10-22T17:30:00Z'));
	assert.equal(t.groups[0].to.toISOString(), '2026-10-23T06:00:00.000Z');
	assert.equal(t.groups[1].type, 'FM');
	assert.equal(t.groups[1].to.toISOString(), '2026-10-23T18:00:00.000Z');
	assert.ok(t.groups[1].conditions.includes('Light rain'));
});

test('TAF: PROB30 TEMPO is one group', () => {
	const t = decodeTaf('TAF LPPR 221700Z 2218/2318 03010KT 9999 PROB30 TEMPO 2300/2303 3000 TSRA', '2026-10-22T17:00:00Z', new Date('2026-10-22T17:30:00Z'));
	assert.deepEqual(t.groups.map((g) => [g.type, g.probability, g.tempo]), [['BASE', null, false], ['PROB', 30, true]]);
});
