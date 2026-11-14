import test from 'node:test';
import assert from 'node:assert/strict';
import { fitRows, scaleSteps } from '../../server/scripts/modules/utils/fit-rows.mjs';

const SCALES = scaleSteps(0.5, 0.01);

test('scaleSteps goes from 1 down to the smallest scale', () => {
	assert.equal(SCALES[0], 1);
	assert.equal(SCALES.at(-1), 0.5);
	assert.equal(SCALES.length, 51);
});

test('rows that fit stay at scale 1 on one page', () => {
	const { scale, pages } = fitRows(Array(6).fill(41), 280, SCALES);
	assert.equal(scale, 1);
	assert.deepEqual(pages, [[0, 1, 2, 3, 4, 5]]);
});

test('more rows: the biggest scale that still fits them all on one page', () => {
	const { scale, pages } = fitRows(Array(10).fill(41), 280, SCALES);
	assert.equal(pages.length, 1);
	assert.ok(scale < 1);
	assert.ok(10 * 41 * scale <= 280);
	// one step bigger would not fit
	assert.ok(10 * 41 * (scale + 0.01) > 280);
});

test('rows of different heights are summed', () => {
	// 6 rows of 42 and 2 of 62 = 376 at scale 1, to fit in 252
	const { scale, pages } = fitRows([42, 42, 62, 42, 42, 62, 42, 42], 252, SCALES);
	assert.equal(pages.length, 1);
	assert.ok(376 * scale <= 252 && 376 * (scale + 0.01) > 252);
});

test('only when the smallest scale is not enough there are more pages, as even as possible', () => {
	const { scale, pages } = fitRows(Array(30).fill(41), 280, SCALES);
	assert.equal(scale, 0.5);
	assert.equal(pages.length, 3);
	assert.deepEqual(pages.map((p) => p.length), [10, 10, 10]);
	assert.deepEqual(pages.flat(), [...Array(30).keys()]);
});

test('no row is left out or repeated, and no page is taller than the space', () => {
	const heights = Array.from({ length: 37 }, (_, i) => 40 + (i % 3) * 11);
	const { scale, pages } = fitRows(heights, 252, SCALES);
	assert.deepEqual(pages.flat(), heights.map((_, i) => i));
	pages.forEach((page) => assert.ok(page.reduce((s, i) => s + heights[i] * scale, 0) <= 252 + 0.5));
});

test('no rows: one empty page', () => {
	assert.deepEqual(fitRows([], 280, SCALES).pages, [[]]);
});
