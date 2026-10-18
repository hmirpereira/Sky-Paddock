// smoke test of the built site (npm test): see tests/smoke.spec.mjs
import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests',
	timeout: 4 * 60 * 1000,
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: 'http://127.0.0.1:8080/',
		browserName: 'chromium',
		viewport: { width: 1280, height: 720 },
		timezoneId: 'Europe/Lisbon',
		locale: 'en-GB',
		trace: 'retain-on-failure',
	},
	projects: [
		// replays the recorded answers of the weather, F1 and other sites (tests/recorded/)
		{ name: 'smoke' },
		// npm run test:record: asks the real sites again and records their answers
		{ name: 'record', use: { record: true } },
	],
	// the built site in docs/ (npm run build first)
	webServer: {
		command: 'npx vite preview --host 127.0.0.1 --port 8080 --strictPort',
		url: 'http://127.0.0.1:8080/',
		reuseExistingServer: !process.env.CI,
	},
});
