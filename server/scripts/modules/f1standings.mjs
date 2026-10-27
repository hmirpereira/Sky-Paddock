// current Formula 1 drivers' championship, scrolling through the whole field
// (same idea as the Travel Forecast screen)
// Source: Jolpica F1 API (successor of Ergast), no key, CORS enabled.
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import ScrollWeatherDisplay from './scrollweatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { readCache, writeCache, isFresh } from './utils/f1-update.mjs';
import { plainText } from './utils/text.mjs';

const STANDINGS_URL = 'https://api.jolpi.ca/ergast/f1/current/driverstandings/';
// the standings list every team a driver raced for this season, in no particular order,
// so each driver's current team is taken from the latest race
const LAST_RACE_URL = 'https://api.jolpi.ca/ergast/f1/current/last/results/';
// the box scrolls (scrollweatherdisplay.mjs)
const ROW_HEIGHT = 40; // keep in sync with _f1-standings.scss
const VISIBLE_HEIGHT = 280; // 7 rows

// v2: the team now comes from the latest race (older copies may show the wrong team)
const CACHE_KEY = 'f1-standings-cache-v2';

// the Star4000 fonts draw accented letters blank (Pérez -> P rez), so accents are removed

class F1Standings extends ScrollWeatherDisplay {
	constructor(elemId, defaultActive) {
		super(elemId, 'F1 Standings', defaultActive);
	}

	async getData(_weatherParameters) {
		if (!super.getData(_weatherParameters)) return;

		let cache = readCache(CACHE_KEY);
		if (!isFresh(cache)) {
			try {
				const response = await json(STANDINGS_URL);
				const lastRace = await json(LAST_RACE_URL).catch(() => null);
				const teamInLastRace = {};
				(lastRace?.MRData?.RaceTable?.Races?.[0]?.Results ?? []).forEach((result) => {
					teamInLastRace[result.Driver?.driverId] = result.Constructor?.constructorId;
				});
				const list = response?.MRData?.StandingsTable?.StandingsLists?.[0];
				cache = {
					round: list?.round,
					season: list?.season,
					drivers: (list?.DriverStandings ?? []).map((standing) => ({
						position: standing.positionText ?? standing.position,
						name: standing.Driver?.familyName ?? standing.Driver?.code ?? '',
						points: standing.points,
						// team in the latest race; if the driver missed it, the last team listed
						team: teamInLastRace[standing.Driver?.driverId] ?? standing.Constructors?.at(-1)?.constructorId ?? '',
					})),
				};
				writeCache(CACHE_KEY, cache);
			} catch (error) {
				// keep showing the saved copy if there is one
				console.error('F1Standings: unable to get the standings', error);
				if (!cache?.drivers) {
					this.setStatus(STATUS.failed);
					return;
				}
			}
		}
		this.round = cache.round;
		this.season = cache.season;
		this.drivers = cache.drivers ?? [];

		// before the first race of a season there are no standings yet: skip the screen
		if (this.drivers.length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}

		// hold, scroll to the last driver, hold
		this.setScrollDistance(this.drivers.length * ROW_HEIGHT - VISIBLE_HEIGHT);
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();

		const lines = this.drivers.map((driver) => {
			const row = this.fillTemplate('f1-row', {
				position: driver.position,
				driver: plainText(driver.name),
				points: driver.points,
			});
			// team icon: images/teams/<constructorId>.png (hidden if missing)
			const team = row.querySelector('.team');
			team.addEventListener('error', () => { team.style.visibility = 'hidden'; });
			team.src = `images/teams/${driver.team}.png`;
			return row;
		});

		const list = this.elem.querySelector('.f1-lines');
		list.innerHTML = '';
		list.append(...lines);
		this.elem.querySelector('.main').scrollTo(0, 0);

		this.elem.querySelector('.header .title.dual .bottom').textContent = this.round ? `After Round ${this.round}` : 'Standings';

		this.finishDraw();
	}

	// a screenIndexChange method replaces the default drawCanvas call, so draw here
	async screenIndexChange() {
		await this.drawCanvas();
		super.screenIndexChange();
	}
}

// register display
registerDisplay(new F1Standings('f1-standings', true));
