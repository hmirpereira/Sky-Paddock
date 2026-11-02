// Reads the F1 and GT events for the racing gap (utils/racing-gap.mjs). Unknown data gives null for its series,
// and then there is no gap: a missing event must not hide a screen that has something to show.
import { DateTime } from '../../vendor/auto/luxon.mjs';
import { json } from './fetch.mjs';
import { f1Events } from './f1-weekend.mjs';
import isRacingGap from './racing-gap.mjs';

// the skypaddock-hub service on the Pi (gt.json), the same source as the GT screens
const GT_URL = 'http://127.0.0.1:8095/gt.json';
const LOCAL_TZ = 'Europe/Lisbon';
const EVENT_HOURS = 4;

// the last day of a GT event: '30 July 2026 - 2 August 2026' or '14 - 18 October 2026'
const gtLastDay = (dates) => {
	const [day, month, year] = [...(dates ?? '').matchAll(/(\d{1,2}) ([A-Za-z]+) (\d{4})/g)].at(-1)?.slice(1) ?? [];
	const end = DateTime.fromFormat(`${day} ${month} ${year}`, 'd LLLL yyyy', { zone: LOCAL_TZ });
	return end.isValid ? end.endOf('day') : null;
};

// the next event (its sessions) and the last one with results (its last day)
const gtEvents = async () => {
	const data = await json(GT_URL, { signal: AbortSignal.timeout(5000) }).catch(() => null);
	if (!data?.ok) return null;
	const starts = (data.next?.sessions ?? []).map((s) => DateTime.fromISO(s.start)).filter((d) => d.isValid).sort((a, b) => a - b);
	if (!starts.length) return null;
	const events = [{ start: starts[0], end: starts.at(-1).plus({ hours: EVENT_HOURS }) }];
	if (data.races?.length) {
		const end = gtLastDay(data.dates);
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

export default racingGap;
