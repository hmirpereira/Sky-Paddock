// regional forecast and observations
import { loadImg } from './utils/image.mjs';
import STATUS, { calcStatusClass, statusClasses } from './status.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import {
	registerProgress, message, getDisplay, msg, DISPLAY_GROUPS,
} from './navigation.mjs';

// up to this many lines the list is one column, as in the original; more than that, the screens go
// into two columns by group (Weather, Aviation, ...), each group with its title
const ONE_COLUMN_MAX = 11;
const BOX_HEIGHT = 296;

class Progress extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, '', false);

		// pre-load background image (returns promise)
		this.backgroundImage = loadImg('images/BackGround1_1.png');

		// disable any navigation timing
		this.timing = false;

		// setup event listener for dom-required initialization
		document.addEventListener('DOMContentLoaded', () => {
			this.version = document.querySelector('#version').innerHTML;
			this.elem.querySelector('.container').addEventListener('click', this.lineClick.bind(this));
		});

		this.okToDrawCurrentConditions = false;
	}

	async drawCanvas(displays, loadedCount) {
		if (!this.elem) return;
		super.drawCanvas();

		// get the progress bar cover (makes percentage)
		if (!this.progressCover) this.progressCover = this.elem.querySelector('.scroll .cover');

		// if no displays provided just draw the backgrounds (above)
		if (!displays) return;
		// screens that are switched off are left out: with this many screens the list no longer fits
		const lines = displays.map((display, index) => {
			if (!display) return false;
			if (display.showOnProgress === false) return false;
			if (display.status === STATUS.disabled) return false;
			const fill = {
				name: display.name,
			};

			const statusClass = calcStatusClass(display.status);

			// make the line
			const line = this.fillTemplate('item', fill);
			// because of timing, this might get called before the template is loaded
			if (!line) return false;

			// update the status
			const links = line.querySelector('.links');
			links.classList.remove(...statusClasses);
			links.classList.add(statusClass);
			links.dataset.index = index;
			line.dataset.elemId = display.elemId;
			return line;
		}).filter((d) => d);

		// get the container and update
		const container = this.elem.querySelector('.container');
		container.innerHTML = '';
		const twoColumns = lines.length > ONE_COLUMN_MAX;
		container.classList.toggle('columns', twoColumns);
		if (!twoColumns) {
			container.append(...lines);
			container.style.setProperty('--line-height', '');
		} else {
			// groups in rotation order, each with its title
			const grouped = new Set(DISPLAY_GROUPS.flatMap((g) => g.ids ?? []));
			const groups = DISPLAY_GROUPS.map((group) => {
				const members = lines.filter((line) => (group.ids ? group.ids.includes(line.dataset.elemId) : !grouped.has(line.dataset.elemId)));
				if (!members.length) return null;
				const title = document.createElement('div');
				title.className = 'group-title';
				title.textContent = group.title;
				return [title, ...members];
			}).filter((g) => g);
			// whole groups into two columns, as even as possible
			const total = groups.reduce((n, g) => n + g.length, 0);
			const left = [];
			const right = [];
			groups.forEach((g) => {
				const leftCount = left.length;
				if (!right.length && (leftCount === 0 || leftCount + g.length / 2 <= total / 2)) left.push(...g);
				else right.push(...g);
			});
			const columns = [left, right].map((items) => {
				const column = document.createElement('div');
				column.className = 'column';
				column.append(...items);
				return column;
			});
			container.append(...columns);
			const lineHeight = Math.min(30, Math.floor(BOX_HEIGHT / Math.max(left.length, right.length)));
			container.style.setProperty('--line-height', `${lineHeight}px`);
		}

		this.finishDraw();

		// calculate loaded percent
		const loadedPercent = (loadedCount / displays.length);

		this.progressCover.style.width = `${(1.0 - loadedPercent) * 100}%`;
		if (loadedPercent < 1.0) {
			// show the progress bar and set width
			this.progressCover.parentNode.classList.add('show');
		} else {
			// hide the progressbar after 1 second (lines up with with width transition animation)
			setTimeout(() => this.progressCover.parentNode.classList.remove('show'), 1000);
		}
	}

	lineClick(e) {
		// get index
		const indexRaw = e.target?.parentNode?.dataset?.index;
		if (indexRaw === undefined) return;
		const index = +indexRaw;

		// stop playing
		message('navButton');
		// use the y value to determine an index
		const display = getDisplay(index);
		if (display && display.status === STATUS.loaded) {
			display.showCanvas(msg.command.firstFrame);
			this.elem.classList.remove('show');
		}
	}
}

// register our own display
const progress = new Progress(-1, 'progress');
registerProgress(progress);
