// Max Verstappen's private jet (PH-UTL, ICAO address 4867E6), followed by the skypaddock-hub
// service on the Pi in the open adsb.lol network (ODbL): it asks for the jet every 5 minutes
// (2 while flying), reads its track of the last hours, finds the airports at both ends (OurAirports)
// and serves /f1jet.json; anywhere else the screen is skipped. Until 1.3 the data came from
// F1 Jet Tracker, which now lets only its own site read its files.
// Page 1: where the jet is now and its last flight. Page 2: map of the last flight.
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';

const SERVICE_URL = 'http://127.0.0.1:8095/f1jet.json';
const LOCAL_TZ = 'Europe/Lisbon';
const MAP_W = 640;
const MAP_H = 286;
const TYPES = {
	FA8X: 'Dassault Falcon 8X',
	F2TH: 'Dassault Falcon 2000',
	GLEX: 'Bombardier Global Express',
	GL5T: 'Bombardier Global 5000',
	GL7T: 'Bombardier Global 7500',
	HDJT: 'HondaJet',
};

// Max Verstappen's MV logo (file supplied by the owner of this project, without the (R) mark),
// 218 x 104 units, centred on the jet's place on the route line and drawn in the page's colours
const MARK = '<g transform="scale(0.24) translate(-103.3 -52)" fill="#ffd23f" stroke="black" stroke-width="6" stroke-linejoin="round">'
	+ '<polygon points="172.2,48.5 206.6,83 137.8,83"/><polygon points="34.4,48.5 68.9,83 0,83"/>'
	+ '<polygon points="103.3,103.7 0,0.3 65.4,10.6 103.3,48.5 141.2,10.6 206.6,0.3"/></g>';
const stripAccents = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const code = (airport) => airport?.iata ?? airport?.icao ?? '?';
const city = (airport) => stripAccents(airport?.city ?? '');
// time in Lisbon: hour today, day and hour before
const when = (iso) => {
	if (!iso) return '';
	const t = DateTime.fromISO(iso, { zone: LOCAL_TZ });
	return t.hasSame(DateTime.now().setZone(LOCAL_TZ), 'day') ? t.toFormat('HH:mm') : t.toFormat('ccc d LLL HH:mm');
};
const duration = (from, to) => {
	if (!from || !to) return '';
	const m = Math.round(DateTime.fromISO(to).diff(DateTime.fromISO(from), 'minutes').minutes);
	return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};

class F1Jet extends WeatherDisplay {
	constructor(navId, elemId, defaultActive) {
		super(navId, elemId, 'F1 Jet', defaultActive);
		this.timing.baseDelay = 12000;
		this.timing.totalScreens = 2;
	}

	async getData(weatherParameters) {
		if (!super.getData(weatherParameters)) return;
		try {
			this.jet = await json(SERVICE_URL, { signal: AbortSignal.timeout(5000) });
		} catch (error) {
			console.error('F1 Jet: no data from the Pi', error);
			this.jet = null;
		}
		if (!this.jet?.registration) {
			this.setStatus(STATUS.noData);
			return;
		}
		// the map page only when there is a route to draw
		this.timing.totalScreens = (this.jet.trail?.length ?? 0) > 1 ? 2 : 1;
		// the world outlines (215 KB) are only loaded when there is a map to draw, so only on the Pi
		if (this.timing.totalScreens > 1 && !this.world) {
			try {
				this.world = (await import('./utils/world-map.mjs')).default;
			} catch (error) {
				console.error('F1 Jet: unable to load the world map', error);
				this.timing.totalScreens = 1;
			}
		}
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		const { jet } = this;
		const onMap = this.screenIndex === 1;
		const main = this.elem.querySelector('.main.f1-jet');
		main.classList.toggle('page-map', onMap);
		const surname = stripAccents(jet.name ?? '').split(' ').at(-1) || 'F1';
		this.elem.querySelector('.header .title.dual .top').innerHTML = `${surname} Jet`;
		let bottom = 'Where It Is';
		if (onMap) bottom = jet.airborne ? 'In Flight' : 'Last Flight';
		this.elem.querySelector('.header .title.dual .bottom').innerHTML = bottom;
		if (onMap) this.drawMap();
		else this.drawNow();
		this.finishDraw();
	}

	drawNow() {
		const { jet } = this;
		const page = this.elem.querySelector('.now');
		const flight = jet.flight ?? {};
		page.querySelector('.reg').textContent = jet.registration;
		page.querySelector('.type').textContent = TYPES[jet.type] ?? jet.type ?? '';
		const status = page.querySelector('.status');
		status.textContent = jet.airborne ? 'IN FLIGHT' : 'PARKED';
		status.classList.toggle('airborne', !!jet.airborne);

		// boarding pass: airports, cities, times (Lisbon), duration and date
		[['from', flight.from, flight.departed], ['to', flight.to, jet.airborne ? null : flight.landed]].forEach(([side, airport, time]) => {
			const end = page.querySelector(`.end.${side}`);
			end.querySelector('.code').textContent = code(airport);
			end.querySelector('.city').textContent = city(airport);
			end.querySelector('.time').textContent = time ? DateTime.fromISO(time, { zone: LOCAL_TZ }).toFormat('HH:mm') : '--:--';
		});
		page.querySelector('.duration').textContent = jet.airborne ? `since ${when(flight.departed)}` : duration(flight.departed, flight.landed);
		page.querySelector('.date').textContent = flight.departed ? DateTime.fromISO(flight.departed, { zone: LOCAL_TZ }).toFormat('ccc d LLL') : '';

		// dashed line with the jet on it: at the end once landed, at its progress while flying
		const progress = jet.airborne ? this.progress() : 1;
		const x = 36 + progress * 198;
		page.querySelector('.line').innerHTML = `<svg viewBox="0 0 270 44" preserveAspectRatio="none">
			<line x1="8" y1="22" x2="262" y2="22" stroke="white" stroke-width="3" stroke-dasharray="8 7"/>
			<circle cx="8" cy="22" r="5" fill="white"/><circle cx="262" cy="22" r="5" fill="white"/>
			<g transform="translate(${x.toFixed(1)} 22)">${MARK}</g></svg>`;

		const where = page.querySelector('.where');
		where.classList.toggle('airborne', !!jet.airborne);
		if (jet.airborne) {
			const alt = jet.position?.altitudeFt ? `${(Math.round((jet.position.altitudeFt * 0.3048) / 10) * 10).toLocaleString('en-US')} m` : '';
			const speed = jet.position?.speedKt ? `${Math.round(jet.position.speedKt * 1.852)} km/h` : '';
			where.textContent = [`To ${city(flight.to) || code(flight.to)}`, alt, speed].filter(Boolean).join('   ');
		} else {
			const place = city(flight.to) || code(flight.to);
			const since = flight.landed ? DateTime.now().diff(DateTime.fromISO(flight.landed), 'hours').hours : null;
			let stay = '';
			if (since !== null && since >= 0) stay = since < 48 ? `${Math.floor(since)}h ${String(Math.floor((since % 1) * 60)).padStart(2, '0')}m` : `${Math.floor(since / 24)} days`;
			where.textContent = stay ? `In ${place} for ${stay}` : `In ${place}`;
		}
	}

	// share of the flight done, by distance from the origin over the whole route
	progress() {
		const { from, to } = this.jet.flight ?? {};
		const here = this.jet.position;
		if (!from?.lat || !to?.lat || !here?.lat) return 0.5;
		const dist = (a, b) => {
			const r = (d) => (d * Math.PI) / 180;
			const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
			return 2 * Math.asin(Math.sqrt(h));
		};
		const done = dist(from, here);
		const left = dist(here, to);
		return Math.min(0.95, Math.max(0.05, done / (done + left || 1)));
	}

	drawMap() {
		const { jet } = this;
		const flight = jet.flight ?? {};
		// the route, with longitudes kept continuous across the 180th meridian
		let prev = null;
		const track = (jet.trail ?? []).map(([lat, lon]) => {
			let x = lon;
			if (prev !== null) while (x - prev > 180) x -= 360;
			if (prev !== null) while (prev - x > 180) x += 360;
			prev = x;
			return [x, lat];
		});
		const near = (lon) => {
			if (lon === undefined || lon === null || !track.length) return lon;
			let x = lon;
			while (x - track[0][0] > 180) x -= 360;
			while (track[0][0] - x > 180) x += 360;
			return x;
		};
		const ends = [flight.from, flight.to].filter((a) => a?.lat !== null && a?.lat !== undefined)
			.map((a) => ({ code: code(a), lon: near(a.lon), lat: a.lat }));
		const points = [...track, ...ends.map((a) => [a.lon, a.lat])];

		// equirectangular, scaled by the cosine of the middle latitude, fitted with a margin
		let west = Math.min(...points.map((p) => p[0]));
		let east = Math.max(...points.map((p) => p[0]));
		let south = Math.min(...points.map((p) => p[1]));
		let north = Math.max(...points.map((p) => p[1]));
		const midLat = (south + north) / 2;
		const k = Math.cos((midLat * Math.PI) / 180);
		// at least 6 degrees of latitude across, and room around the route
		const spanY = Math.max(north - south, 6) * 1.35;
		const spanX = Math.max((east - west) * k, 6) * 1.25;
		const scale = Math.min(MAP_W / spanX, MAP_H / spanY);
		const cx = (west + east) / 2;
		const cy = midLat;
		west = cx - MAP_W / scale / k / 2;
		east = cx + MAP_W / scale / k / 2;
		north = cy + MAP_H / scale / 2;
		south = cy - MAP_H / scale / 2;
		const px = (lon, lat) => [(MAP_W / 2 + (lon - cx) * k * scale).toFixed(1), (MAP_H / 2 - (lat - cy) * scale).toFixed(1)];

		// land: only the outlines that reach the view (copies one turn east and west for routes over the 180th meridian)
		const land = [];
		[-360, 0, 360].forEach((shift) => {
			this.world.forEach((ring) => {
				let inView = false;
				for (let i = 0; i < ring.length && !inView; i += 1) {
					const lon = ring[i][0] + shift;
					if (lon >= west - 20 && lon <= east + 20 && ring[i][1] >= south - 20 && ring[i][1] <= north + 20) inView = true;
				}
				if (inView) land.push(`<polygon class="land" points="${ring.map(([lon, lat]) => px(lon + shift, lat).join(',')).join(' ')}"/>`);
			});
		});
		const line = `<polyline class="track" points="${track.map(([lon, lat]) => px(lon, lat).join(',')).join(' ')}"/>`;
		const marks = ends.map((a, i) => {
			const [x, y] = px(a.lon, a.lat);
			// the code above the dot, or below when it would leave the map
			const ty = Number(y) < 30 ? Number(y) + 24 : Number(y) - 10;
			return `<circle class="airport" cx="${x}" cy="${y}" r="5"/><text class="code" x="${x}" y="${ty}" text-anchor="middle">${i === 0 && ends.length === 2 && a.code === ends[1].code ? '' : a.code}</text>`;
		});
		let plane = '';
		if (jet.airborne && track.length) {
			const [x, y] = px(...track.at(-1));
			plane = `<circle class="plane" cx="${x}" cy="${y}" r="6"/>`;
		}
		this.elem.querySelector('.map-svg').innerHTML = `<svg viewBox="0 0 ${MAP_W} ${MAP_H}"><rect class="sea" width="${MAP_W}" height="${MAP_H}"/>${land.join('')}${line}${marks.join('')}${plane}</svg>`;
		this.elem.querySelector('.map-route').textContent = jet.airborne
			? `${code(flight.from)}-${code(flight.to)}  since ${when(flight.departed)}`
			: `${code(flight.from)}-${code(flight.to)}  ${duration(flight.departed, flight.landed)}`;
	}
}

// register display (off by default: it only works on the Pi running skypaddock-hub)
registerDisplay(new F1Jet(22, 'f1-jet', false));
