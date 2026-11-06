// The racing gap: no F1 or GT event starts in the next 21 days and the last one ended more than 72 hours ago.
// Then the F1 and GT screens are skipped. Only the rule is here (no page code), so it can be tested on its own;
// the events are read in racing-gap-events.mjs.
import { DateTime } from '../../vendor/auto/luxon.mjs';

const AHEAD_DAYS = 21;
const SINCE_HOURS = 72;

// events: [{ start, end }] as luxon DateTimes; null when they are not known, and then there is no gap
const isRacingGap = (events, now) => {
	if (!events) return false;
	if (events.some((e) => e.start <= now && now < e.end)) return false;
	if (events.some((e) => e.start > now && e.start <= now.plus({ days: AHEAD_DAYS }))) return false;
	const ended = events.map((e) => e.end).filter((end) => end <= now);
	if (!ended.length) return false;
	const last = ended.reduce((a, b) => (a > b ? a : b));
	return last < now.minus({ hours: SINCE_HOURS });
};

// the first and last day of a GT event from its dates: '15 - 18 April 2027' or '30 July 2026 - 2 August 2026'
// (a next event may have its dates before its sessions), or null
const FIRST = /(\d{1,2})(?: - \d{1,2})? ([A-Za-z]+) (\d{4})/;
const DAYS = /(\d{1,2}) ([A-Za-z]+) (\d{4})/g;
const gtEventSpan = (dates) => {
	const first = (dates ?? '').match(FIRST);
	const last = [...(dates ?? '').matchAll(DAYS)].at(-1);
	if (!first || !last) return null;
	const day = (m) => DateTime.fromFormat(`${m[1]} ${m[2]} ${m[3]}`, 'd LLLL yyyy', { zone: 'Europe/Lisbon' });
	const start = day(first).startOf('day');
	const end = day(last).endOf('day');
	return start.isValid && end.isValid ? { start, end } : null;
};

export { gtEventSpan };
export default isRacingGap;
