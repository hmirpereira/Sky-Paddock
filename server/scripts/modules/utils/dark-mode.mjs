// Dark Mode setting values and the rule of the automatic one

const OFF = 1;
const ON = 2;
const AUTOMATIC = 3;

// the automatic mode turns dark this long after the sunset and normal this long after the sunrise
const DELAY_MINUTES = 10;

// should the screens be dark at `now`? `times` has the sunrise and sunset of the same day (SunCalc.getTimes of that day).
// Dark from 10 minutes after the sunset until 10 minutes after the next sunrise; with no sunrise or sunset that day
// (polar day or night), the normal screens.
const isDark = (mode, now, times) => {
	if (Number(mode) === ON) return true;
	if (Number(mode) !== AUTOMATIC) return false;
	const sunrise = times?.sunrise?.getTime();
	const sunset = times?.sunset?.getTime();
	if (!Number.isFinite(sunrise) || !Number.isFinite(sunset)) return false;
	const delay = DELAY_MINUTES * 60 * 1000;
	return now.getTime() >= sunset + delay || now.getTime() < sunrise + delay;
};

export {
	OFF, ON, AUTOMATIC, isDark,
};
