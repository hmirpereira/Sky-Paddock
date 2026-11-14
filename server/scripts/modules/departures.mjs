// Lufthansa Group departures of the day from the local airport (set on the Pi), all of them, also those that have left
// Flight data comes from AeroDataBox and from the airport's FLIC page (status and ETD) through a small service on the Raspberry Pi
// (skypaddock-hub), which keeps the API key private and serves the result on the Pi only; it also decides which day is shown
// (tomorrow's flights an hour after the last one of today has left).
// Anywhere else the service is not reachable and this screen is skipped.
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { loadAirportCity, placeTitle } from './utils/local-place.mjs';
import ConversionHelpers from './utils/conversionHelpers.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import fillFooter from './utils/footer.mjs';

const SERVICE_URL = 'http://127.0.0.1:8095/flights.json';
const AIRPORT_TZ = 'Europe/Lisbon';
// leaves room for the footer; busy days use pages (7 flights = 4 + 3)
const ROWS_PER_PAGE = 6;

const STATUS_CLASS = {
	'ON TIME': 'on-time',
	SCHEDULED: 'scheduled',
	DELAYED: 'delayed',
	CANCELLED: 'cancelled',
	DEPARTED: 'departed',
	BOARDING: 'boarding',
	BOARDED: 'boarded',
};

class Departures extends WeatherDisplay {
	constructor(elemId, defaultActive) {
		super(elemId, 'Departures', defaultActive);

		// set timings (seconds on screen)
		this.timing.baseDelay = 10000;
	}

	async getData(_weatherParameters) {
		if (!super.getData(_weatherParameters)) return;

		let response;
		try {
			response = await json(SERVICE_URL, { signal: AbortSignal.timeout(5000) });
		} catch (error) {
			// not on the Pi, or the service is down: skip the screen quietly
			console.warn('Departures: flight service not reachable', error.message);
			this.setStatus(STATUS.noData);
			return;
		}

		await loadAirportCity();

		// the service sends the flights to show (the day's, departed ones too): in the order of the ETD
		this.flights = [...(response.flights ?? [])].sort((a, b) => Date.parse(a.estimated) - Date.parse(b.estimated));
		this.lastUpdate = response.lastUpdate ? DateTime.fromISO(response.lastUpdate).setZone(AIRPORT_TZ) : null;

		if (this.flights.length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}

		this.pages = [];
		const pageCount = Math.ceil(this.flights.length / ROWS_PER_PAGE);
		const perPage = Math.ceil(this.flights.length / pageCount);
		for (let i = 0; i < this.flights.length; i += perPage) this.pages.push(this.flights.slice(i, i + perPage));
		this.timing.totalScreens = this.pages.length;

		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		this.elem.querySelector('.header .title.dual .top').textContent = placeTitle('Departures');

		const pageIndex = Math.min(Math.max(this.screenIndex, 0), this.pages.length - 1);

		const lines = this.pages[pageIndex].map((flight) => {
			const time = DateTime.fromISO(flight.estimated).setZone(AIRPORT_TZ);
			const row = this.fillTemplate('departures-row', {
				// as on the Gates page: LH1175, without the space
				flight: flight.number.replaceAll(' ', ''),
				time: ConversionHelpers.formatTime(time),
				status: flight.status,
			});
			// tail icon per airline: images/airlines/<IATA code>.png (hidden if missing)
			const tail = row.querySelector('.tail');
			tail.addEventListener('error', () => { tail.style.visibility = 'hidden'; });
			tail.src = `images/airlines/${flight.number.slice(0, 2)}.png`;
			const statusClass = STATUS_CLASS[flight.status];
			if (statusClass) row.querySelector('.status').classList.add(statusClass);
			return row;
		});

		const list = this.elem.querySelector('.departures-lines');
		list.innerHTML = '';
		list.append(...lines);

		fillFooter(this.elem, [...(this.lastUpdate ? [`Updated ${ConversionHelpers.formatTime(this.lastUpdate)}`] : [])], pageIndex, this.pages.length);

		this.finishDraw();
	}
}

// register display (off by default: it only works on the Pi running skypaddock-hub)
registerDisplay(new Departures('departures', false));
