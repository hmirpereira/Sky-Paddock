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

// the day of the Gates page: today while one of its flights has yet to leave; otherwise the next day with gates, however far
// ahead (within the days given). With no gates to show, a message instead: "Day off" (the next day, when it is off) or "No gates assigned".
// later: the day is not today. all: every gate of the day (day.allGates, mine or not) instead of mine only
const gatesDay = (allDays, now, all = false) => {
	const days = all ? allDays.map((day) => ({ ...day, gates: day.allGates ?? day.gates })) : allDays;
	const today = days.find((day) => day.date === now.toISODate());
	// the last departure of today ("19:05"); gates with no flight times known stay the whole day
	const last = (today?.gates ?? []).flatMap((gate) => gate.flights ?? []).map((f) => f.etd ?? f.time ?? '').sort().at(-1);
	const left = !!last && DateTime.fromISO(`${today.date}T${last}`, { zone: LOCAL_TZ }) < now;
	if (today?.gates?.length && !left) return { day: today, later: false, message: '' };
	const ahead = days.filter((d) => d.date > now.toISODate() && d.gates?.length);
	if (ahead.length) return { day: ahead[0], later: true, message: '' };
	const next = days.find((d) => d.date === now.plus({ days: 1 }).toISODate());
	return { day: next, later: true, message: next?.off && !all ? 'Day off' : 'No gates assigned' };
};

// the flights of a day that have not left yet: a flight drops out of the Gates page once its departure (etd, or the time of the
// team file) has passed; one with no time known stays
const flightsToCome = (flights, date, now) => flights.filter((f) => {
	const time = f.etd ?? f.time;
	return !time || DateTime.fromISO(`${date}T${time}`, { zone: LOCAL_TZ }) >= now;
});

// the day of the Gates page for its title: "Today", "Tomorrow", or the date from two days on ("Fri 20/11")
const gatesLabel = (date, now) => {
	const ahead = Math.round(DateTime.fromISO(date, { zone: LOCAL_TZ }).startOf('day').diff(now.startOf('day'), 'days').days);
	if (ahead === 0) return 'Today';
	if (ahead === 1) return 'Tomorrow';
	return DateTime.fromISO(date, { zone: LOCAL_TZ }).toFormat('ccc dd/LL');
};

export {
	LOCAL_TZ, shiftTimes, keepDays, stillShown, gatesDay, flightsToCome, gatesLabel,
};
