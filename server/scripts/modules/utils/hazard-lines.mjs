// IPMA weather warnings for the bottom line: the Hazards screen hands over its warnings here and the bottom line
// (currentweatherscroll.mjs) reads them. Pure functions and a small store, no DOM, so they can be tested.
import { plainText } from './text.mjs';

const LEVEL_NAMES = { yellow: 'AMARELO', orange: 'LARANJA', red: 'VERMELHO' };

const DAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

// the most severe warnings only: each one is a line of its own in the round
const MAX_LINES = 3;

// IPMA times are Portuguese local time without an offset ("2026-10-06T09:00:00")
const formatIpmaTime = (value) => {
	const [date, time] = value.split('T');
	const [y, m, d] = date.split('-').map(Number);
	const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
	return `${DAYS[weekday]} ${d} ${MONTHS[m - 1]} ${time.slice(0, 5)}`;
};

// current time in Portugal, in the same format as IPMA, so strings can be compared
const nowInPortugal = () => {
	const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
	}).formatToParts(new Date()).map((p) => [p.type, p.value]));
	return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}:${parts.second}`;
};

// one warning as a bottom line: a coloured label and the text ("Precipitacao, ate TER 10 NOV 16:45", or from-to
// when it has not started yet), without accents (the Star4000 fonts have none)
const hazardLine = (warning, now) => {
	const until = formatIpmaTime(warning.endTime);
	const period = warning.startTime > now ? `de ${formatIpmaTime(warning.startTime)} ate ${until}` : `ate ${until}`;
	return {
		alert: true,
		level: warning.awarenessLevelID,
		label: `AVISO ${LEVEL_NAMES[warning.awarenessLevelID]}`,
		text: plainText(`${warning.awarenessTypeName}, ${period}`),
	};
};

let lines = [];

// called by the Hazards screen after every download (an empty list clears the lines)
const setHazardWarnings = (warnings, now = nowInPortugal()) => {
	lines = (warnings ?? []).slice(0, MAX_LINES).map((warning) => hazardLine(warning, now));
};

const hazardLines = () => lines;

export {
	LEVEL_NAMES, formatIpmaTime, nowInPortugal, hazardLine, setHazardWarnings, hazardLines, MAX_LINES,
};
