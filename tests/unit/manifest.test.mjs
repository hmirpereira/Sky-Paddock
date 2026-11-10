// The built page links the manifest as assets/manifest-<hash>.json (Vite), so its paths are read from assets/:
// start_url and the icons must climb back to the site, or the Home Screen icon opens a 404
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const site = new URL('https://example.test/Sky-Paddock/');
const asBuilt = new URL('assets/manifest-hash.json', site);
const manifest = JSON.parse(readFileSync(new URL('../../server/manifest.json', import.meta.url), 'utf8'));

test('the manifest start_url, read from assets/, is the site root', () => {
	assert.equal(new URL(manifest.start_url, asBuilt).href, site.href);
});

test('the manifest icons, read from assets/, are files of the site', () => {
	manifest.icons.forEach((icon) => {
		const path = new URL(icon.src, asBuilt).pathname.replace('/Sky-Paddock/', '');
		assert.ok(existsSync(new URL(`../../server/${path}`, import.meta.url)), `${icon.src} -> ${path}`);
	});
});
