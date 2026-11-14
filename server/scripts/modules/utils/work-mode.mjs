// work mode (for a break room): only the aviation screens that make sense there, and of the Work Schedule only the Gates page, of everybody's gates
import settings from '../settings.mjs';

const WORK_SCREENS = ['work-schedule', 'departures', 'cancellations', 'overhead', 'metar'];

const workMode = () => !!settings.workMode?.value;

export { WORK_SCREENS, workMode };
