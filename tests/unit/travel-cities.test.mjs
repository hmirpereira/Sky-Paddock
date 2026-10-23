// Travel Forecast: the city list of page 2 and its choice
import test from 'node:test';
import assert from 'node:assert/strict';
import {
	TRAVEL_CITIES, DETAIL_CITIES, DEFAULT_DETAIL_CITY, detailCity,
} from '../../server/scripts/modules/utils/travel-cities.mjs';

test('the page 2 cities have unique numbers and names, valid positions and none is on page 1', () => {
	assert.equal(new Set(DETAIL_CITIES.map(([n]) => n)).size, DETAIL_CITIES.length);
	assert.equal(new Set(DETAIL_CITIES.map(([, name]) => name)).size, DETAIL_CITIES.length);
	const page1 = TRAVEL_CITIES.map((city) => city.Name);
	DETAIL_CITIES.forEach(([, name, , lat, lon]) => {
		assert.ok(Math.abs(lat) <= 90 && Math.abs(lon) <= 180, name);
		assert.ok(!page1.includes(name), `${name} is already on page 1`);
		assert.match(name, /^[A-Za-z ]+$/, 'the Star4000 fonts have no accents');
	});
});

test('Montreal is the default and an unknown number falls back to it', () => {
	assert.equal(detailCity(DEFAULT_DETAIL_CITY).name, 'Montreal');
	assert.equal(detailCity(1).name, 'London');
	assert.equal(detailCity(999).name, 'Montreal');
	assert.equal(detailCity(undefined).name, 'Montreal');
});
