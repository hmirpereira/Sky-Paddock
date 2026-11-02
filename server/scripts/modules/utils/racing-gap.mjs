// The racing gap: no F1 or GT event starts in the next 21 days and the last one ended more than 72 hours ago.
// Then the F1 and GT screens are skipped. Only the rule is here (no page code), so it can be tested on its own;
// the events are read in racing-gap-events.mjs.
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

export default isRacingGap;
