// made-up answers of the skypaddock-hub service on the Pi (http://127.0.0.1:8095), built around a
// given time so the screens that drop old data still have something to show. Nothing here comes
// from the Pi: no schedule, no home position, no keys. Aircraft are placed around Lisbon, the test location.

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const pad = (n) => String(n).padStart(2, '0');
// TAF day and hour (DDHH, UTC)
const dayHour = (ms) => {
	const d = new Date(ms);
	return `${pad(d.getUTCDate())}${pad(d.getUTCHours())}`;
};
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

const taf = (now) => {
	const issued = Math.floor(now / HOUR) * HOUR - HOUR;
	const raw = `TAF LPPR ${dayHour(issued)}00Z ${dayHour(issued + HOUR)}/${dayHour(issued + 25 * HOUR)} 07010KT 9999 FEW020`
		+ ` BECMG ${dayHour(issued + 6 * HOUR)}/${dayHour(issued + 8 * HOUR)} 31012KT`
		+ ` TEMPO ${dayHour(issued + 14 * HOUR)}/${dayHour(issued + 18 * HOUR)} 4000 BR BKN008`;
	return {
		station: 'LPPR', raw, issued: iso(issued), validTo: iso(issued + 25 * HOUR), fetched: iso(now - 10 * MIN), error: null,
	};
};

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

const schedule = (now) => ({
	generated: iso(now - HOUR),
	days: Array.from({ length: 8 }, (_, i) => {
		const date = lisbonDate(now + i * 24 * HOUR);
		if (i % 4 === 3) return { date, off: true };
		return i % 2 ? {
			date, code: 'N', start: '22:00', end: '06:00', off: false,
		} : {
			date, code: 'M', start: '07:00', end: '15:00', off: false,
		};
	}),
});

const f1jet = (now) => ({
	name: 'Max Verstappen',
	registration: 'PH-UTL',
	type: 'FA8X',
	airborne: false,
	position: {},
	flight: {
		callsign: 'XRO1071',
		from: { iata: 'NCE', icao: 'LFMN', city: 'Nice' },
		to: { iata: 'FAO', icao: 'LPFR', city: 'Faro' },
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

const news = (now) => {
	const item = (title, source, sources, minutesAgo, flags = {}) => ({
		title, source, sources, time: iso(now - minutesAgo * MIN), first: iso(now - minutesAgo * MIN), breaking: false, top: false, ...flags,
	});
	return {
		generated: iso(now),
		ok: iso(now - 5 * MIN),
		errors: {},
		items: [
			item('Test headline <b>x</b> & a < b, ação e pão', 'RTP', ['RTP', 'Expresso', 'Sabado'], 20, { top: true }),
			item('Second test headline, breaking news', 'CNN Portugal', ['CNN Portugal'], 35, { breaking: true }),
			item('Third test headline, a long one that needs more than two lines on the screen to see how it wraps there', 'Publico', ['Publico'], 50),
			item('Fourth test headline', 'Expresso', ['Expresso'], 70),
			item('Fifth test headline', 'Sabado', ['Sabado'], 90),
			item('Sixth test headline', 'RTP', ['RTP'], 110),
		],
		f1: [
			item('First Formula 1 test headline', 'F1PT', ['F1PT'], 300),
			item('Second Formula 1 test headline', 'FlyingLapF1', ['FlyingLapF1'], 600),
		],
		sources: ['RTP', 'Expresso', 'Publico', 'CNN Portugal', 'Sabado', 'FlyingLapF1', 'F1PT'],
	};
};

const health = (now) => ({ generated: iso(now), problems: [] });

// path on the Pi service -> answer
const piResponses = (now) => ({
	'/flights.json': flights(now),
	'/cancelled.json': cancelled(now),
	'/taf.json': taf(now),
	'/overhead.json': overhead(now),
	'/schedule.json': schedule(now),
	'/f1jet.json': f1jet(now),
	'/gt.json': gt(now),
	'/news.json': news(now),
	'/health.json': health(now),
	'/beat': { ok: true },
});

export default piResponses;
