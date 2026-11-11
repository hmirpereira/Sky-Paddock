// Content-Security-Policy of the site. GitHub Pages sends no headers, so it goes into the page as a <meta> tag
// (vite.config.mjs adds it when building; the dev server does not use it).
//
// The page only talks to the hosts below. A new host the page needs (a fetch, a map tile, a picture) must be added
// here, otherwise the browser refuses it: tests/unit/csp.test.mjs fails for a host in the scripts that is not listed,
// and the smoke test fails on any violation.
//
// What a <meta> policy cannot do: frame-ancestors, report-uri and sandbox only work as headers.

// the data service of the Raspberry Pi (skypaddock-hub), read by the page running on the same Pi
export const HUB = 'http://127.0.0.1:8095';

// hosts the page fetches data from (fetch)
export const CONNECT_HOSTS = [
	'https://geocode.arcgis.com',
	'https://api.jolpi.ca',
	'https://api.openf1.org',
	'https://api.ipma.pt',
	'https://metar.vatsim.net',
	'https://api.open-meteo.com',
	'https://air-quality-api.open-meteo.com',
	'https://geocoding-api.open-meteo.com',
	'https://api.librewxr.net',
];

// hosts used only for pictures (map tiles): img-src allows https: anyway, they are listed so the unit test knows them
export const IMAGE_ONLY_HOSTS = [
	'https://tile.openstreetmap.org',
	'https://server.arcgisonline.com',
];

export const directives = {
	'default-src': ["'none'"],
	// no inline script and no eval: everything is in the bundle served from the site itself
	'script-src': ["'self'"],
	// the screens set styles on elements and build markup with style="..." (positions, colours), so inline styles stay
	'style-src': ["'self'", "'unsafe-inline'"],
	// news pictures come from the news sites' CDNs (any https host); posters and photos from the Pi service
	'img-src': ["'self'", 'data:', 'blob:', 'https:', HUB],
	'font-src': ["'self'", 'data:'],
	'connect-src': ["'self'", HUB, ...CONNECT_HOSTS],
	// NoSleep keeps the screen on with a tiny video made of data
	'media-src': ['data:', 'blob:'],
	'manifest-src': ["'self'"],
	'object-src': ["'none'"],
	'base-uri': ["'self'"],
	'form-action': ["'self'"],
};

export const buildPolicy = () => Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');
