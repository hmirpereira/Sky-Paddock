// work shifts: page 1 lists the next 7 days with the weather at the start of each shift,
// page 2 shows the next shift with a countdown and the weather at the start and at the end,
// page 3, Gates: the flights of my gates today (tomorrow once the last one has left; of every gate with the setting Personal Gates
// off), each with the staff on the gate, the stand and
// the ETA of the aircraft that does the rotation, and the supervisors of the day in one line under them.
// Shifts are read from the skypaddock-hub service on the Raspberry Pi, which serves what
// skypaddock-horario extracts from a private schedule spreadsheet. The schedule never leaves the Pi;
// anywhere else this screen is skipped. Weather: Open-Meteo hourly forecast for the chosen location.
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import ConversionHelpers from './utils/conversionHelpers.mjs';
import { getConditionText } from './utils/weather.mjs';
import { getWeatherRegionalIconFromIconLink } from './icons.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import settings from './settings.mjs';
import { ON, OFF } from './utils/dark-mode.mjs';
import {
	LOCAL_TZ, shiftTimes, keepDays, stillShown, gatesDay,
} from './utils/shifts.mjs';

const SERVICE_URL = 'http://127.0.0.1:8095/schedule.json';

// the (R) schedule of a day, to show in small under the main one (the Pi adds it as day.r; nothing without it)
const rSchedule = (day) => {
	if (!day.r) return {};
	const times = shiftTimes({ ...day.r, date: day.date });
	return {
		'r-shift': day.r.off ? 'Day off' : day.r.code,
		'r-start': times ? ConversionHelpers.formatTime(times.start) : '',
		'r-end': times ? ConversionHelpers.formatTime(times.end) : '',
	};
};

// hourly forecast at the location, 8 days, keyed by local hour ("2026-10-09T03:00");
// kept for an hour, so the 10-minute data refresh does not ask Open-Meteo again each time
const FORECAST_CACHE_MINUTES = 60;
let forecastCache = null;
const getForecast = async (weatherParameters) => {
	const key = `${weatherParameters.latitude},${weatherParameters.longitude}`;
	if (forecastCache?.key === key && DateTime.now().diff(forecastCache.fetched, 'minutes').minutes < FORECAST_CACHE_MINUTES) {
		return forecastCache.data;
	}
	try {
		const data = await json(`https://api.open-meteo.com/v1/forecast?latitude=${weatherParameters.latitude}&longitude=${weatherParameters.longitude}&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m,is_day&timezone=${encodeURIComponent(LOCAL_TZ)}&forecast_days=8`);
		// Open-Meteo answers errors (e.g. daily limit) with a 200 and { error, reason }
		if (!data?.hourly?.time) throw new Error(data?.reason ?? 'no hourly data');
		const byHour = {};
		(data?.hourly?.time ?? []).forEach((time, i) => {
			byHour[time] = {
				code: data.hourly.weather_code[i],
				temperature: data.hourly.temperature_2m[i],
				rain: data.hourly.precipitation_probability[i],
				wind: data.hourly.wind_speed_10m[i],
				isDay: data.hourly.is_day[i],
			};
		});
		forecastCache = { key, fetched: DateTime.now(), data: byHour };
		return byHour;
	} catch (error) {
		console.warn('WorkSchedule: no forecast', error.message);
		// keep using an older forecast rather than none
		return forecastCache?.data ?? {};
	}
};

// forecast for the hour that contains a time (03:30 uses 03:00)
const weatherAt = (forecast, time) => {
	const hour = forecast[time.startOf('hour').toFormat("yyyy-MM-dd'T'HH:mm")];
	if (!hour) return null;
	const condition = getConditionText(Number(hour.code));
	return {
		condition,
		icon: getWeatherRegionalIconFromIconLink(condition, hour.isDay),
		temperature: Math.round(ConversionHelpers.convertTemperatureUnits(hour.temperature)),
		rain: hour.rain ?? 0,
		wind: Math.round(ConversionHelpers.convertWindUnits(hour.wind)),
	};
};

const countdown = (from, to) => {
	const minutes = Math.max(0, Math.round(to.diff(from, 'minutes').minutes));
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h >= 48) return `${Math.round(h / 24)} days`;
	return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
};

// "SUELI B" -> "Sueli B" (the team file is in capitals)
const niceName = (name) => name.toLowerCase().replace(/(^|[ .])([a-z])/g, (m, sep, letter) => sep + letter.toUpperCase());

class WorkSchedule extends WeatherDisplay {
	constructor(elemId, defaultActive) {
		super(elemId, 'Work Schedule', defaultActive);

		// three pages, 12 seconds each (the Gates page 5 seconds when it only has a message)
		this.timing.baseDelay = 1000;
		this.timing.delay = [12, 12, 12];
	}

	async getData(weatherParameters) {
		if (!super.getData(weatherParameters)) return;

		let response;
		try {
			response = await json(SERVICE_URL, { signal: AbortSignal.timeout(5000) });
		} catch (error) {
			// not on the Pi, or the service is down: skip the screen quietly
			console.warn('WorkSchedule: schedule service not reachable', error.message);
			this.setStatus(STATUS.noData);
			return;
		}

		// from yesterday on, for a night shift still going on (the file on the Pi is refreshed every hour)
		this.days = keepDays(response.days ?? [], DateTime.now().setZone(LOCAL_TZ)).slice(0, 9);
		if (this.days.length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.forecast = await getForecast(this.weatherParameters ?? weatherParameters);

		// the Gates page (the Pi adds day.gates: [{ dests: ['MUC'], with: ['ANA M'], flights: [...] }]): which day it shows is
		// decided here, with each refresh of the data, so that the time of the page matches what it shows
		this.pickGates();
		this.timing.delay = [12, 12, this.gates.message ? 5 : 12];
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	// my gates, or those of everybody with the setting Personal Gates off (the Pi adds them as day.allGates)
	pickGates() {
		this.allGates = Number(settings.personalGates?.value) === OFF;
		this.gates = gatesDay(this.days, DateTime.now().setZone(LOCAL_TZ), this.allGates);
	}

	async drawCanvas() {
		super.drawCanvas();
		// the setting was changed since the data came
		if (this.allGates !== (Number(settings.personalGates?.value) === OFF)) this.pickGates();
		const page = Math.min(Math.max(this.screenIndex, 0), this.timing.totalScreens - 1);
		this.elem.querySelector('.schedule-page.week').style.display = page === 0 ? 'block' : 'none';
		this.elem.querySelector('.schedule-page.next').style.display = page === 1 ? 'block' : 'none';
		this.elem.querySelector('.schedule-page.assignments').style.display = page === 2 ? 'block' : 'none';
		this.elem.querySelector('.header .title.dual .bottom').innerHTML = ['Next 7 Days', 'Next Shift', `${this.allGates ? 'All ' : ''}Gates${this.gates.tomorrow ? ' Tomorrow' : ''}`][page];
		if (page === 0) this.drawWeek(); else if (page === 1) this.drawNext(); else this.drawAssignments();
		this.finishDraw();
	}

	drawWeek() {
		const now = DateTime.now().setZone(LOCAL_TZ);
		const today = now.toISODate();
		// today's shift leaves the list once it has ended; yesterday's night shift stays while it lasts
		const days = this.days.filter((day) => stillShown(day, now)).slice(0, 7);
		// the (R) schedule under each day only when the setting Personal Schedule is On
		const showR = Number(settings.personalSchedule?.value) === ON;
		const lines = days.map((day) => {
			const date = DateTime.fromISO(day.date, { zone: LOCAL_TZ });
			const times = shiftTimes(day);
			const row = this.fillTemplate('schedule-row', {
				day: `${date.toFormat('ccc')} ${date.day}`,
				shift: day.off ? 'Day off' : day.code,
				start: times ? ConversionHelpers.formatTime(times.start) : '',
				end: times ? ConversionHelpers.formatTime(times.end) : '',
				temp: '',
				...(showR ? rSchedule(day) : {}),
			});
			// weather at the start of the shift: icon and temperature (hidden on days off or beyond the forecast)
			const weather = times ? weatherAt(this.forecast, times.start) : null;
			const icon = row.querySelector('.wx img');
			if (weather) {
				icon.src = weather.icon;
				row.querySelector('.temp').textContent = `${weather.temperature}°`;
			} else {
				icon.style.visibility = 'hidden';
			}
			if (day.off) row.classList.add('off');
			if (day.date === today) row.classList.add('today');
			return row;
		});
		const list = this.elem.querySelector('.schedule-lines');
		list.innerHTML = '';
		list.append(...lines);
		// with the (R) schedule the rows are laid out for a second, small line under each value
		list.classList.toggle('has-r', showR && days.some((day) => day.r));
	}

	// the gates of the day: flight, staff, stand and ETA of the aircraft that arrives for the rotation; the supervisors under them
	drawAssignments() {
		const { day, tomorrow, message } = this.gates;
		// with no gates, only a message in the middle ("Day off", "No gates assigned")
		const box = this.elem.querySelector('.schedule-page.assignments');
		box.classList.toggle('message', !!message);
		box.querySelector('.assign-message').textContent = message;
		// one row per flight, in the order of the departures (etd, or the time of the team file: "06:40"); a gate with no known
		// flights shows its destination
		const flights = (day?.gates ?? [])
			.flatMap((gate) => (gate.flights?.length ? gate.flights : [{ number: gate.dests.join('/') }]).map((f) => ({ ...f, crew: gate.with, star: gate.star })))
			.sort((x, y) => (x.etd ?? x.time ?? '').localeCompare(y.etd ?? y.time ?? ''));
		const gates = flights.map((f) => {
			const block = this.fillTemplate('assign-gate', {});
			const div = (parent, text) => {
				const elem = document.createElement('div');
				elem.textContent = text;
				block.querySelector(parent).append(elem);
				return elem;
			};
			const row = div('.flights', '');
			// airline tail icon to the left of the flight number: images/airlines/<IATA code>.png (none when there is no picture)
			if (/^[A-Z0-9]{2}\d/.test(f.number)) {
				const tail = document.createElement('img');
				tail.alt = '';
				tail.addEventListener('error', () => { tail.style.visibility = 'hidden'; });
				tail.src = `images/airlines/${f.number.slice(0, 2)}.png`;
				row.append(tail);
			}
			// the number with the departure time in small under it
			const number = document.createElement('div');
			number.className = 'number';
			number.textContent = f.number;
			const etd = document.createElement('div');
			etd.className = 'etd';
			etd.textContent = f.etd ?? f.time ?? '';
			number.append(etd);
			row.append(number);
			// the staff as the Pi gives it (me included), one name under the other
			f.crew.forEach((name) => div('.crew', niceName(name)));
			// a star to the right of the names of a gate that the Pi marks (who makes a starred team is set on the Pi, not here)
			if (f.star) {
				const star = document.createElement('img');
				star.className = 'star';
				star.alt = '';
				star.src = 'images/star-icon.svg';
				block.querySelector('.crew').append(star);
			}
			// the Pi adds the stand and the ETA of the arriving aircraft to the flight ("S32", "05:55"); empty until they are known
			div('.stands', f.stand ?? '');
			const eta = div('.etas', f.eta ?? '');
			// minutes to the arrival in small under the ETA ("T-45m"), as of the moment the page is drawn; nothing once it has passed.
			// Under 20 minutes it is yellow and blinks slowly, under 10 red and faster
			const at = DateTime.fromISO(`${day.date}T${f.eta}`, { zone: LOCAL_TZ });
			const mins = Math.ceil(at.diffNow('minutes').minutes);
			if (!tomorrow && at.isValid && mins >= 0) {
				const left = document.createElement('div');
				left.className = 'left';
				if (mins < 20) left.classList.add(mins < 10 ? 'now' : 'soon');
				left.textContent = `T-${mins}m`;
				eta.append(left);
			}
			return block;
		});
		const list = this.elem.querySelector('.assign-lines');
		list.replaceChildren(...gates);
		// smaller rows only when the flights do not fit (more than 4, or 4 with many names)
		list.classList.remove('compact');
		list.classList.toggle('compact', list.scrollHeight > list.clientHeight);
		// the supervisors of the day in order (morning, afternoon, night), one line: "SPV: Tiago / Cristiano / Angela"
		const names = ['morning', 'afternoon', 'night'].flatMap((part) => day?.supervisors?.[part] ?? []).map(niceName);
		const label = document.createElement('span');
		label.textContent = 'SPV: ';
		const supv = this.elem.querySelector('.supv');
		supv.replaceChildren(label, names.join(' / '));
		supv.style.visibility = names.length && !message ? 'visible' : 'hidden';
	}

	drawNext() {
		const now = DateTime.now().setZone(LOCAL_TZ);
		// the shift going on now, or the next one
		const shifts = this.days.map((day) => ({ day, times: shiftTimes(day) })).filter((s) => s.times && s.times.end > now);
		const box = this.elem.querySelector('.schedule-page.next');
		if (shifts.length === 0) {
			box.querySelector('.when').textContent = 'No shifts in the next 7 days';
			box.querySelectorAll('.hours, .countdown, .weather-pair').forEach((e) => { e.style.visibility = 'hidden'; });
			return;
		}
		box.querySelectorAll('.hours, .countdown, .weather-pair').forEach((e) => { e.style.visibility = 'visible'; });
		const { day, times } = shifts[0];
		const onShift = times.start <= now;
		box.querySelector('.when').textContent = `${times.start.toFormat('cccc d LLLL')}   ${day.code}`;
		box.querySelector('.hours').textContent = `${ConversionHelpers.formatTime(times.start)} to ${ConversionHelpers.formatTime(times.end)}`;
		box.querySelector('.countdown').textContent = onShift ? `On shift, ends in ${countdown(now, times.end)}` : `Starts in ${countdown(now, times.start)}`;

		[['start', times.start, 'Start'], ['end', times.end, 'End']].forEach(([cls, time, label]) => {
			const elem = box.querySelector(`.weather-pair .${cls}`);
			const weather = weatherAt(this.forecast, time);
			elem.querySelector('.label').textContent = `${label} ${ConversionHelpers.formatTime(time)}`;
			if (!weather) {
				elem.querySelector('.icon img').style.visibility = 'hidden';
				elem.querySelector('.cond').textContent = 'No forecast yet';
				elem.querySelector('.details').textContent = '';
				return;
			}
			elem.querySelector('.icon img').style.visibility = 'visible';
			elem.querySelector('.icon img').src = weather.icon;
			elem.querySelector('.cond').textContent = weather.condition;
			elem.querySelector('.details').textContent = `${weather.temperature}°${ConversionHelpers.getTemperatureUnitText()}  Rain ${weather.rain}%  Wind ${weather.wind} ${ConversionHelpers.getWindUnitText()}`;
		});
	}
}

// register display (off by default: it only works on the Pi running skypaddock-hub and skypaddock-horario)
registerDisplay(new WorkSchedule('work-schedule', false));
