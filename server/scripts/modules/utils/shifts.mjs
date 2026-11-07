// shift times and which days of the Work Schedule are still worth showing (no page needed, so they can be tested in Node)
import { DateTime } from '../../vendor/auto/luxon.mjs';

const LOCAL_TZ = 'Europe/Lisbon';

// a shift as start and end times (a shift that ends after midnight ends on the next day)
const shiftTimes = (day) => {
	if (day.off || !day.start || !day.end) return null;
	const start = DateTime.fromISO(`${day.date}T${day.start}`, { zone: LOCAL_TZ });
	let end = DateTime.fromISO(`${day.date}T${day.end}`, { zone: LOCAL_TZ });
	if (end <= start) end = end.plus({ days: 1 });
	return { start, end };
};

// the days to keep from the Pi: from yesterday on, because a night shift that began yesterday may still be going on
const keepDays = (days, now) => {
	const yesterday = now.minus({ days: 1 }).toISODate();
	return days.filter((day) => day.date >= yesterday);
};

// is the day still worth showing: a day before today only while its shift lasts, today until its shift has ended
const stillShown = (day, now) => {
	const times = shiftTimes(day);
	const today = now.toISODate();
	if (day.date < today) return !!times && times.end > now;
	if (day.date === today) return !(times && times.end <= now);
	return true;
};

export {
	LOCAL_TZ, shiftTimes, keepDays, stillShown,
};
