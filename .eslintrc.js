module.exports = {
	// the page runs in the browser; the build, test and tool files below run in Node
	env: {
		browser: true,
		es6: true,
	},
	extends: [
		'airbnb-base',
	],
	globals: {
		Atomics: 'readonly',
		SharedArrayBuffer: 'readonly',
		NoSleep: 'readonly',
		SunCalc: 'readonly',
	},
	parserOptions: {
		ecmaVersion: 2023,
	},
	plugins: [
	],
	rules: {
		indent: [
			'error',
			'tab',
			{ 
				SwitchCase: 1
			},
		],
		'no-tabs': 0,
		'no-console': 0,
		'max-len': 0,
		'no-use-before-define': [
			'error',
			{
				variables: false,
			},
		],
		'no-param-reassign': [
			'error',
			{
				props: false,
			},
		],
		'no-mixed-operators': [
			'error',
			{
				groups: [
					['&', '|', '^', '~', '<<', '>>', '>>>'],
					['==', '!=', '===', '!==', '>', '>=', '<', '<='],
					['&&', '||'],
					['in', 'instanceof'],
				],
				allowSamePrecedence: true,
			},
		],
		'import/extensions': [
			'error',
			{
				mjs: 'always',
				json: 'always',
			},
		],
	},
	overrides: [
		{
			files: ['.eslintrc.js', 'vite.config.mjs', 'playwright.config.mjs', 'tests/**/*.mjs', '.claude/**/*.mjs'],
			env: { node: true, browser: false },
			rules: {
				'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
				// the plugin does not read the exports of vite's package.json
				'import/no-unresolved': ['error', { ignore: ['^vite$'] }],
			},
		},
		{
			// the callbacks of page.evaluate run in the browser
			files: ['tests/**/*.mjs'],
			env: { node: true, browser: true },
			// the steps of the page walk are sequential by nature (click, wait, look)
			rules: { 'no-await-in-loop': 'off' },
		},
	],
	ignorePatterns: [
		'*.min.js',
	],
};
