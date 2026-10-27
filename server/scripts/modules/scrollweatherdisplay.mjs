// a screen whose rows scroll: the whole .main scrolls, so the background stripes move with the rows (README: Look and feel),
// while the column headers or the title stay at the top (position: sticky). The subclass puts its rows in and tells
// setScrollDistance how far there is to scroll; the time of the screen comes from that distance (utils/scroll-timing.mjs).
import WeatherDisplay from './weatherdisplay.mjs';
import { scrollSteps, scrollOffset } from './utils/scroll-timing.mjs';

class ScrollWeatherDisplay extends WeatherDisplay {
	constructor(elemId, name, defaultActive) {
		super(elemId, name, defaultActive);

		this.timing.baseDelay = 20;
		this.timing.delay = [scrollSteps(0)];
		this.scrollDistance = 0;
	}

	// distance in px (the height of the rows that does not fit in the box); the whole scroll is one screen
	setScrollDistance(distance) {
		this.scrollDistance = Math.max(0, distance);
		this.timing.delay = [scrollSteps(this.scrollDistance)];
		this.calcNavTiming();
	}

	// the rows are drawn in (hidden screens keep their layout, so they can be measured): what does not fit in the box
	measureScrollDistance() {
		const main = this.elem.querySelector('.main');
		return main.scrollHeight - main.clientHeight;
	}

	// screen index change callback just runs the base count callback
	screenIndexChange() {
		this.baseCountChange(this.navBaseCount);
	}

	// called on every step
	baseCountChange(count) {
		this.elem.querySelector('.main')?.scrollTo(0, scrollOffset(count, this.scrollDistance));
	}
}

export default ScrollWeatherDisplay;
