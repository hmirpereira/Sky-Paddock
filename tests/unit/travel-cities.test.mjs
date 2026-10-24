// Travel Forecast: the city list of page 2 and its choice
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
	TRAVEL_CITIES, DETAIL_CITIES, DEFAULT_DETAIL_CITY, detailCity, detailCityChoices, flagFile,
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

test('every country of the page 2 cities has its flag picture', () => {
	DETAIL_CITIES.forEach(([, name, country]) => {
		const file = `server/images/flags/${flagFile(country)}.png`;
		assert.ok(fs.existsSync(file), `${name}: no flag ${file}`);
	});
});

test('the choices are grouped by continent, and the continents and the cities are in alphabetical order', () => {
	const choices = detailCityChoices();
	const titles = choices.filter(([value]) => value === null).map(([, text]) => text);
	assert.deepEqual(titles, ['-- Europe --', '-- North America --']);
	// every city once, after the title of its continent
	assert.equal(choices.length, DETAIL_CITIES.length + titles.length);
	titles.forEach((title, i) => {
		const from = choices.findIndex(([, text]) => text === title) + 1;
		const to = i + 1 < titles.length ? choices.findIndex(([, text]) => text === titles[i + 1]) : choices.length;
		const names = choices.slice(from, to).map(([, text]) => text);
		assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)), title);
	});
	assert.ok(choices.some(([value, text]) => value === DEFAULT_DETAIL_CITY && text === 'Montreal - Canada'));
	assert.ok(DETAIL_CITIES.every((city) => ['Europe', 'North America'].includes(city[5])));
});
