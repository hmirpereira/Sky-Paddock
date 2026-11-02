// Debug: the track playing on the Pi (skypaddock-hub /musica.json), shown under the version mark. Polled every 15 s
// while the setting is on; anywhere but the Pi the request fails and the line stays empty.
import { json } from './fetch.mjs';
import { plainText } from './text.mjs';

const MUSIC_URL = 'http://127.0.0.1:8095/musica.json';
const EVERY_MS = 15000;
let timer = null;

const show = async () => {
	const track = await json(MUSIC_URL, { signal: AbortSignal.timeout(3000) }).then((d) => d.track, () => '');
	const element = document.querySelector('#version-mark .music');
	if (element) element.textContent = plainText(track ?? '');
};

const setMusicName = (value) => {
	document.body.classList.toggle('music-name', !!value);
	clearInterval(timer);
	timer = null;
	if (value) {
		show();
		timer = setInterval(show, EVERY_MS);
	}
};

export default setMusicName;
