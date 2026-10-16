// heartbeat for the kiosk watchdog on the Raspberry Pi: each time the rotation moves to another
// screen, tell the skypaddock-voos service (at most once a minute). If the page goes blank,
// freezes or never loads, the beats stop and skypaddock-kiosk restarts the browser.
// Only in kiosk mode, so a browser elsewhere never knocks on its own 127.0.0.1.
// eslint-disable-next-line import/no-cycle
import settings from '../settings.mjs';

const BEAT_URL = 'http://127.0.0.1:8095/beat';
const MIN_GAP_MS = 60 * 1000;

let last = 0;

const piHeartbeat = (screen) => {
	if (!settings.kiosk?.value) return;
	if (Date.now() - last < MIN_GAP_MS) return;
	last = Date.now();
	fetch(`${BEAT_URL}?screen=${encodeURIComponent(screen ?? '')}`, { signal: AbortSignal.timeout(3000), cache: 'no-store' }).catch(() => {});
};

export default piHeartbeat;
