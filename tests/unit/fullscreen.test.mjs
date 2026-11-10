// Full screen: which API spelling is used, and the pseudo full screen where the browser has none or refuses
import test from 'node:test';
import assert from 'node:assert/strict';
import {
	isFullscreen, isStandalone, isIosHomeScreen, enterFullscreen, exitFullscreen, findMethod, REQUESTS,
} from '../../server/scripts/modules/utils/fullscreen.mjs';

// a document with a body whose class list works like the browser's
const makeDoc = (extra = {}) => {
	const classes = new Set();
	return {
		body: {
			classList: {
				add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c),
			},
		},
		...extra,
	};
};

test('finds the standard spelling first, then the WebKit ones (small or capital S), Firefox and old Edge', () => {
	assert.equal(findMethod({ requestFullscreen() {}, webkitRequestFullScreen() {} }, REQUESTS), 'requestFullscreen');
	assert.equal(findMethod({ webkitRequestFullscreen() {} }, REQUESTS), 'webkitRequestFullscreen');
	assert.equal(findMethod({ webkitRequestFullScreen() {} }, REQUESTS), 'webkitRequestFullScreen');
	assert.equal(findMethod({ mozRequestFullScreen() {} }, REQUESTS), 'mozRequestFullScreen');
	assert.equal(findMethod({ msRequestFullscreen() {} }, REQUESTS), 'msRequestFullscreen');
	assert.equal(findMethod({}, REQUESTS), undefined);
});

test('a browser with the API goes full screen natively and nothing is faked', async () => {
	const doc = makeDoc();
	const calls = [];
	const element = { requestFullscreen: async (options) => calls.push(options) };
	assert.equal(await enterFullscreen(element, doc), 'native');
	assert.deepEqual(calls, [{ navigationUI: 'hide' }]);
	assert.equal(isFullscreen(doc), false); // the browser sets fullscreenElement itself
	assert.equal(isFullscreen({ ...doc, webkitFullscreenElement: {} }), true);
});

test('a browser without the API (Safari on the iPhone) gets the pseudo full screen, and leaves it', async () => {
	const doc = makeDoc();
	assert.equal(await enterFullscreen({}, doc), 'pseudo');
	assert.equal(isFullscreen(doc), true);
	await exitFullscreen(doc);
	assert.equal(isFullscreen(doc), false);
});

test('a browser that refuses the request also gets the pseudo full screen', async () => {
	const doc = makeDoc();
	const { warn } = console;
	console.warn = () => {};
	try {
		const element = { requestFullscreen: () => Promise.reject(new Error('not allowed')) };
		assert.equal(await enterFullscreen(element, doc), 'pseudo');
		assert.equal(isFullscreen(doc), true);
	} finally {
		console.warn = warn;
	}
});

test('opened from the Home Screen is told from a browser tab (iOS flag or display-mode)', () => {
	assert.equal(isStandalone({ navigator: { standalone: true } }), true);
	assert.equal(isStandalone({ navigator: {}, matchMedia: () => ({ matches: true }) }), true);
	assert.equal(isStandalone({ navigator: { standalone: false }, matchMedia: () => ({ matches: false }) }), false);
	assert.equal(isStandalone({ navigator: {} }), false);
});

test('from the iPhone Home Screen the native request is not made (it does nothing there): pseudo full screen', async () => {
	assert.equal(isIosHomeScreen({ navigator: { standalone: true } }), true);
	assert.equal(isIosHomeScreen({ navigator: {} }), false);
	const doc = makeDoc();
	const calls = [];
	const element = { requestFullscreen: async () => calls.push('native') };
	assert.equal(await enterFullscreen(element, doc, { native: false }), 'pseudo');
	assert.deepEqual(calls, []);
	assert.equal(isFullscreen(doc), true);
});

test('leaving calls the browser exit with the spelling it has', async () => {
	const doc = makeDoc({ webkitFullscreenElement: {}, webkitExitFullscreen: async () => { doc.exited = true; } });
	await exitFullscreen(doc);
	assert.equal(doc.exited, true);
});
