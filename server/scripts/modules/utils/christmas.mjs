// Christmas effects (the string of lights): Off, On, or Automatic from 1 to 25 December, the days of the [Christmas] songs
import { ON, AUTOMATIC } from './dark-mode.mjs';

const isChristmas = (mode, now) => {
	if (Number(mode) === ON) return true;
	return Number(mode) === AUTOMATIC && now.getMonth() === 11 && now.getDate() <= 25;
};

export default isChristmas;
