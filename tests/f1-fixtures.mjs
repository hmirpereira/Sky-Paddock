// Made-up Jolpica F1 answers for the smoke test, built from the time of the test so the F1 screens always end the same way
// (the weekend of round 17 finished 6 hours ago: F1 Last Race and F1 Standings load, F1 Grid has nothing to show, round 18 is next),
// whatever day the sites were recorded. Only the fields the screens read; the names are real public data, the results are not.
const DAY = 24 * 3600 * 1000;
const when = (time) => {
	const iso = new Date(time).toISOString();
	return { date: iso.slice(0, 10), time: `${iso.slice(11, 19)}Z` };
};

const singapore = {
	season: '2026',
	round: '17',
	raceName: 'Singapore Grand Prix',
	Circuit: {
		circuitId: 'marina_bay',
		circuitName: 'Marina Bay Street Circuit',
		Location: {
			lat: '1.2914', long: '103.864', locality: 'Marina Bay', country: 'Singapore',
		},
	},
};
const austin = {
	season: '2026',
	round: '18',
	raceName: 'United States Grand Prix',
	Circuit: {
		circuitId: 'americas',
		circuitName: 'Circuit of the Americas',
		Location: {
			lat: '30.1328', long: '-97.6411', locality: 'Austin', country: 'USA',
		},
	},
};

const DRIVERS = [
	['max_verstappen', 'Verstappen', 'VER', 'red_bull', 'Red Bull'],
	['norris', 'Norris', 'NOR', 'mclaren', 'McLaren'],
	['leclerc', 'Leclerc', 'LEC', 'ferrari', 'Ferrari'],
	['russell', 'Russell', 'RUS', 'mercedes', 'Mercedes'],
	['hamilton', 'Hamilton', 'HAM', 'ferrari', 'Ferrari'],
	['alonso', 'Alonso', 'ALO', 'aston_martin', 'Aston Martin'],
	['piastri', 'Piastri', 'PIA', 'mclaren', 'McLaren'],
	['gasly', 'Gasly', 'GAS', 'alpine', 'Alpine'],
];
const driver = ([driverId, familyName, code]) => ({ driverId, familyName, code });
const constructor = ([, , , constructorId, name]) => ({ constructorId, name });

const results = (start) => ({
	...singapore,
	...when(start),
	Results: DRIVERS.map((d, i) => ({
		position: String(i + 1),
		positionText: String(i + 1),
		points: String(25 - i * 3),
		Driver: driver(d),
		Constructor: constructor(d),
		status: 'Finished',
		Time: i === 0 ? { time: '1:42:00.785' } : { time: `+${(i * 3.4).toFixed(3)}` },
		FastestLap: i === 4 ? { rank: '1', lap: '44', Time: { time: '1:34.123' } } : { rank: String(i + 2), lap: '40', Time: { time: '1:35.000' } },
	})),
});

const table = (races) => ({ MRData: { RaceTable: { season: '2026', Races: races } } });

// path of a Jolpica request -> answer (undefined: nothing made up for it)
const jolpicaResponses = (now) => {
	const raceStart = now - 6 * 3600 * 1000;
	const nextStart = now + 10 * DAY;
	const nextWeekend = {
		...austin,
		...when(nextStart),
		FirstPractice: when(nextStart - 2 * DAY),
		SecondPractice: when(nextStart - 2 * DAY + 3.5 * 3600 * 1000),
		ThirdPractice: when(nextStart - DAY),
		Qualifying: when(nextStart - DAY + 4 * 3600 * 1000),
	};
	const last = table([results(raceStart)]);
	return {
		'/ergast/f1/current/races/': table([
			{
				...singapore, ...when(raceStart), FirstPractice: when(raceStart - 2 * DAY), Qualifying: when(raceStart - DAY),
			},
			nextWeekend,
		]),
		'/ergast/f1/2026/17/results/': last,
		'/ergast/f1/current/last/results/': last,
		'/ergast/f1/current/next/races/': table([nextWeekend]),
		'/ergast/f1/current/driverstandings/': {
			MRData: {
				StandingsTable: {
					StandingsLists: [{
						season: '2026',
						round: '17',
						DriverStandings: DRIVERS.map((d, i) => ({
							position: String(i + 1), positionText: String(i + 1), points: String(340 - i * 25), Driver: driver(d), Constructors: [constructor(d)],
						})),
					}],
				},
			},
		},
	};
};

export default jolpicaResponses;
