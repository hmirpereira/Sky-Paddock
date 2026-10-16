// fastest laps of the two quickest drivers in the latest practice or qualifying session,
// from OpenF1 (https://openf1.org, car telemetry and positions at about 4 per second).
// Page 1: lap and sector times, and the track coloured by who was faster in each of 25 mini-sectors.
// Page 2: speed along the lap for both drivers.
// The distance along the lap comes from integrating the speed, so both laps are put on the same
// 0..1 scale; small differences in the line taken are ignored. OpenF1 refuses free requests while a
// session is live, and needs some minutes to publish the data after the end, so the saved copy is
// shown until a newer session can be read.
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { readCache, writeCache } from './utils/f1-update.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';

const OPENF1 = 'https://api.openf1.org/v1';
const CACHE_KEY = 'f1-telemetry';
const CHECK_EVERY_MIN = 60; // look for a newer session at most once an hour
const PUBLISH_DELAY_MIN = 30; // OpenF1 needs some time after the end of a session
const MINI_SECTORS = 25;
const TRACE_POINTS = 240;
const MAP_POINTS = 260;
const COLOURS = ['#38c8ff', '#ffd23f']; // cyan and yellow: readable on the red and black F1 theme
const MAP_W = 392;
const MAP_H = 278;
const CHART = {
	w: 600, h: 262, left: 44, right: 8, top: 10, bottom: 26, min: 50, max: 350,
};

const list = async (url) => {
	const data = await json(url);
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

	// speed along the lap
	const trace = [];
	for (let k = 0; k <= TRACE_POINTS; k += 1) {
		const f = k / TRACE_POINTS;
		trace.push([Math.round(f * 1000) / 1000, Math.round(interp(profiles[0].fs, profiles[0].vs, f)), Math.round(interp(profiles[1].fs, profiles[1].vs, f))]);
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
		this.elem.querySelector('.mini-count').innerHTML = `<span style="color:${a.colour}">${a.code} ${won[0]}</span> &nbsp; <span style="color:${b.colour}">${b.code} ${won[1]}</span> <span class="of">of ${data.winners.length}</span>`;
		this.elem.querySelector('.track').innerHTML = this.trackSvg();

		// page 2: speed along the lap
		this.elem.querySelector('.chart').innerHTML = this.chartSvg();
		this.elem.querySelector('.legend').innerHTML = data.drivers
			.map((d) => `<span style="color:${d.colour}">${d.code} ${lapTime(d.time)}, top speed ${d.topSpeed}</span>`).join('   ');

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
		const finish = `<line x1="${x0 - nx}" y1="${y0 - ny}" x2="${x0 + nx}" y2="${y0 + ny}" stroke="black" stroke-width="3"/>`;
		return `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" width="${MAP_W}" height="${MAP_H}">${outline}${coloured}${finish}</svg>`;
	}

	chartSvg() {
		const { trace, drivers, sectorFracs } = this.data;
		const c = CHART;
		const x = (f) => c.left + f * (c.w - c.left - c.right);
		const y = (v) => c.top + (1 - (Math.min(Math.max(v, c.min), c.max) - c.min) / (c.max - c.min)) * (c.h - c.top - c.bottom);
		const grid = [100, 150, 200, 250, 300].map((v) => `<line x1="${c.left}" x2="${c.w - c.right}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${c.left - 6}" y="${y(v) + 6}" class="axis" text-anchor="end">${v}</text>`).join('');
		const sectors = sectorFracs.map((f, i) => `<line x1="${x(f)}" x2="${x(f)}" y1="${c.top}" y2="${c.h - c.bottom}" class="sector-line"/><text x="${x(f)}" y="${c.h - 6}" class="axis" text-anchor="middle">S${i + 2}</text>`).join('');
		const line = (k) => `<polyline points="${trace.map((p) => `${x(p[0]).toFixed(1)},${y(p[k + 1]).toFixed(1)}`).join(' ')}" fill="none" stroke="${drivers[k].colour}" stroke-width="2.5" stroke-linejoin="round"/>`;
		return `<svg viewBox="0 0 ${c.w} ${c.h}" width="${c.w}" height="${c.h}">${grid}${sectors}<text x="${c.left}" y="${c.h - 6}" class="axis">S1</text><text x="${c.w - c.right}" y="${c.h - 6}" class="axis" text-anchor="end">km/h</text>${line(1)}${line(0)}</svg>`;
	}
}

// register display
registerDisplay(new F1Telemetry(23, 'f1-telemetry', false));
