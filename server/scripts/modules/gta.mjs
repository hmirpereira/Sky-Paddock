// GTA VI on PC: how close the community projects are to running the leaked Xbox build of GTA VI on a PC.
// Page 1, the leader: score, the five steps of the ladder (exe runs, first frame, menu, world, playable) and the four
// meters that fill the rest once it is playable (story, picture, speed, stability). Page 2, the race: the top five with
// their bars and the leader's score day by day. Page 3, the latest headlines (skipped when there are none).
// The skypaddock-hub service on the Pi reads the public tracker of portwatch-vi.xyz every 3 hours and serves it in
// /gta.json; anywhere else this screen is skipped. Scores are PortWatch VI's estimates, not ours.
import { DateTime } from 'luxon';
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { plainText } from './utils/text.mjs';

const SERVICE_URL = 'http://127.0.0.1:8095/gta.json';
const LOCAL_TZ = 'Europe/Lisbon';
// the Pi asks every 3 hours: older than this and the screen is skipped rather than show stale numbers
const MAX_AGE_HOURS = 12;
const STEPS = ['Exe', 'Frame', 'Menu', 'World', 'Play'];
const METERS = [['story', 'Story'], ['render', 'Picture'], ['perf', 'Speed'], ['stability', 'Stability']];
const RACE_ROWS = 5;
const STORIES = 3;
const PAGES = ['leader', 'race', 'news'];
const LABELS = { leader: 'The leader', race: 'The race', news: 'Latest news' };
// the sparkline's drawing box (viewBox of the svg in partials/gta.ejs)
const SPARK_W = 488;
const SPARK_H = 56;

const percent = (value) => `${Math.round(value)}%`;
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, max = 100) => Math.min(max, Math.max(0, value));
const day = (iso) => DateTime.fromISO(iso ?? '', { zone: LOCAL_TZ });

const element = (cls, text) => {
	const div = document.createElement('div');
	div.className = cls;
	if (text !== undefined) div.textContent = plainText(text);
	return div;
};

const bar = (cls, width) => {
	const outer = element(cls);
	const fill = element('fill');
	fill.style.width = `${clamp(width)}%`;
	outer.append(fill);
	return outer;
};

class Gta extends WeatherDisplay {
	constructor(elemId, defaultActive) {
		super(elemId, 'GTA VI on PC', defaultActive);
		this.timing.baseDelay = 10000;
	}

	async getData(weatherParameters) {
		if (!super.getData(weatherParameters)) return;
		let data = null;
		try {
			data = await json(SERVICE_URL, { signal: AbortSignal.timeout(5000) });
		} catch (error) {
			console.warn('GTA VI: no data from the Pi', error.message);
		}
		const fresh = data?.ok && DateTime.fromISO(data.ok) > DateTime.now().minus({ hours: MAX_AGE_HOURS });
		if (!fresh || !data.leaders?.length) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.data = data;
		// the news page only when there is news
		this.pages = PAGES.filter((page) => page !== 'news' || data.news?.length);
		this.timing.totalScreens = this.pages.length;
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		const index = Math.min(Math.max(this.screenIndex, 0), this.pages.length - 1);
		const page = this.pages[index];
		PAGES.forEach((name) => {
			this.elem.querySelector(`.gta-page.${name}`).style.display = name === page ? 'block' : 'none';
		});
		this.text('.gta-top .label', `${LABELS[page]}${this.pages.length > 1 ? `  ${index + 1}/${this.pages.length}` : ''}`);
		this.drawExe();
		if (page === 'leader') this.drawLeader();
		if (page === 'race') this.drawRace();
		if (page === 'news') this.drawNews();
		this.finishDraw();
	}

	text(selector, value) {
		this.elem.querySelector(selector).textContent = plainText(value ?? '');
	}

	// top right: is the missing executable out, and for how long
	drawExe() {
		const { exe } = this.data;
		const out = exe?.status === 'released';
		let since = '';
		if (out && exe.releasedAt) {
			const days = Math.floor(DateTime.now().diff(DateTime.fromISO(exe.releasedAt), 'days').days);
			since = days < 1 ? ' today' : ` ${days} day${days === 1 ? '' : 's'}`;
		}
		this.text('.exe', out ? `Exe out${since}` : 'Exe not out');
		this.elem.querySelector('.exe').classList.toggle('out', out);
	}

	drawLeader() {
		const leader = this.data.leaders[0];
		const page = this.elem.querySelector('.gta-page.leader');
		this.text('.leader .name', leader.name);
		this.text('.leader .score', percent(leader.score));
		const meta = [
			leader.gpu?.length ? leader.gpu.join('/') : '',
			isNumber(leader.stars) ? `${leader.stars.toLocaleString('en-GB')} stars` : '',
			isNumber(leader.commits) ? `${leader.commits} commits/week` : '',
		].filter(Boolean);
		this.text('.leader .meta', meta.join('   ') || leader.stage);

		// the ladder: a node per step, filled when reached, half lit when partly reached, the rail lit up to there
		const ladder = leader.ladder ?? [];
		const next = ladder.findIndex((v) => v < 1);
		const full = next === -1 ? STEPS.length : next;
		const partial = next === -1 ? 0 : (ladder[next] ?? 0);
		page.querySelector('.rail .done').style.width = `${clamp(((full - 1 + partial) / (STEPS.length - 1)) * 100)}%`;
		const steps = page.querySelector('.steps');
		steps.replaceChildren(...STEPS.map((label, i) => {
			const step = element('step');
			if (i < full) step.classList.add('reached');
			else if (i === full && partial > 0) step.classList.add('partial');
			step.style.left = `${(i / (STEPS.length - 1)) * 100}%`;
			step.append(element('dot'), element('step-name', label));
			return step;
		}));

		// the four meters that fill the second half of the score once the build is playable
		page.querySelector('.meters').replaceChildren(...METERS.map(([key, label]) => {
			const value = leader.tracks?.[key] ?? 0;
			const shown = key === 'perf' && isNumber(leader.fps) ? `${Math.round(leader.fps)} fps` : percent(value * 100);
			const meter = element('meter');
			const head = element('meter-head');
			head.append(element('meter-name', label), element('amount', shown));
			meter.append(head, bar('meter-bar', value * 100));
			return meter;
		}));
	}

	drawRace() {
		const { leaders, history, tracked } = this.data;
		const page = this.elem.querySelector('.gta-page.race');
		page.querySelector('.rows').replaceChildren(...leaders.slice(0, RACE_ROWS).map((project, i) => {
			const row = element(`race-row${i === 0 ? ' first' : ''}`);
			row.append(element('pos', String(i + 1)), element('name', project.name), bar('bar', project.score), element('score', percent(project.score)));
			return row;
		}));

		// the leader's score day by day, from the first day the tracker has
		const trend = page.querySelector('.trend');
		const points = (history ?? []).filter((h) => isNumber(h.leader));
		trend.style.visibility = points.length >= 2 ? 'visible' : 'hidden';
		if (points.length < 2) return;
		const x = (i) => ((i / (points.length - 1)) * SPARK_W).toFixed(1);
		const y = (v) => (SPARK_H - 2 - (clamp(v) / 100) * (SPARK_H - 4)).toFixed(1);
		const line = points.map((p, i) => `${x(i)},${y(p.leader)}`).join(' ');
		trend.querySelector('.line').setAttribute('points', line);
		trend.querySelector('.area').setAttribute('points', `0,${SPARK_H} ${line} ${SPARK_W},${SPARK_H}`);
		const from = day(points[0].date);
		const caption = `Leader: ${percent(points[0].leader)} on ${from.isValid ? from.toFormat('d LLL') : '?'}, ${percent(points.at(-1).leader)} now`;
		this.text('.trend .caption', isNumber(tracked) ? `${caption}   ${tracked} in the race` : caption);
	}

	drawNews() {
		this.elem.querySelector('.gta-page.news .stories').replaceChildren(...(this.data.news ?? []).slice(0, STORIES).map((story) => {
			const when = day(story.date);
			const item = element('story');
			item.append(
				element('tag', [when.isValid ? when.toFormat('d LLL') : '', story.category].filter(Boolean).join('   ')),
				element('title', story.title),
			);
			return item;
		}));
	}
}

// register display (off by default: it only works on the Pi running skypaddock-hub)
registerDisplay(new Gta('gta', false));
