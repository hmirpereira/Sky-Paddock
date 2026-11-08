import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
	CONNECT_HOSTS, HUB, IMAGE_ONLY_HOSTS, buildPolicy, directives,
} from '../../csp.mjs';

const SCRIPTS = 'server/scripts';
// XML namespaces written as addresses (SVG): they are names, nothing is fetched from there
const NAMESPACES = ['http://www.w3.org'];

const sourceFiles = (dir) => readdirSync(dir).flatMap((name) => {
	const path = join(dir, name);
	if (statSync(path).isDirectory()) return name === 'vendor' ? [] : sourceFiles(path);
	return name.endsWith('.mjs') ? [path] : [];
});

// the hosts of the addresses written in the code (comments are not code: only a comment may mention a wiki)
const hostsInCode = () => {
	const hosts = new Set();
	sourceFiles(SCRIPTS).forEach((file) => {
		readFileSync(file, 'utf8').split('\n').forEach((line) => {
			const trimmed = line.trim();
			if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
			const code = line.replace(/\s\/\/.*$/, '');
			[...code.matchAll(/https?:\/\/[A-Za-z0-9.-]+(:\d+)?/g)].forEach((m) => hosts.add(m[0]));
		});
	});
	return hosts;
};

test('scripts come only from the site itself, with no eval and no wildcard', () => {
	assert.deepEqual(directives['script-src'], ["'self'"]);
	assert.deepEqual(directives['default-src'], ["'none'"]);
	const policy = buildPolicy();
	assert.ok(!policy.includes('unsafe-eval'));
	assert.ok(!/\s\*(\s|;|$)/.test(policy), 'a bare * allows everything');
	assert.deepEqual(directives['object-src'], ["'none'"]);
});

test('every host the scripts talk to is in the policy', () => {
	const known = new Set([HUB, ...CONNECT_HOSTS, ...IMAGE_ONLY_HOSTS, ...NAMESPACES]);
	const unknown = [...hostsInCode()].filter((host) => !known.has(host));
	assert.deepEqual(unknown, [], `add these hosts to csp.mjs (CONNECT_HOSTS for fetch, IMAGE_ONLY_HOSTS for pictures): ${unknown.join(', ')}`);
});

test('the hosts fetched from are allowed by connect-src', () => {
	const connect = directives['connect-src'];
	[HUB, ...CONNECT_HOSTS].forEach((host) => assert.ok(connect.includes(host), host));
});

test('the page has no inline script (the policy would refuse it)', () => {
	const page = readFileSync('views/index.ejs', 'utf8');
	const inline = [...page.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)];
	assert.equal(inline.length, 0, 'an inline <script> in views/index.ejs');
});
