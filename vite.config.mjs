// Sky Paddock: Vite builds the site into docs/ (published by .github/workflows/pages.yml)
// and serves it while developing (npm run dev).
// The page itself is views/index.ejs (with its partials), rendered here with EJS.
import { cpSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import ejs from 'ejs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const server = resolve('server');
const out = resolve('docs');

// server/index.html only includes views/index.ejs: render it before Vite reads the scripts and styles
const renderEjs = () => ({
	name: 'sky-paddock-ejs',
	transformIndexHtml: {
		order: 'pre',
		handler: (html) => ejs.render(html, { version }, { filename: resolve(server, 'index.html') }),
	},
});

// the screens load images by name at run time (flags, logos, icons), so they are copied as they are
// (fonts are only used by the styles, so Vite already puts them in assets/)
const copyStatic = () => ({
	name: 'sky-paddock-static',
	apply: 'build',
	closeBundle() {
		['images', 'robots.txt', 'manifest.json'].forEach((item) => {
			cpSync(resolve(server, item), resolve(out, item), { recursive: true });
		});
	},
});

export default defineConfig({
	root: server,
	// relative links, because the site lives in /Sky-Paddock/ on GitHub Pages
	base: './',
	// images and fonts are served from server/ while developing; copyStatic copies the images when building
	publicDir: false,
	plugins: [renderEjs(), copyStatic()],
	build: {
		outDir: out,
		emptyOutDir: true,
		// the Raspberry Pi runs a recent Chromium
		target: 'es2022',
	},
	// the styles still use Sass @import (one file per screen); fine until Dart Sass 3, so the warning is silenced
	css: { preprocessorOptions: { scss: { silenceDeprecations: ['import', 'global-builtin'] } } },
	server: { port: 8080 },
	preview: { port: 8080 },
});
