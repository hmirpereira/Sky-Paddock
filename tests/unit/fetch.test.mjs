// fetch helper: a request that failed because of the network or the server is asked again, a 4xx answer is not
/* global globalThis */
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = { baseURI: 'https://example.test/' };
const { json } = await import('../../server/scripts/modules/utils/fetch.mjs');

const answer = (status, body = {}) => ({
	ok: status < 400, status, statusText: String(status), url: 'https://example.test/x', json: async () => body,
});

// runs the request with the waits between the attempts skipped, and says how many times fetch was called
const run = async (replies, url = 'https://example.test/x', params = undefined) => {
	let calls = 0;
	globalThis.fetch = async () => {
		const reply = replies[Math.min(calls, replies.length - 1)];
		calls += 1;
		if (reply instanceof Error) throw reply;
		return reply;
	};
	mock.timers.enable({ apis: ['setTimeout'] });
	const settled = json(url, params).then((value) => ({ value }), (error) => ({ error }));
	for (let i = 0; i < 10; i += 1) {
		// eslint-disable-next-line no-await-in-loop
		await new Promise((resolve) => { setImmediate(resolve); });
		mock.timers.tick(5000);
	}
	const result = await settled;
	mock.timers.reset();
	return { ...result, calls };
};

test('a server error is asked again until it answers', async () => {
	const { value, calls } = await run([answer(503), answer(502), answer(200, { ok: 1 })]);
	assert.deepEqual(value, { ok: 1 });
	assert.equal(calls, 3);
});

test('a network error is asked again', async () => {
	const { value, calls } = await run([new TypeError('Failed to fetch'), answer(200, { ok: 2 })]);
	assert.deepEqual(value, { ok: 2 });
	assert.equal(calls, 2);
});

test('three retries, then the error of the last answer', async () => {
	const { error, calls } = await run([answer(500)]);
	assert.match(error.message, /Fetch error 500/);
	assert.equal(calls, 4);
});

test('a 4xx answer is not asked again', async () => {
	const { error, calls } = await run([answer(404)]);
	assert.match(error.message, /Fetch error 404/);
	assert.equal(calls, 1);
});

test('a timeout is not asked again', async () => {
	const timeout = new DOMException('timed out', 'TimeoutError');
	const { error, calls } = await run([timeout]);
	assert.equal(error.name, 'TimeoutError');
	assert.equal(calls, 1);
});

test('a request with a signal of its own, or to the Pi service, is not asked again', async () => {
	const own = await run([answer(503)], 'https://example.test/x', { signal: new AbortController().signal });
	assert.equal(own.calls, 1);
	const local = await run([answer(503)], 'http://127.0.0.1:8095/news.json');
	assert.equal(local.calls, 1);
});
