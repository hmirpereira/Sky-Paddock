// Reads the F1 events for the racing gap (utils/racing-gap.mjs). Unknown data gives null, and then there is no gap:
// a missing event must not hide a screen that has something to show.
import { DateTime } from 'luxon';
import { f1Events } from './f1-weekend.mjs';
import isRacingGap from './racing-gap.mjs';

// true when the F1 screens should be skipped now
const racingGap = async (now = DateTime.now()) => {
	const f1 = await f1Events();
	if (!f1) return false;
	return isRacingGap(f1, now);
};

export default racingGap;
