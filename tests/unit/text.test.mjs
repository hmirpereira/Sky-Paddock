// plainText (fonts without accents) and escapeHtml (outside text in hand-built markup)
import test from 'node:test';
import assert from 'node:assert/strict';
import { plainText } from '../../server/scripts/modules/utils/text.mjs';
import { escapeHtml } from '../../server/scripts/modules/utils/html.mjs';

test('plainText removes accents, typographic quotes and long dashes', () => {
	assert.equal(plainText('Ação, coração e pão'), 'Acao, coracao e pao');
	assert.equal(plainText('“aspas” e ‘plicas’ – traço — longo «x»'), '"aspas" e \'plicas\' - traco - longo "x"');
});

test('plainText accepts null, undefined and numbers', () => {
	assert.equal(plainText(null), '');
	assert.equal(plainText(undefined), '');
	assert.equal(plainText(17), '17');
});

test('escapeHtml makes text safe inside markup', () => {
	assert.equal(escapeHtml('<b>x</b> & a < b'), '&lt;b&gt;x&lt;/b&gt; &amp; a &lt; b');
	assert.equal(escapeHtml('"a" \'b\''), '&quot;a&quot; &#39;b&#39;');
	assert.equal(escapeHtml(null), '');
	assert.equal(escapeHtml(5), '5');
});

test('escapeHtml leaves nothing that a browser would read as a tag', () => {
	assert.ok(!escapeHtml('<img src=x onerror=alert(1)>').includes('<'));
});
