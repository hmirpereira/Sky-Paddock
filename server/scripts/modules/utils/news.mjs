// Portuguese news headlines for the News screen and the bottom line, from the skypaddock-hub service
// on the Pi (RSS feeds of RTP, Observador, Publico and CNN Portugal, read there because the browser
// cannot read them from another site). Anywhere else the list is empty.
const NEWS_URL = 'http://127.0.0.1:8095/news.json';
const CHECK_EVERY_MS = 5 * 60 * 1000;

let data = { items: [], sources: [] };
let lastCheck = 0;
let pending = null;

const load = async () => {
	lastCheck = Date.now();
	try {
		const response = await fetch(NEWS_URL, { signal: AbortSignal.timeout(4000), cache: 'no-store' });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const json = await response.json();
		data = { items: Array.isArray(json?.items) ? json.items : [], sources: json?.sources ?? [], ok: json?.ok };
	} catch {
		// not on the Pi, or the service is down
		data = { items: [], sources: [] };
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
