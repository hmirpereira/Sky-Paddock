/* eslint-disable import/no-extraneous-dependencies */
import {
	src, dest, series, parallel,
} from 'gulp';
import concat from 'gulp-concat';
import ejs from 'gulp-ejs';
import rename from 'gulp-rename';
import htmlmin from 'gulp-htmlmin';
import { deleteAsync } from 'del';
import webpack from 'webpack-stream';
import TerserPlugin from 'terser-webpack-plugin';
import { readFile } from 'fs/promises';

const clean = () => deleteAsync(['./docs']);

const BUILD_PATH = './docs/resources';

const webpackOptions = {
	mode: 'production',
	output: { filename: 'ws.min.js' },
	optimization: {
		minimize: true,
		minimizer: [new TerserPlugin({ extractComments: false })],
	},
};

const buildJs = () => src(['server/scripts/index.mjs'])
	.pipe(webpack(webpackOptions))
	.pipe(dest(BUILD_PATH));

const copyCss = () => src(['server/styles/main.css'])
	.pipe(concat('ws.min.css'))
	.pipe(dest(BUILD_PATH));

const copyAssets = () => src(['server/fonts/**/*', 'server/images/**/*'], { base: 'server' })
	.pipe(dest('./docs'));

const compressHtml = async () => {
	const packageJson = await readFile('package.json');
	const { version } = JSON.parse(packageJson);

	return src('views/*.ejs')
		.pipe(ejs({
			production: true,
			version,
		}, {}, { ext: '.html' })) // Prevents EJS from escaping values
		.pipe(rename({ extname: '.html' }))
		.pipe(htmlmin({ collapseWhitespace: true }))
		.pipe(dest('./docs'));
};

const copyOtherFiles = () => src(['server/robots.txt', 'server/manifest.json'], { base: 'server/' })
	.pipe(dest('./docs'));

const build = series(clean, parallel(buildJs, copyCss, compressHtml, copyOtherFiles, copyAssets));

export default build;
