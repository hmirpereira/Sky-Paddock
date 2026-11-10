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

// the day of the Gates page: today while one of its flights has yet to leave; tomorrow once the last one has left, or when
// today has no gates. With no gates to show, a message instead: "Day off" or "No gates assigned".
// all: every gate of the day (day.allGates, mine or not) instead of mine only; a day off of mine is then no reason for a message
const gatesDay = (allDays, now, all = false) => {
	const days = all ? allDays.map((day) => ({ ...day, gates: day.allGates ?? day.gates })) : allDays;
	const today = days.find((day) => day.date === now.toISODate());
	// the last departure of today ("19:05"); gates with no flight times known stay the whole day
	const last = (today?.gates ?? []).flatMap((gate) => gate.flights ?? []).map((f) => f.etd ?? f.time ?? '').sort().at(-1);
	const left = !!last && DateTime.fromISO(`${today.date}T${last}`, { zone: LOCAL_TZ }) < now;
	if (today?.gates?.length && !left) return { day: today, tomorrow: false, message: '' };
	const day = days.find((d) => d.date === now.plus({ days: 1 }).toISODate());
	if (day?.gates?.length) return { day, tomorrow: true, message: '' };
	return { day, tomorrow: true, message: day?.off && !all ? 'Day off' : 'No gates assigned' };
};

export {
	LOCAL_TZ, shiftTimes, keepDays, stillShown, gatesDay,
};
