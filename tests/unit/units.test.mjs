// unit conversions used by every weather screen
import test from 'node:test';
import assert from 'node:assert/strict';
import * as units from '../../server/scripts/modules/utils/units.mjs';

test('speed', () => {
	assert.equal(units.kphToKnots(100), 54);
	assert.equal(units.kphToMs(36), 10);
	assert.equal(units.kphToMph(100), 62);
});

test('Beaufort scale at its limits', () => {
	assert.equal(units.kphToBft(0), 0);
	assert.equal(units.kphToBft(1), 1);
	assert.equal(units.kphToBft(5.9), 1);
	assert.equal(units.kphToBft(6), 2);
	assert.equal(units.kphToBft(200), 12);
});

test('temperature, both ways', () => {
	assert.equal(units.celsiusToFahrenheit(20), 68);
	assert.equal(units.celsiusToFahrenheit(-40), -40);
	assert.equal(units.fahrenheitToCelsius(68), 20);
	assert.equal(units.celsiusToKelvin(0), 273);
});

test('distance', () => {
	assert.equal(units.kilometersToMiles(100), 62);
	assert.equal(units.kilometersToMeters(1.5), 1500);
	assert.equal(units.metersToFeet(1000), 3281);
});
