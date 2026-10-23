// hourly forecast list

import STATUS from './status.mjs';
import getHourlyData from './hourly.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';

import ConversionHelpers from './utils/conversionHelpers.mjs';

class HourlyGraph extends WeatherDisplay {
	constructor(elemId, defaultActive) {
		super(elemId, 'Hourly Graph', defaultActive);

		// move the top right data into the correct location on load
		document.addEventListener('DOMContentLoaded', () => {
			this.moveHeader();
		});
	}

	moveHeader() {
		// get the header
		const header = this.fillTemplate('top-right', {});
		// place the header
		this.elem.querySelector('.header .right').append(header);
	}

	async getData() {
		if (!super.getData()) return;

		// the canvas draws text, which needs the font loaded
		await document.fonts.load('24px "Star4000 Small"');
		const data = await getHourlyData();
		if (data === undefined) {
			this.setStatus(STATUS.failed);
			return;
		}

		// get interesting data
		const temperature = data.map((d) => ConversionHelpers.convertTemperatureUnits(d.temperature));
		const probabilityOfPrecipitation = data.map((d) => d.probabilityOfPrecipitation);
		const skyCover = data.map((d) => d.skyCover);

		this.data = {
			skyCover, temperature, probabilityOfPrecipitation,
		};

		this.setStatus(STATUS.loaded);
	}

	drawCanvas() {
		if (!this.image) this.image = this.elem.querySelector('.chart img');

		// get available space
		const availableWidth = 532;
		const availableHeight = 285;
		// the chart area ends above the hour labels
		const baseY = availableHeight - 30;
		const topY = 14;

		this.image.width = availableWidth;
		this.image.height = availableHeight;

		// get context
		const canvas = document.createElement('canvas');
		canvas.width = availableWidth;
		canvas.height = availableHeight;
		const ctx = canvas.getContext('2d');
		ctx.imageSmoothingEnabled = false;

		const last = this.data.temperature.length - 1;
		const timeScale = calcScale(0, 0, last, availableWidth - 2);
		const startTime = DateTime.now().startOf('hour');
		const is12Hour = ConversionHelpers.getHoursFormat() === '12-hour';

		// temperature range in whole degrees, so the axis labels are the real scale
		const minTemp = Math.min(...this.data.temperature);
		const maxTemp = Math.max(...this.data.temperature);
		const lowAxis = Math.floor(minTemp);
		const highAxis = Math.max(Math.ceil(maxTemp), lowAxis + 1);
		const tempScale = calcScale(lowAxis, baseY, highAxis, topY);
		const percentScale = calcScale(0, baseY, 100, topY);

		// dotted guides at the three axis values
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
		ctx.lineWidth = 1;
		ctx.setLineDash([2, 4]);
		[lowAxis, (lowAxis + highAxis) / 2, highAxis].forEach((value) => {
			const y = Math.round(tempScale(value)) + 0.5;
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(availableWidth, y);
			ctx.stroke();
		});

		// midnight separator
		const midnight = 24 - startTime.hour;
		if (midnight < last) {
			const x = Math.round(timeScale(midnight)) + 0.5;
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, availableHeight - 24);
			ctx.stroke();
		}
		ctx.setLineDash([]);

		// "now" marker on the left edge
		ctx.fillStyle = 'yellow';
		ctx.fillRect(0, 0, 3, availableHeight - 24);

		// order is important last line drawn is on top
		// precipitation, as bars on its own 0 to 100 % scale
		this.data.probabilityOfPrecipitation.forEach((value, i) => {
			if (!value) return;
			const height = Math.max(2, baseY - percentScale(value));
			const x = timeScale(i);
			ctx.fillStyle = 'black';
			ctx.fillRect(x - 6, baseY - height, 14, height + 2);
			ctx.fillStyle = 'aqua';
			ctx.fillRect(x - 5, baseY - height, 12, height);
		});

		// clouds
		drawPath(createPath(this.data.skyCover, timeScale, percentScale), ctx, {
			strokeStyle: 'lightgrey',
			lineWidth: 2,
		});

		// temperature
		drawPath(createPath(this.data.temperature, timeScale, tempScale), ctx, {
			strokeStyle: 'red',
			lineWidth: 3,
		});

		// highest and lowest temperature marked on the line
		const degree = String.fromCharCode(176);
		[[maxTemp, 26], [minTemp, -10]].forEach(([value, offset]) => {
			const i = this.data.temperature.indexOf(value);
			const x = timeScale(i);
			const y = tempScale(value);
			ctx.fillStyle = 'white';
			ctx.fillRect(Math.min(x, availableWidth - 5) - 3, y - 3, 7, 7);
			drawText(ctx, `${Math.round(value)}${degree}`, Math.min(Math.max(x, 22), availableWidth - 22), y + offset, 'white');
		});

		// hour labels every 6 hours, and the weekday at the top of the midnight line
		for (let hours = 0; hours <= last; hours += 6) {
			const time = startTime.plus({ hours });
			const label = is12Hour ? formatTime(time) : time.toFormat('HH');
			drawText(ctx, label, Math.min(Math.max(timeScale(hours), 14), availableWidth - 14), availableHeight - 4, '#ffd800');
		}
		if (midnight < last) drawText(ctx, startTime.plus({ hours: midnight }).toFormat('ccc').toUpperCase(), timeScale(midnight) + 24, topY + 18, 'white');

		// temperature axis labels
		// limited to 3 characters, sacraficing degree character
		const labels = this.elem.querySelectorAll('.y-axis .label');
		[highAxis, Math.round((lowAxis + highAxis) / 2), lowAxis].forEach((value, i) => {
			labels[i].textContent = `${value}${degree}`.substring(0, 3);
		});

		// set the image source
		this.image.src = canvas.toDataURL();

		super.drawCanvas();
		this.finishDraw();
	}
}

// create a scaling function from two points
const calcScale = (x1, y1, x2, y2) => {
	const m = (y2 - y1) / (x2 - x1);
	const b = y1 - m * x1;
	return (x) => m * x + b;
};

// create a path as an array of [x,y]
const createPath = (data, xScale, yScale) => data.map((d, i) => [xScale(i), yScale(d)]);

// draw a path with shadow
const drawPath = (path, ctx, options) => {
	// first shadow
	ctx.beginPath();
	ctx.strokeStyle = 'black';
	ctx.lineWidth = (options?.lineWidth ?? 2) + 2;
	ctx.moveTo(path[0][0], path[0][1]);
	path.slice(1).forEach((point) => ctx.lineTo(point[0], point[1] + 2));
	ctx.stroke();

	// then colored line
	ctx.beginPath();
	ctx.strokeStyle = options?.strokeStyle ?? 'red';
	ctx.lineWidth = (options?.lineWidth ?? 2);
	ctx.moveTo(path[0][0], path[0][1]);
	path.slice(1).forEach((point) => ctx.lineTo(point[0], point[1]));
	ctx.stroke();
};

// text with the same black shadow as the lines
const drawText = (ctx, text, x, y, colour) => {
	ctx.font = '24px "Star4000 Small"';
	ctx.textAlign = 'center';
	ctx.fillStyle = 'black';
	ctx.fillText(text, x + 2, y + 2);
	ctx.fillStyle = colour;
	ctx.fillText(text, x, y);
};

// format as 1p, 12a, etc.
const formatTime = (time) => time.toFormat('ha').slice(0, -1);

// register display
registerDisplay(new HourlyGraph('hourly-graph'));
