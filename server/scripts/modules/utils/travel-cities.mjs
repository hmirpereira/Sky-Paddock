// cities of the Travel Forecast screen. No accents: the Star4000 fonts cannot draw them.

// page 1: shown together, in this order
const TRAVEL_CITIES = [
	{ Name: 'Frankfurt', lat: 50.1109, lon: 8.6821 },
	{ Name: 'Munich', lat: 48.1351, lon: 11.5820 },
	{ Name: 'Zurich', lat: 47.3769, lon: 8.5417 },
	{ Name: 'Geneva', lat: 46.2044, lon: 6.1432 },
	{ Name: 'Vienna', lat: 48.2082, lon: 16.3738 },
];

// page 2: one of these, chosen in the settings. The number is what the setting stores, so never reuse or
// renumber one; none of the page 1 cities is in the list.
const DETAIL_CITIES = [
	[1, 'London', 'United Kingdom', 51.5072, -0.1276],
	[2, 'Paris', 'France', 48.8566, 2.3522],
	[3, 'Madrid', 'Spain', 40.4168, -3.7038],
	[4, 'Barcelona', 'Spain', 41.3874, 2.1686],
	[5, 'Lisbon', 'Portugal', 38.7223, -9.1393],
	[6, 'Rome', 'Italy', 41.9028, 12.4964],
	[7, 'Milan', 'Italy', 45.4642, 9.1900],
	[8, 'Berlin', 'Germany', 52.5200, 13.4050],
	[9, 'Amsterdam', 'Netherlands', 52.3676, 4.9041],
	[10, 'Brussels', 'Belgium', 50.8503, 4.3517],
	[11, 'Copenhagen', 'Denmark', 55.6761, 12.5683],
	[12, 'Stockholm', 'Sweden', 59.3293, 18.0686],
	[13, 'Oslo', 'Norway', 59.9139, 10.7522],
	[14, 'Helsinki', 'Finland', 60.1699, 24.9384],
	[15, 'Dublin', 'Ireland', 53.3498, -6.2603],
	[16, 'Prague', 'Czechia', 50.0755, 14.4378],
	[17, 'Warsaw', 'Poland', 52.2297, 21.0122],
	[18, 'Budapest', 'Hungary', 47.4979, 19.0402],
	[19, 'Athens', 'Greece', 37.9838, 23.7275],
	[20, 'Istanbul', 'Turkey', 41.0082, 28.9784],
	[21, 'Montreal', 'Canada', 45.5019, -73.5674],
	[22, 'Toronto', 'Canada', 43.6532, -79.3832],
	[23, 'Vancouver', 'Canada', 49.2827, -123.1207],
	[24, 'Ottawa', 'Canada', 45.4215, -75.6972],
	[25, 'Calgary', 'Canada', 51.0447, -114.0719],
	[26, 'Edmonton', 'Canada', 53.5461, -113.4938],
	[27, 'Winnipeg', 'Canada', 49.8951, -97.1384],
	[28, 'Quebec', 'Canada', 46.8139, -71.2080],
	[29, 'Halifax', 'Canada', 44.6488, -63.5752],
	[30, 'Victoria', 'Canada', 48.4284, -123.3656],
];

const DEFAULT_DETAIL_CITY = 21;

// the chosen city (the default when the number is not in the list)
const detailCity = (number) => {
	const found = DETAIL_CITIES.find(([n]) => n === Number(number)) ?? DETAIL_CITIES.find(([n]) => n === DEFAULT_DETAIL_CITY);
	const [, name, country, lat, lon] = found;
	return {
		name, country, lat, lon,
	};
};

// file of the 8-bit flag of a country, in images/flags (the name of the country in lower case with hyphens)
const flagFile = (country) => (country === 'United Kingdom' ? 'uk' : country.toLowerCase().replace(/\s+/g, '-'));

export {
	TRAVEL_CITIES, DETAIL_CITIES, DEFAULT_DETAIL_CITY, detailCity, flagFile,
};
