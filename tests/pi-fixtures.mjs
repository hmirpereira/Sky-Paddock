// made-up answers of the skypaddock-hub service on the Pi (http://127.0.0.1:8095), built around a
// given time so the screens that drop old data still have something to show. Nothing here comes
// from the Pi: no schedule, no home position, no keys. Aircraft are placed around Lisbon, the test location.

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
// date in Lisbon (YYYY-MM-DD)
const lisbonDate = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date(ms));

const flights = (now) => ({
	source: 'AeroDataBox',
	airport: 'OPO',
	generated: iso(now),
	lastUpdate: iso(now - 30 * MIN),
	flights: [
		['LH 1177', 40, 'FRA', 'ON TIME'],
		['LH 1793', 95, 'MUC', 'DELAYED'],
		['LX 2093', 150, 'ZRH', 'ON TIME'],
		['OS 368', 210, 'VIE', 'ON TIME'],
		['SN 3820', 260, 'BRU', 'CANCELLED'],
		['EW 7689', 330, 'DUS', 'ON TIME'],
		['LH 1181', 400, 'FRA', 'ON TIME'],
	].map(([number, minutes, destination, status]) => ({
		number,
		scheduled: iso(now + minutes * MIN),
		estimated: iso(now + (minutes + (status === 'DELAYED' ? 25 : 0)) * MIN),
		status,
		destination,
	})),
});

const cancelled = (now) => ({
	source: 'AeroDataBox',
	airport: 'OPO',
	generated: iso(now),
	lastUpdate: iso(now - 30 * MIN),
	flights: [
		{
			number: 'TP 1950', airline: 'TAP', destination: 'LIS', destinationName: 'Lisbon', scheduled: iso(now + 2 * HOUR), uncertain: false,
		},
		{
			number: 'FR 8341', airline: 'Ryanair', destination: null, destinationName: 'Paris', scheduled: iso(now + 5 * HOUR), uncertain: true,
		},
	],
});

// small airport plan near Lisbon (lines of [lat, lon]), as the Pi serves the real one
const airportPlan = {
	name: 'LIS',
	lat: 38.7742,
	lon: -9.1342,
	map: {
		runways: [[[38.7630, -9.1450], [38.7900, -9.1220]]],
		taxiways: [[[38.7660, -9.1400], [38.7700, -9.1300]], [[38.7700, -9.1300], [38.7800, -9.1250]]],
		aprons: [[[38.7690, -9.1320], [38.7710, -9.1280], [38.7680, -9.1260], [38.7660, -9.1300], [38.7690, -9.1320]]],
	},
	taxiwayRefs: ['A', 'B'],
	stands: [['S1', 38.7690, -9.1300], ['S2', 38.7685, -9.1290]],
};

const overhead = (now) => ({
	generated: iso(now),
	localOk: iso(now - MIN),
	localError: null,
	networkOk: iso(now - MIN),
	networkError: null,
	openskyOk: null,
	openskyError: null,
	openskyCredits: null,
	aircraft: [
		{
			callsign: 'TAP1234', flight: 'TP1234', airline: 'TAP', iataAirline: 'TP', reg: 'CS-TJE', type: 'A321', lat: 38.80, lon: -9.20, alt: 4500, gs: 210, track: 30, vrate: 1200, ground: false, source: 'local', from: { iata: 'LIS', city: 'Lisbon' }, to: { iata: 'FRA', city: 'Frankfurt' },
		},
		{
			callsign: 'DLH1173', flight: 'LH1173', airline: 'Lufthansa', iataAirline: 'LH', reg: 'D-AIZA', type: 'A320', lat: 38.95, lon: -9.05, alt: 24000, gs: 430, track: 200, vrate: -800, ground: false, source: 'adsb.lol', from: { iata: 'FRA', city: 'Frankfurt' }, to: { iata: 'LIS', city: 'Lisbon' },
		},
		{
			callsign: 'RYR10UB', airline: 'Ryanair', iataAirline: 'FR', reg: 'EI-DCL', type: 'B738', lat: 38.55, lon: -9.40, alt: 36000, gs: 460, track: 10, vrate: 0, ground: false, source: 'adsb.lol',
		},
		{
			callsign: 'TAP501', flight: 'TP501', airline: 'TAP', iataAirline: 'TP', reg: 'CS-TVA', type: 'A20N', lat: 38.7690, lon: -9.1300, alt: 0, gs: 0, track: 0, vrate: 0, ground: true, source: 'local',
		},
	],
	parked: [
		{
			callsign: 'DLH1179', flight: 'LH1179', reg: 'D-AINB', type: 'A20N', lat: 38.7685, lon: -9.1290, stand: 'S2', since: iso(now - 2 * HOUR), lastSeen: iso(now - HOUR),
		},
	],
	airport: airportPlan,
});

// the Gates page: made-up names; today and tomorrow have gates, so the page has rows whatever the time of the recording
const gates = {
	gates: [
		{
			dests: ['FRA'],
			with: ['ANA M', 'RUI T', 'TOM X'],
			star: true,
			flights: [{
				number: 'LH1175', time: '12:35', etd: '12:50', stand: 'S35', eta: '11:58', arrival: 'LH1174', ramp: 'CRISTIANO F',
			}],
		},
		{
			dests: ['ZRH', 'VIE'],
			with: ['LIA F', 'TOM X'],
			flights: [{
				number: 'LX2067', time: '18:05', stand: 'S30', eta: '17:10', arrival: 'LX2066', ramp: 'OLGA',
			}, { number: 'OS492', time: '19:40', arrival: 'OS491' }],
		},
	],
	supervisors: { morning: ['EVA S'], afternoon: ['IVO S', 'ZE P'], night: [] },
};
// every gate of the day (Personal Gates off): mine and those of the others
gates.allGates = [
	{ dests: ['MUC'], with: ['BIA N', 'GIL R'], flights: [{ number: 'LH1785', time: '06:40', arrival: 'LH1784' }] },
	{
		dests: ['GVA'],
		with: ['DUDA V', 'NUNO Q', 'SARA W'],
		flights: [{
			number: 'LX2079', time: '10:15', stand: 'S31', eta: '09:30', arrival: 'LX2078', ramp: 'VASCO D',
		}],
	},
	...gates.gates,
];

const schedule = (now) => ({
	generated: iso(now - HOUR),
	days: Array.from({ length: 8 }, (_, i) => {
		const date = lisbonDate(now + i * 24 * HOUR);
		// the other schedule of the same day (R): a shift on some days, a day off on others
		const r = i % 3 ? {
			code: 'M', start: '07:00', end: '15:00', off: false,
		} : {
			code: '', off: true, start: null, end: null,
		};
		if (i % 4 === 3) return { date, off: true, r };
		return i % 2 ? {
			date, code: 'N', start: '22:00', end: '06:00', off: false, r,
		} : {
			date, code: 'M', start: '07:00', end: '15:00', off: false, r,
		};
	}).map((day, i) => (i < 2 ? { ...day, ...gates } : day)),
});

const f1jet = (now) => ({
	name: 'Max Verstappen',
	registration: 'PH-UTL',
	type: 'FA8X',
	airborne: false,
	position: {},
	flight: {
		callsign: 'XRO1071',
		from: {
			iata: 'NCE', icao: 'LFMN', city: 'Nice', lat: 43.658, lon: 7.216,
		},
		to: {
			iata: 'FAO', icao: 'LPFR', city: 'Faro', lat: 37.014, lon: -7.966,
		},
		departed: iso(now - 14 * HOUR),
		landed: iso(now - 11.5 * HOUR),
	},
	trail: [[43.66, 7.21], [43.0, 4.5], [41.8, 0.5], [40.2, -3.6], [38.6, -6.4], [37.02, -7.97]],
	source: 'adsb.lol',
	ok: iso(now - 5 * MIN),
	error: null,
});

const gt = (now) => {
	const result = (pos, car, drivers, team, gap, highlight = false) => ({
		pos, car, cls: 'Pro Cup', drivers, team, model: 'GT3', best: '1:44.500', laps: '94', gap, highlight,
	});
	const results = [
		result(1, '17', ['Driver One', 'Driver Two'], 'Team Alpha', ''),
		result(2, '80', ['Driver Three', 'Driver Four'], 'Team Bravo', '5.062'),
		result(3, '3', ['Driver Five', 'Driver Six'], 'Verstappen Racing', '8.110', true),
		result(4, '32', ['Driver Seven', 'Driver Eight'], 'Team Charlie', '12.400'),
	];
	const day = 24 * HOUR;
	return {
		season: new Date(now).getUTCFullYear(),
		event: 'Portimao',
		dates: 'last weekend',
		races: [{ race: 'Main Race', results }],
		highlight: 'Verstappen',
		source: 'gt-world-challenge-europe.com',
		next: {
			event: 'Barcelona',
			country: 'Spain',
			dates: 'next weekend',
			round: '11',
			cup: null,
			length: '4.657km',
			turns: '14',
			sessions: [
				{ name: 'Free Practice 1', start: iso(now + 5 * day) },
				{ name: 'Qualifying', start: iso(now + 6 * day) },
				{ name: 'Race', start: iso(now + 7 * day) },
			],
			race: iso(now + 7 * day),
			url: 'https://www.gt-world-challenge-europe.com/',
		},
		ok: iso(now - 10 * MIN),
		error: null,
	};
};

// made-up news pictures (a sky with a sun, hills, a plane), as the thumbnails beside the headlines
const picture = (sky, ground, extra = '') => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect width="160" height="120" fill="${sky}"/><circle cx="120" cy="35" r="16" fill="#ffd34d"/><path d="M0 90 Q40 60 80 85 T160 80 V120 H0Z" fill="${ground}"/>${extra}</svg>`)}`;
const PLANE = '<path d="M30 50 L110 42 L118 46 L110 50 L30 54Z M70 46 L58 26 L66 26 L86 46Z M70 50 L58 70 L66 70 L86 50Z" fill="white"/>';

const news = (now) => {
	const item = (title, source, sources, minutesAgo, flags = {}) => ({
		title, source, sources, time: iso(now - minutesAgo * MIN), first: iso(now - minutesAgo * MIN), breaking: false, top: false, ...flags,
	});
	return {
		generated: iso(now),
		ok: iso(now - 5 * MIN),
		errors: {},
		items: [
			item('Test headline <b>x</b> & a < b, ação e pão', 'RTP', ['RTP', 'Expresso', 'Publico'], 20, { top: true, image: picture('#5aa0e6', '#3c8c46') }),
			item('Second test headline, breaking news', 'CNN Portugal', ['CNN Portugal'], 35, { breaking: true, image: picture('#8a4a8c', '#5a3a2a') }),
			item('Third test headline, a long one that needs more than two lines on the screen to see how it wraps there', 'Publico', ['Publico'], 50),
			item('Fourth test headline, with a picture and about seventy nine letters in all, a bit long', 'Expresso', ['Expresso'], 70, { image: picture('#5aa0e6', '#3c8c46') }),
			item('Fifth test headline with a picture and the longest length seen in practice, about one hundred and ten letters here, to see it', 'Publico', ['Publico'], 90, { image: picture('#8a4a8c', '#5a3a2a') }),
			item('Sixth test headline, a picture and around sixty six letters here', 'RTP', ['RTP'], 110, { image: picture('#d8d8e0', '#c03030') }),
		],
		aviation: [
			item('First aviation test headline', 'Aviacao TV', ['Aviacao TV'], 200, { image: picture('#4a90d8', '#7a8a96', PLANE) }),
			item('Second aviation test headline', 'Aviacao TV', ['Aviacao TV'], 900),
		],
		f1: [
			item('First Formula 1 test headline', 'F1PT', ['F1PT'], 300, { image: picture('#d8d8e0', '#c03030') }),
			item('Second Formula 1 test headline', 'FlyingLapF1', ['FlyingLapF1'], 600),
			item('Third Formula 1 test headline', 'PlanetF1', ['PlanetF1'], 700),
		],
		sources: ['RTP', 'Expresso', 'Publico', 'CNN Portugal', 'Aviacao TV', 'FlyingLapF1', 'F1PT', 'PlanetF1'],
	};
};

// Plex Recommends: made-up movies, with no poster (the screen hides the empty picture)
const plex = (now) => ({
	generated: iso(now),
	ok: iso(now - 5 * MIN),
	error: null,
	latest: {
		key: '1', title: 'Test Movie One', year: 2026, rating: 87, ripe: true, audience: 64, upright: true, runtime: 121, summary: 'A made up synopsis for the test, long enough to need more than one line of the box beside the poster. Nothing in it is real.', poster: null,
	},
	random: {
		key: '2', title: 'Another Made Up Movie With A Rather Long Title', year: 1999, rating: 31, ripe: false, audience: 45, upright: false, runtime: 95, summary: 'Some more made up words. '.repeat(30), poster: null,
	},
});

// Plex Now Playing: one made-up episode, playing (poster served by tests/smoke.spec.mjs)
const plexNow = (now) => ({
	generated: iso(now),
	ok: iso(now),
	error: null,
	sessions: [{
		key: '10', title: 'Made Up Show', detail: 'S2 E5 - The One With A Rather Long Episode Name', state: 'playing', user: 'Guest', player: 'Living Room TV', offset: 1260, duration: 2700, poster: '/plexnow-poster-10.jpg', avatar: '/plexnow-avatar-4.jpg', summary: 'Some more made up words. '.repeat(30),
	}],
});

// the Status screen (Debug mode): one row per source, one of them that never answered
const sources = (now) => ({
	generated: iso(now),
	pi: {
		load: 0.42, temp: 57, memFreeMb: 303, uptimeMin: 283, hubMin: 95, diskFreeGb: 47, wifiDbm: -58,
	},
	rows: [
		['Flights', 5, '90 units left', 720], ['ADS-B receiver', 1, '', 15], ['ADS-B network', 1, '', 15], ['OpenSky', 2, '6738 credits', 30], ['METAR', 40, '', 360],
		['Verstappen Jet', 50, '', 30], ['News', 4, '', 30], ['GT World', 120, '', 480], ['Plex', 20, '', 720], ['Schedule', 30, '', 360], ['TV page', 1, '', 5],
	].map(([name, minutes, note, limit]) => ({
		name, ok: minutes === null ? null : iso(now - minutes * MIN), note, limit,
	})),
});

// F1 Photo: a made-up title with a long tail to test the two lines of the caption (the picture itself is made up in smoke.spec.mjs)
const f1photo = (now) => ({
	title: 'A made up photo of a made up car going round a made up corner at sunset, with a rather long title',
	image: '/f1photo.jpg?v=test',
	day: '2026-10-24',
	link: null,
	ok: iso(now - 5 * MIN),
	error: null,
});

const health = (now) => ({ generated: iso(now), problems: [] });

// path on the Pi service -> answer
const piResponses = (now) => ({
	'/flights.json': flights(now),
	'/cancelled.json': cancelled(now),
	'/overhead.json': overhead(now),
	'/schedule.json': schedule(now),
	'/f1jet.json': f1jet(now),
	'/gt.json': gt(now),
	'/news.json': news(now),
	'/plex.json': plex(now),
	'/plexnow.json': plexNow(now),
	'/f1photo.json': f1photo(now),
	'/health.json': health(now),
	'/sources.json': sources(now),
	'/musica.json': { track: 'Departure Lounge, 89F' },
	'/airport.json': {
		icao: 'LPPT', iata: 'LIS', city: 'Lisbon', lat: 38.774, lon: -9.134,
	},
	'/beat': { ok: true },
});

export default piResponses;
