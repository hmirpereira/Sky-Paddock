// Reads the F1 and GT events for the racing gap (utils/racing-gap.mjs). Unknown data gives null for its series,
// and then there is no gap: a missing event must not hide a screen that has something to show.
import { DateTime } from '../../vendor/auto/luxon.mjs';
import { json } from './fetch.mjs';
import { f1Events } from './f1-weekend.mjs';
import isRacingGap, { gtEventSpan } from './racing-gap.mjs';

// the skypaddock-hub service on the Pi (gt.json), the same source as the GT screens
const GT_URL = 'http://127.0.0.1:8095/gt.json';
const EVENT_HOURS = 4;

// the next event (its sessions, or its dates while no session is dated yet) and the last one with results (its last day)
const gtEvents = async () => {
	const data = await json(GT_URL, { signal: AbortSignal.timeout(5000) }).catch(() => null);
	if (!data?.ok) return null;
	const starts = (data.next?.sessions ?? []).map((s) => DateTime.fromISO(s.start)).filter((d) => d.isValid).sort((a, b) => a - b);
	const events = [];
	const dated = gtEventSpan(data.next?.dates);
	if (starts.length) events.push({ start: starts[0], end: starts.at(-1).plus({ hours: EVENT_HOURS }) });
	else if (dated) events.push(dated);
	else return null;
	if (data.races?.length) {
		const end = gtEventSpan(data.dates)?.end;
		if (!end) return null;
		events.push({ start: end.minus({ days: 4 }), end });
	}
	return events;
};

// true when the F1 and GT screens should be skipped now
const racingGap = async (now = DateTime.now()) => {
	const [f1, gt] = await Promise.all([f1Events(), gtEvents()]);
	if (!f1 || !gt) return false;
	return isRacingGap([...f1, ...gt], now);
};

// the GT screens follow the GT calendar alone: an F1 race within 21 days does not bring them back
export const gtRacingGap = async (now = DateTime.now()) => {
	const gt = await gtEvents();
	return !!gt && isRacingGap(gt, now);
};

export default racingGap;
