// Portuguese news headlines for the News screen and the bottom line, from the skypaddock-hub service
// on the Pi (RSS feeds of RTP, Observador, Publico and CNN Portugal, and FlyingLapF1 for Formula 1,
// read there because the browser cannot read them from another site). Anywhere else the list is empty.
const NEWS_URL = 'http://127.0.0.1:8095/news.json';
const CHECK_EVERY_MS = 5 * 60 * 1000;

let data = { items: [], f1: [], sources: [] };
let lastCheck = 0;
let pending = null;

const load = async () => {
	lastCheck = Date.now();
	try {
		const response = await fetch(NEWS_URL, { signal: AbortSignal.timeout(4000), cache: 'no-store' });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const json = await response.json();
		data = {
			items: Array.isArray(json?.items) ? json.items : [], f1: Array.isArray(json?.f1) ? json.f1 : [], sources: json?.sources ?? [], ok: json?.ok,
		};
	} catch {
		// not on the Pi, or the service is down
		data = { items: [], f1: [], sources: [] };
	}
	pending = null;
	return data;
};

// latest list, fetched again in the background at most every 5 minutes
export const newsNow = () => {
	if (Date.now() - lastCheck > CHECK_EVERY_MS && !pending) pending = load();
	return data;
};

// fresh list (waits for the request), for the News screen
export const newsFresh = async () => {
	if (pending) return pending;
	if (Date.now() - lastCheck <= 60 * 1000) return data;
	pending = load();
	return pending;
};

// the Star4000 fonts draw accented letters blank, so accents are removed (ç -> c, ã -> a)
export const plainText = (text) => (text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
	.replace(/[‘’´]/g, "'").replace(/[“”«»]/g, '"')
	.replace(/[–—]/g, '-');

// logo of each source (images/news, from the owner's files), on a plate so it shows on the blue
// background: light for the dark or red logos, dark for the white one, none for Observador's own black box
const LOGOS = {
	RTP: { file: 'rtp.svg', plate: 'light' },
	Observador: { file: 'observador.png', plate: 'none' },
	Publico: { file: 'publico.svg', plate: 'light' },
	'CNN Portugal': { file: 'cnn.svg', plate: 'light' },
	FlyingLapF1: { file: 'flyinglapf1.png', plate: 'dark' },
};

// the logo of a source as an element, or its name when there is no logo
export const sourceLogo = (source) => {
	const logo = LOGOS[source];
	const box = document.createElement('span');
	if (!logo) {
		box.className = 'source-name';
		box.textContent = plainText(source);
		return box;
	}
	box.className = `source-logo plate-${logo.plate}`;
	const img = document.createElement('img');
	img.src = `images/news/${logo.file}`;
	img.alt = plainText(source);
	box.append(img);
	return box;
};
