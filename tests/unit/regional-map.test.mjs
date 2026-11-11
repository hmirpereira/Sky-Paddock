import test from 'node:test';
import assert from 'node:assert/strict';
import {
	MAP_H, MAP_W, PAGES, VIEWS, islandGroup, placeLabels, project, tilesFor, worldPx,
} from '../../server/scripts/modules/utils/regional-map.mjs';

test('the world pixel of the origin is the middle of the world at zoom 0', () => {
	assert.deepEqual(worldPx(0, 0, 0), [128, 128]);
});

test('a point is at the middle of the map when it is the view centre', () => {
	PAGES.forEach((id) => {
		const v = VIEWS[id];
		assert.deepEqual(project(v, v.lat, v.lon), [MAP_W / 2, MAP_H / 2], id);
	});
});

test('one degree of longitude at zoom 7 is 256 * 2^7 / 360 pixels', () => {
	const v = VIEWS.lisbon;
	const [x0] = project(v, v.lat, v.lon);
	const [x1] = project(v, v.lat, v.lon + 1);
	assert.ok(Math.abs(x1 - x0 - (256 * 2 ** 7) / 360) < 1e-6);
});

test('the tiles cover the whole map, and each tile is at the zoom of its view', () => {
	PAGES.forEach((id) => {
		const v = VIEWS[id];
		const tiles = tilesFor(v);
		assert.ok(tiles.length >= 4, id);
		assert.ok(tiles.every(([z]) => z === v.z), id);
	});
});

test('every island city goes to the group of its island, and the group has its view', () => {
	assert.equal(islandGroup({ lat: 32.65 }), 'madeira'); // Funchal
	assert.equal(islandGroup({ lat: 37.74 }), 'azores'); // Ponta Delgada
	assert.equal(islandGroup({ lat: 38.66 }), 'azores'); // Horta
	assert.deepEqual(PAGES, ['north', 'centre', 'lisbon', 'south', 'madeira', 'azores']);
	PAGES.forEach((id) => assert.ok(VIEWS[id], id));
});

test('a label sits beside its city, to the right and above the dot', () => {
	assert.deepEqual(placeLabels([{ x: 200, y: 150, w: 96 }]), [[206, 128]]);
});

test('two labels on the same city do not cover each other and stay inside the map', () => {
	const [a, b] = placeLabels([{ x: 300, y: 150, w: 96 }, { x: 302, y: 152, w: 96 }]);
	const overlap = (p, q) => p[0] < q[0] + 96 && q[0] < p[0] + 96 && p[1] < q[1] + 50 && q[1] < p[1] + 50;
	assert.equal(overlap(a, b), false);
	[a, b].forEach(([x, y]) => assert.ok(x >= 0 && x + 96 <= MAP_W && y >= 0 && y + 50 <= MAP_H));
});

test('a city at the right edge gets its label on the left of it, inside the map', () => {
	const [x, y] = placeLabels([{ x: 636, y: 150, w: 96 }])[0];
	assert.ok(x + 96 <= MAP_W);
	assert.ok(y >= 0 && y + 50 <= MAP_H);
});
