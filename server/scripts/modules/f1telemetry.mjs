// fastest laps of the two quickest drivers in the latest practice or qualifying session,
// from OpenF1 (https://openf1.org, car telemetry and positions at about 4 per second).
// Page 1: lap and sector times, the 25 mini-sectors as a strip, and the track coloured by who was faster
// in each of them, with the sector lines and the direction of the lap.
// Page 2: speed along the lap for both drivers, and under it the gap between them along the lap.
// The distance along the lap comes from integrating the speed, so both laps are put on the same
// 0..1 scale; small differences in the line taken are ignored. OpenF1 refuses free requests while a
// session is live, and needs some minutes to publish the data after the end, so the saved copy is
// shown until a newer session can be read.
import STATUS from './status.mjs';
import { openf1 } from './utils/f1-openf1.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { readCache, writeCache } from './utils/f1-update.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';

const OPENF1 = 'https://api.openf1.org/v1';
// v2: the gap along the lap was added to the saved copy
const CACHE_KEY = 'f1-telemetry-v2';
const CHECK_EVERY_MIN = 60; // look for a newer session at most once an hour
const PUBLISH_DELAY_MIN = 30; // OpenF1 needs some time after the end of a session
const MINI_SECTORS = 25;
const TRACE_POINTS = 240;
const MAP_POINTS = 260;
const COLOURS = ['#38c8ff', '#ffd23f']; // without team colours: cyan and yellow
const MAP_W = 392;

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
const MAP_H = 278;
// speed panel on top, gap panel under it, one distance axis at the bottom
const CHART = {
	w: 600, h: 262, left: 44, right: 56, speedTop: 6, speedBottom: 158, gapTop: 178, gapBottom: 234, min: 50, max: 350,
};

const list = async (url) => {
	const data = await openf1(url);
	return Array.isArray(data) ? data : [];
};
const stripAccents = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const lapTime = (s) => {
	if (!Number.isFinite(s)) return '';
	const m = Math.floor(s / 60);
	const rest = (s - m * 60).toFixed(3).padStart(6, '0');
	return m ? `${m}:${rest}` : rest;
};
const shortName = (name) => String(name ?? '').replace('Sprint Qualifying', 'Sprint Quali').replace('Sprint Shootout', 'Sprint Quali');

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

// the turn that fits the track best in the map box
const fitTrack = (points) => {
	let best = null;
	for (let deg = 0; deg < 180; deg += 5) {
		const a = (deg * Math.PI) / 180;
		const cos = Math.cos(a);
		const sin = Math.sin(a);
		const rotated = points.map(([x, y]) => [x * cos - y * sin, -(x * sin + y * cos)]);
		const xs = rotated.map((p) => p[0]);
		const ys = rotated.map((p) => p[1]);
		const minX = Math.min(...xs);
		const minY = Math.min(...ys);
		const w = Math.max(...xs) - minX;
		const h = Math.max(...ys) - minY;
		const scale = Math.min((MAP_W - 24) / w, (MAP_H - 24) / h);
		if (!best || scale > best.scale) {
			best = {
				scale, rotated, minX, minY, w, h,
			};
		}
	}
	const offX = (MAP_W - best.w * best.scale) / 2;
	const offY = (MAP_H - best.h * best.scale) / 2;
	return best.rotated.map(([x, y]) => [Math.round((offX + (x - best.minX) * best.scale) * 10) / 10, Math.round((offY + (y - best.minY) * best.scale) * 10) / 10]);
};

// download and reduce one session to what the screen draws (small enough for localStorage)
const buildTelemetry = async (session) => {
	const laps = await list(`${OPENF1}/laps?session_key=${session.session_key}`);
	const best = new Map();
	laps.forEach((lap) => {
		if (!lap.lap_duration || lap.is_pit_out_lap) return;
		const current = best.get(lap.driver_number);
		if (!current || lap.lap_duration < current.lap_duration) best.set(lap.driver_number, lap);
	});
	const top = [...best.values()].sort((a, b) => a.lap_duration - b.lap_duration).slice(0, 2);
	if (top.length < 2) return null;

	const drivers = await list(`${OPENF1}/drivers?session_key=${session.session_key}`);
	const profiles = [];
	let positions = null;
	for (let i = 0; i < 2; i += 1) {
		const lap = top[i];
		const from = DateTime.fromISO(lap.date_start).toUTC();
		const to = from.plus({ milliseconds: Math.round(lap.lap_duration * 1000) + 300 });
		const range = `session_key=${session.session_key}&driver_number=${lap.driver_number}&date>=${encodeURIComponent(from.toISO())}&date<=${encodeURIComponent(to.toISO())}`;
		// one request at a time (OpenF1 allows a few per second)
		// eslint-disable-next-line no-await-in-loop
		const car = await list(`${OPENF1}/car_data?${range}`);
		const profile = lapProfile(car, lap.date_start, lap.lap_duration);
		if (!profile) return null;
		profiles.push(profile);
		if (i === 0) {
			// eslint-disable-next-line no-await-in-loop
			positions = await list(`${OPENF1}/location?${range}`);
		}
	}

	// the share of the lap comes from integrating a speed sampled about 4 times a second, so it drifts:
	// each lap is stretched piece by piece so that its sector lines (from the official sector times)
	// fall where the fastest lap's do, and the gap at each sector line matches the sector times
	const sectorEnds = (lap, p) => {
		const s1 = lap.duration_sector_1;
		const s2 = lap.duration_sector_2;
		return Number.isFinite(s1) && Number.isFinite(s2) ? [interp(p.ts, p.fs, s1), interp(p.ts, p.fs, s1 + s2)] : null;
	};
	const reference = sectorEnds(top[0], profiles[0]);
	const own = sectorEnds(top[1], profiles[1]);
	if (reference && own && own[0] < own[1]) {
		const from = [0, ...own, 1];
		const to = [0, ...reference, 1];
		profiles[1].fs = profiles[1].fs.map((f) => interp(from, to, f));
	}

	// mini-sectors: time each driver needs for the same share of the lap
	const timeAt = (p, f) => interp(p.fs, p.ts, f);
	const winners = [];
	for (let j = 0; j < MINI_SECTORS; j += 1) {
		const a = j / MINI_SECTORS;
		const b = (j + 1) / MINI_SECTORS;
		const d0 = timeAt(profiles[0], b) - timeAt(profiles[0], a);
		const d1 = timeAt(profiles[1], b) - timeAt(profiles[1], a);
		winners.push(d0 <= d1 ? 0 : 1);
	}

	// speed along the lap, and the gap: how much later the second driver reaches each point (s)
	const trace = [];
	for (let k = 0; k <= TRACE_POINTS; k += 1) {
		const f = k / TRACE_POINTS;
		trace.push([
			Math.round(f * 1000) / 1000,
			Math.round(interp(profiles[0].fs, profiles[0].vs, f)),
			Math.round(interp(profiles[1].fs, profiles[1].vs, f)),
			Math.round((timeAt(profiles[1], f) - timeAt(profiles[0], f)) * 1000) / 1000,
		]);
	}

	// sector lines, from the fastest lap's sector times
	const s1 = top[0].duration_sector_1;
	const s2 = top[0].duration_sector_2;
	const sectorFracs = (Number.isFinite(s1) && Number.isFinite(s2))
		? [interp(profiles[0].ts, profiles[0].fs, s1), interp(profiles[0].ts, profiles[0].fs, s1 + s2)].map((f) => Math.round(f * 1000) / 1000)
		: [];

	// track from the fastest driver's positions, each point with its share of the lap
	let map = [];
	const t0 = DateTime.fromISO(top[0].date_start).toMillis();
	const located = (positions ?? [])
		.map((p) => ({ t: (DateTime.fromISO(p.date).toMillis() - t0) / 1000, x: p.x, y: p.y }))
		.filter((p) => p.t >= 0 && p.t <= top[0].lap_duration && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.x !== 0 || p.y !== 0))
		.sort((a, b) => a.t - b.t);
	if (located.length > 30) {
		const step = Math.max(1, Math.floor(located.length / MAP_POINTS));
		const kept = located.filter((_, i) => i % step === 0);
		const xy = fitTrack(kept.map((p) => [p.x, p.y]));
		map = kept.map((p, i) => [...xy[i], Math.round(interp(profiles[0].ts, profiles[0].fs, p.t) * 1000) / 1000]);
	}

	const driverInfo = (lap, index) => {
		const d = drivers.find((x) => x.driver_number === lap.driver_number) ?? {};
		return {
			number: lap.driver_number,
			code: d.name_acronym ?? String(lap.driver_number),
			name: stripAccents(d.last_name ?? d.broadcast_name ?? ''),
			team: stripAccents(d.team_name ?? ''),
			teamColour: d.team_colour ? `#${d.team_colour}` : null,
			colour: COLOURS[index],
			lap: lap.lap_number,
			time: lap.lap_duration,
			sectors: [lap.duration_sector_1, lap.duration_sector_2, lap.duration_sector_3],
			topSpeed: Math.max(...profiles[index].vs),
		};
	};

	return {
		sessionKey: session.session_key,
		sessionName: session.session_name,
		place: stripAccents(session.country_name ?? session.location ?? ''),
		circuit: stripAccents(session.circuit_short_name ?? ''),
		year: session.year,
		date: session.date_start,
		drivers: [driverInfo(top[0], 0), driverInfo(top[1], 1)],
		lapLength: Math.round(profiles[0].length),
		winners,
		trace,
		sectorFracs,
		map,
	};
};

// latest practice or qualifying session that ended long enough ago for OpenF1 to have it
const recentSessions = async () => {
	const now = DateTime.now();
	const { year } = now;
	let sessions = await list(`${OPENF1}/sessions?year=${year}`);
	const ended = (s) => ['Practice', 'Qualifying'].includes(s.session_type)
		&& DateTime.fromISO(s.date_end).plus({ minutes: PUBLISH_DELAY_MIN }) < now;
	if (!sessions.some(ended)) sessions = await list(`${OPENF1}/sessions?year=${year - 1}`);
	return sessions.filter(ended).sort((a, b) => DateTime.fromISO(b.date_start) - DateTime.fromISO(a.date_start));
};

class F1Telemetry extends WeatherDisplay {
	constructor(navId, elemId, defaultActive) {
		super(navId, elemId, 'F1 Telemetry', defaultActive);
		this.timing.baseDelay = 15000;
		this.timing.totalScreens = 2;
	}

	async getData(weatherParameters) {
		if (!super.getData(weatherParameters)) return;

		let cache = readCache(CACHE_KEY);
		const checked = cache?.checked ? DateTime.fromISO(cache.checked) : null;
		if (!cache?.data || !checked || DateTime.now().diff(checked, 'minutes').minutes > CHECK_EVERY_MIN) {
			try {
				const sessions = await recentSessions();
				// the newest session with two timed laps (a session can end without any)
				let data = cache?.data?.sessionKey === sessions[0]?.session_key ? cache.data : null;
				for (let i = 0; !data && i < Math.min(3, sessions.length); i += 1) {
					if (cache?.data?.sessionKey === sessions[i].session_key) {
						data = cache.data;
						break;
					}
					// eslint-disable-next-line no-await-in-loop
					data = await buildTelemetry(sessions[i]);
				}
				if (data) {
					cache = { data, checked: DateTime.now().toISO() };
					writeCache(CACHE_KEY, cache);
				}
			} catch (error) {
				// refused while a session is live, or offline: the saved copy is shown
				console.warn('F1 Telemetry: OpenF1 not available', error.message);
			}
		}
		this.data = cache?.data;
		if (!this.data?.drivers?.length) {
			this.setStatus(STATUS.noData);
			return;
		}
		// colours worked out here, so a saved copy also follows this rule
		const colours = driverColours(this.data.drivers);
		this.data.drivers.forEach((d, i) => { d.colour = colours[i]; });
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		const { data } = this;
		const onChart = this.screenIndex === 1;
		const main = this.elem.querySelector('.main.f1-telemetry');
		main.classList.toggle('page-chart', onChart);
		this.elem.querySelector('.header .title.dual .top').innerHTML = 'F1 Telemetry';
		this.elem.querySelector('.header .title.dual .bottom').innerHTML = shortName(data.sessionName);

		const [a, b] = data.drivers;
		// page 1: the two laps, then the track
		this.elem.querySelectorAll('.lap-card').forEach((card, i) => {
			const d = data.drivers[i];
			const other = data.drivers[1 - i];
			card.style.setProperty('--driver', d.colour);
			card.querySelector('.code').textContent = d.code;
			card.querySelector('.team-mark').style.background = d.teamColour ?? 'transparent';
			card.querySelector('.lap').textContent = `Lap ${d.lap}`;
			card.querySelector('.time').textContent = lapTime(d.time);
			card.querySelector('.gap').textContent = i === 0 ? '' : `+${(d.time - a.time).toFixed(3)}`;
			card.querySelectorAll('.sector').forEach((el, s) => {
				const value = d.sectors[s];
				el.textContent = Number.isFinite(value) ? value.toFixed(3) : '-';
				el.classList.toggle('faster', Number.isFinite(value) && Number.isFinite(other.sectors[s]) && value < other.sectors[s]);
			});
		});
		const won = [0, 1].map((i) => data.winners.filter((w) => w === i).length);
		this.elem.querySelector('.mini-count').innerHTML = `<span style="color:${a.colour}">${a.code} ${won[0]}</span>   <span style="color:${b.colour}">${b.code} ${won[1]}</span>`;
		// the mini-sectors in lap order, each in the colour of the faster driver
		this.elem.querySelector('.mini-strip').innerHTML = data.winners.map((w) => `<span style="background:${data.drivers[w].colour}"></span>`).join('');
		this.elem.querySelector('.track').innerHTML = this.trackSvg();

		// page 2: speed and gap along the lap
		this.elem.querySelector('.chart').innerHTML = this.chartSvg();
		this.elem.querySelector('.legend').innerHTML = data.drivers
			.map((d) => `<span class="chip" style="--driver:${d.colour}"><span class="code">${d.code}</span> ${lapTime(d.time)}</span><span class="top">top ${d.topSpeed} km/h</span>`).join('');

		this.elem.querySelector('.credit').textContent = `${data.place} ${data.year}, ${data.sessionName}   Data: OpenF1`;
		this.finishDraw();
	}

	// the track in pieces, each in the colour of the faster driver in that mini-sector
	trackSvg() {
		const { map, winners, drivers } = this.data;
		if (!map?.length) return '';
		const segOf = (f) => Math.min(MINI_SECTORS - 1, Math.floor(f * MINI_SECTORS));
		const parts = [];
		let current = [];
		let seg = segOf(map[0][2]);
		const closed = [...map, map[0]];
		closed.forEach((p, i) => {
			const s = i === closed.length - 1 ? seg : segOf(p[2]);
			current.push(`${p[0]},${p[1]}`);
			if (s !== seg || i === closed.length - 1) {
				parts.push({ seg, points: current.join(' ') });
				current = [`${p[0]},${p[1]}`];
				seg = s;
			}
		});
		const outline = `<polyline points="${closed.map((p) => `${p[0]},${p[1]}`).join(' ')}" fill="none" stroke="white" stroke-width="13" stroke-linejoin="round" stroke-linecap="round"/>`;
		const coloured = parts.map((p) => `<polyline points="${p.points}" fill="none" stroke="${drivers[winners[p.seg]].colour}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
		// start and finish line
		const [x0, y0] = map[0];
		const [x1, y1] = map[1];
		const len = Math.hypot(x1 - x0, y1 - y0) || 1;
		const nx = (-(y1 - y0) / len) * 9;
		const ny = ((x1 - x0) / len) * 9;
		// start and finish line in black and white squares, and an arrow beside it in the direction of the lap
		const finish = `<line x1="${x0 - nx}" y1="${y0 - ny}" x2="${x0 + nx}" y2="${y0 + ny}" stroke="white" stroke-width="5"/>`
			+ `<line x1="${x0 - nx}" y1="${y0 - ny}" x2="${x0 + nx}" y2="${y0 + ny}" stroke="black" stroke-width="5" stroke-dasharray="3 3"/>`;
		// the arrow sits on the track a little after the line, pointing along it
		const [ax, ay] = map[Math.min(6, map.length - 1)];
		const [bx, by] = map[Math.min(8, map.length - 1)];
		const dl = Math.hypot(bx - ax, by - ay) || 1;
		const [ux, uy] = [(bx - ax) / dl, (by - ay) / dl];
		const arrow = `<polygon points="${ax + ux * 9},${ay + uy * 9} ${ax - ux * 5 - uy * 6},${ay - uy * 5 + ux * 6} ${ax - ux * 5 + uy * 6},${ay - uy * 5 - ux * 6}" fill="white" stroke="black" stroke-width="1.5"/>`;
		// sector lines (S2, S3) across the track, at the points nearest to their share of the lap
		const sectors = (this.data.sectorFracs ?? []).map((f, i) => {
			let k = 0;
			map.forEach((p, j) => { if (Math.abs(p[2] - f) < Math.abs(map[k][2] - f)) k = j; });
			const [px, py] = map[k];
			const [qx, qy] = map[(k + 1) % map.length];
			const ql = Math.hypot(qx - px, qy - py) || 1;
			const [sx, sy] = [-(qy - py) / ql, (qx - px) / ql];
			// the label goes on the side of the track away from the middle of the box
			const side = (px - MAP_W / 2) * sx + (py - MAP_H / 2) * sy >= 0 ? 1 : -1;
			const [lx, ly] = [px + sx * side * 24, py + sy * side * 24 + 6];
			return `<line x1="${px - sx * 10}" y1="${py - sy * 10}" x2="${px + sx * 10}" y2="${py + sy * 10}" stroke="black" stroke-width="6"/>`
				+ `<line x1="${px - sx * 9}" y1="${py - sy * 9}" x2="${px + sx * 9}" y2="${py + sy * 9}" stroke="white" stroke-width="2.5"/>`
				+ `<text x="${lx}" y="${ly}" class="sector-label" text-anchor="middle">S${i + 2}</text>`;
		}).join('');
		return `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" width="${MAP_W}" height="${MAP_H}">${outline}${coloured}${finish}${arrow}${sectors}</svg>`;
	}

	chartSvg() {
		const { trace, drivers, sectorFracs } = this.data;
		const c = CHART;
		const x = (f) => c.left + f * (c.w - c.left - c.right);
		const y = (v) => c.speedTop + (1 - (Math.min(Math.max(v, c.min), c.max) - c.min) / (c.max - c.min)) * (c.speedBottom - c.speedTop);
		const grid = [100, 200, 300].map((v) => `<line x1="${c.left}" x2="${c.w - c.right}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${c.left - 6}" y="${y(v) + 6}" class="axis" text-anchor="end">${v}</text>`).join('');
		const sectors = sectorFracs.map((f, i) => `<line x1="${x(f)}" x2="${x(f)}" y1="${c.speedTop}" y2="${c.gapBottom}" class="sector-line"/><text x="${x(f) + 4}" y="${c.h - 6}" class="axis">S${i + 2}</text>`).join('');
		const line = (k) => `<polyline points="${trace.map((p) => `${x(p[0]).toFixed(1)},${y(p[k + 1]).toFixed(1)}`).join(' ')}" fill="none" stroke="${drivers[k].colour}" stroke-width="2.5" stroke-linejoin="round"/>`;
		const speed = `${grid}<text x="${c.w - c.right + 6}" y="${c.speedTop + 14}" class="axis">km/h</text>${line(1)}${line(0)}`;

		// gap along the lap: above the line the first driver is ahead, under it the second
		let gap = '';
		if (trace[0]?.length > 3) {
			const most = Math.max(0.05, ...trace.map((p) => Math.abs(p[3])));
			const range = Math.ceil(most / 0.05) * 0.05;
			const zero = (c.gapTop + c.gapBottom) / 2;
			const gy = (d) => zero - (d / range) * ((c.gapBottom - c.gapTop) / 2);
			const points = trace.map((p) => `${x(p[0]).toFixed(1)},${gy(p[3]).toFixed(1)}`).join(' ');
			const area = `${x(0)},${zero} ${points} ${x(1)},${zero}`;
			const last = trace.at(-1)[3];
			gap = `<clipPath id="tel-ahead-0"><rect x="0" y="0" width="${c.w}" height="${zero}"/></clipPath>`
				+ `<clipPath id="tel-ahead-1"><rect x="0" y="${zero}" width="${c.w}" height="${c.h - zero}"/></clipPath>`
				+ `<polygon points="${area}" fill="${drivers[0].colour}" fill-opacity="0.55" clip-path="url(#tel-ahead-0)"/>`
				+ `<polygon points="${area}" fill="${drivers[1].colour}" fill-opacity="0.55" clip-path="url(#tel-ahead-1)"/>`
				+ `<line x1="${c.left}" x2="${c.w - c.right}" y1="${zero}" y2="${zero}" class="zero"/>`
				+ `<polyline points="${points}" fill="none" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>`
				+ `<text x="${c.left - 6}" y="${c.gapTop + 12}" class="axis small" text-anchor="end" fill="${drivers[0].colour}">${drivers[0].code}</text>`
				+ `<text x="${c.left - 6}" y="${c.gapBottom}" class="axis small" text-anchor="end" fill="${drivers[1].colour}">${drivers[1].code}</text>`
				+ `<text x="${c.w - c.right + 6}" y="${gy(last) + 6}" class="axis">${last >= 0 ? '+' : ''}${last.toFixed(3)}</text>`
				+ `<text x="${c.w - c.right + 6}" y="${c.gapTop + 2}" class="axis small">GAP</text>`;
		}
		return `<svg viewBox="0 0 ${c.w} ${c.h}" width="${c.w}" height="${c.h}">${sectors}${speed}${gap}<text x="${c.left + 4}" y="${c.h - 6}" class="axis">S1</text></svg>`;
	}
}

// register display
registerDisplay(new F1Telemetry(20, 'f1-telemetry', false));
