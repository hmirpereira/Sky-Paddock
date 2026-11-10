// IPMA warnings in the bottom line: the text of each line and what the store keeps
import test from 'node:test';
import assert from 'node:assert/strict';
import {
	hazardLine, setHazardWarnings, hazardLines, formatIpmaTime, MAX_LINES,
} from '../../server/scripts/modules/utils/hazard-lines.mjs';

const NOW = '2026-11-10T08:00:00';
const warning = (level, type, startTime, endTime) => ({
	awarenessLevelID: level, awarenessTypeName: type, startTime, endTime,
});

test('a warning that has started reads "until"', () => {
	const line = hazardLine(warning('orange', 'Precipitação', '2026-11-10T06:00:00', '2026-11-10T18:00:00'), NOW);
	assert.deepEqual(line, {
		alert: true, level: 'orange', label: 'AVISO LARANJA', text: 'Precipitacao, ate TER 10 NOV 18:00',
	});
});

test('a warning that has not started reads "from ... until", without accents', () => {
	const line = hazardLine(warning('yellow', 'Agitação Marítima', '2026-11-11T00:00:00', '2026-11-11T12:00:00'), NOW);
	assert.equal(line.label, 'AVISO AMARELO');
	assert.equal(line.text, 'Agitacao Maritima, de QUA 11 NOV 00:00 ate QUA 11 NOV 12:00');
});

test('Saturday has no accent on the bottom line either', () => {
	// 2026-11-14 is a Saturday: the day name has an accent in the table, the line does not
	assert.equal(formatIpmaTime('2026-11-14T10:00:00'), 'SÁB 14 NOV 10:00');
	const line = hazardLine(warning('red', 'Vento', '2026-11-14T08:00:00', '2026-11-14T10:00:00'), '2026-11-14T09:00:00');
	assert.equal(line.text, 'Vento, ate SAB 14 NOV 10:00');
	assert.equal(line.label, 'AVISO VERMELHO');
});

test('the store keeps the most severe warnings, in the order given, and clears on an empty list', () => {
	const many = ['red', 'orange', 'yellow', 'yellow', 'yellow'].map((level) => warning(level, 'Vento', '2026-11-10T06:00:00', '2026-11-10T18:00:00'));
	setHazardWarnings(many, NOW);
	assert.equal(hazardLines().length, MAX_LINES);
	assert.deepEqual(hazardLines().map((l) => l.level), ['red', 'orange', 'yellow']);
	setHazardWarnings([], NOW);
	assert.deepEqual(hazardLines(), []);
	setHazardWarnings(undefined, NOW);
	assert.deepEqual(hazardLines(), []);
});
