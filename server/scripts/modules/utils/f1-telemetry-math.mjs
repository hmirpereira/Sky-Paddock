// pure helpers of the F1 Telemetry screen (no page needed, so they can be tested in Node)
import { DateTime } from '../../vendor/auto/luxon.mjs';

const COLOURS = ['#38c8ff', '#ffd23f']; // without team colours: cyan and yellow

// hex colour <-> hue (degrees), saturation and lightness (0..1)
const toHsl = (hex) => {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	const d = max - min;
	if (!d) return [0, 0, l];
	const s = d / (1 - Math.abs(2 * l - 1));
	let h;
	if (max === r) h = ((g - b) / d) % 6;
	else if (max === g) h = (b - r) / d + 2;
	else h = (r - g) / d + 4;
	return [(h * 60 + 360) % 360, s, l];
};
const fromHsl = ([h, s, l]) => {
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6];
	return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
};
// the two drivers in their team colours, light enough to read on the dark red background (reds most of
// all); when both colours are close (same team, or Ferrari and Audi) the second driver gets a lighter tint
const driverColours = (drivers) => {
	const hsl = drivers.map((d, i) => (/^#[0-9a-f]{6}$/i.test(d.teamColour ?? '') ? toHsl(d.teamColour) : toHsl(COLOURS[i])));
	const lifted = hsl.map(([h, s, l]) => [h, s, Math.max(l, (h < 25 || h > 335) && s > 0.4 ? 0.62 : 0.55)]);
	const hueGap = Math.min(Math.abs(lifted[0][0] - lifted[1][0]), 360 - Math.abs(lifted[0][0] - lifted[1][0]));
	if (hueGap < 30 || (lifted[0][1] < 0.15 && lifted[1][1] < 0.15)) lifted[1] = [lifted[1][0], lifted[1][1], Math.min(0.85, lifted[1][2] + 0.22)];
	return lifted.map(fromHsl);
};

const lapTime = (s) => {
	if (!Number.isFinite(s)) return '';
	const m = Math.floor(s / 60);
	const rest = (s - m * 60).toFixed(3).padStart(6, '0');
	return m ? `${m}:${rest}` : rest;
};

// interpolate y at x in sorted arrays xs, ys
const interp = (xs, ys, x) => {
	if (x <= xs[0]) return ys[0];
	const last = xs.length - 1;
	if (x >= xs[last]) return ys[last];
	let lo = 0;
	let hi = last;
	while (hi - lo > 1) {
		const mid = Math.floor((lo + hi) / 2);
		if (xs[mid] <= x) lo = mid; else hi = mid;
	}
	const span = xs[hi] - xs[lo];
	return span ? ys[lo] + ((ys[hi] - ys[lo]) * (x - xs[lo])) / span : ys[lo];
};

// time (s from the start of the lap), speed and fraction of the lap for each car sample
const lapProfile = (car, start, duration) => {
	const t0 = DateTime.fromISO(start).toMillis();
	const samples = car
		.map((c) => ({ t: (DateTime.fromISO(c.date).toMillis() - t0) / 1000, v: Number(c.speed) }))
		.filter((c) => c.t >= 0 && c.t <= duration && Number.isFinite(c.v))
		.sort((a, b) => a.t - b.t);
	if (samples.length < 20) return null;
	// the lap starts and ends at the line: extend the first and last samples to it
	samples.unshift({ t: 0, v: samples[0].v });
	samples.push({ t: duration, v: samples.at(-1).v });
	const ts = samples.map((s) => s.t);
	const vs = samples.map((s) => s.v);
	const ds = [0];
	for (let i = 1; i < samples.length; i += 1) {
		ds.push(ds[i - 1] + (((vs[i - 1] + vs[i]) / 2) / 3.6) * (ts[i] - ts[i - 1]));
	}
	const total = ds.at(-1);
	return {
		ts, vs, fs: ds.map((d) => d / total), length: total,
	};
};

// the telemetry is only worth showing for a few days after an event: true when the last session of the event
// (the race, usually) ended more than `days` before `now` (both as times in ms)
const isStale = (eventEnd, now, days = 3) => !Number.isFinite(eventEnd) || now - eventEnd > days * 24 * 3600 * 1000;

export {
	isStale,
	COLOURS, driverColours, interp, lapProfile, lapTime,
};
