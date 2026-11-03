// the local airport and IPMA area come from the settings (set in the Pi's address), so no place
// is written in the code; without them the Airport METAR and Hazards screens are skipped.
// The city of the airport comes from its ICAO code: the Pi service looks it up (OurAirports); anywhere else it stays empty
import settings from '../settings.mjs';
import { ipmaArea } from './ipma-areas.mjs';
import { plainText } from './text.mjs';

const CITY_URL = 'http://127.0.0.1:8095/airport.json';
// "City Departures" must fit in one line before the clock: a longer title is just "Departures"
const TITLE_MAX = 17;
const cities = {};

const airport = () => {
	const icao = String(settings.airportIcao?.value ?? '').trim().toUpperCase();
	return { icao: /^[A-Z0-9]{4}$/.test(icao) ? icao : '' };
};

// asks the Pi service for the city of the local airport (once per code; an answer that fails is asked again next time)
const loadAirportCity = async () => {
	const { icao } = airport();
	if (!icao || icao in cities) return;
	try {
		const response = await fetch(`${CITY_URL}?icao=${icao}`, { signal: AbortSignal.timeout(3000) });
		if (response.ok) cities[icao] = plainText(String((await response.json()).city ?? '').slice(0, 40)).trim();
	} catch (error) {
		console.warn('Airport city: not available', error.message);
	}
};

// screen titles: "Porto Airport", "Porto Departures"; just "Airport" / "Departures" without a city, or when the city does not fit
const placeTitle = (word) => {
	const title = [cities[airport().icao], word].filter(Boolean).join(' ');
	return title.length <= TITLE_MAX ? title : word;
};

const warningArea = () => ipmaArea(settings.ipmaArea?.value);

export {
	airport, loadAirportCity, placeTitle, warningArea,
};
