// air quality and pollen for today, from Open-Meteo's air quality API (CAMS) in one request:
// the European Air Quality Index now (a dial on the left) and the daily pollen levels (Europe only, on the right).
// Until 1.6.1 the air quality had a screen of its own (Air Quality, US index from PM2.5).
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';

// Levels use the US National Allergy Bureau scales (grains/m³, daily average):
// [moderate from, high from, very high from]. These are a guide, not a medical reference.
const SCALES = {
	tree: [15, 90, 1500],
	grass: [5, 20, 200],
	weed: [10, 50, 500],
};

const POLLEN_TYPES = [
	{ key: 'grass_pollen', name: 'Grass', scale: SCALES.grass },
	{ key: 'olive_pollen', name: 'Olive', scale: SCALES.tree },
	{ key: 'birch_pollen', name: 'Birch', scale: SCALES.tree },
	{ key: 'alder_pollen', name: 'Alder', scale: SCALES.tree },
	{ key: 'mugwort_pollen', name: 'Mugwort', scale: SCALES.weed },
	{ key: 'ragweed_pollen', name: 'Ragweed', scale: SCALES.weed },
];

const LEVELS = [
	{ text: 'None', className: 'none' },
	{ text: 'Low', className: 'low' },
	{ text: 'Moderate', className: 'moderate' },
	{ text: 'High', className: 'high' },
	{ text: 'Very High', className: 'very-high' },
];

// European Air Quality Index (EEA): upper limit of each band
const AQI_BANDS = [
	{ max: 20, text: 'Good', className: 'good' },
	{ max: 40, text: 'Fair', className: 'fair' },
	{ max: 60, text: 'Moderate', className: 'moderate' },
	{ max: 80, text: 'Poor', className: 'poor' },
	{ max: 100, text: 'Very Poor', className: 'very-poor' },
	{ max: Infinity, text: 'Extremely Poor', className: 'extremely-poor' },
];
const aqiBand = (value) => AQI_BANDS.find((band) => value <= band.max);

// the dial: 0 at the bottom left to 150 at the bottom right, over 270 degrees, open at the bottom
const DIAL = {
	cx: 160, cy: 150, r: 108, max: 150, start: -135, sweep: 270,
};
const BAND_RANGES = [[0, 20], [20, 40], [40, 60], [60, 80], [80, 100], [100, 150]];
const angleOf = (value) => DIAL.start + (Math.min(Math.max(value, 0), DIAL.max) / DIAL.max) * DIAL.sweep;
const pointAt = (angle, radius) => {
	const rad = ((angle - 90) * Math.PI) / 180;
	return [DIAL.cx + radius * Math.cos(rad), DIAL.cy + radius * Math.sin(rad)];
};
const arc = (from, to, radius = DIAL.r) => {
	const [x1, y1] = pointAt(angleOf(from), radius);
	const [x2, y2] = pointAt(angleOf(to), radius);
	const large = angleOf(to) - angleOf(from) > 180 ? 1 : 0;
	return `M${x1.toFixed(1)},${y1.toFixed(1)} A${radius},${radius} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)}`;
};

const dialSvg = (value, band) => {
	const parts = [];
	// ticks every 10 outside the ring, longer every 50, with the numbers beyond them
	for (let v = 0; v <= DIAL.max; v += 10) {
		const major = v % 50 === 0;
		const [x1, y1] = pointAt(angleOf(v), DIAL.r + 14);
		const [x2, y2] = pointAt(angleOf(v), DIAL.r + (major ? 26 : 20));
		parts.push(`<line class="tick${major ? ' major' : ''}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`);
		if (major) {
			const [lx, ly] = pointAt(angleOf(v), DIAL.r + 40);
			parts.push(`<text class="scale-label" x="${lx.toFixed(1)}" y="${(ly + 7).toFixed(1)}" text-anchor="middle">${v}</text>`);
		}
	}
	// the six bands, dimmed, with a small gap between them
	BAND_RANGES.forEach(([from, to], i) => {
		parts.push(`<path class="band-arc ${AQI_BANDS[i].className}" d="${arc(from + 0.9, to - 0.9)}"/>`);
	});
	// from 0 to the value in the colour of the current band, a white line along it, and the marker
	if (value > 0) {
		parts.push(`<path class="value-arc ${band.className}" d="${arc(0, value)}"/>`);
		parts.push(`<path class="value-line" d="${arc(0, value)}"/>`);
	}
	const [mx, my] = pointAt(angleOf(value), DIAL.r);
	parts.push(`<circle class="marker-glow ${band.className}" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="15"/>`);
	parts.push(`<circle class="marker" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="7"/>`);
	return `<svg viewBox="0 0 320 310">${parts.join('')}</svg>`;
};

const levelFor = (value, scale) => {
	if (value === null || value === undefined) return null;
	if (value < 1) return LEVELS[0];
	if (value < scale[0]) return LEVELS[1];
	if (value < scale[1]) return LEVELS[2];
	if (value < scale[2]) return LEVELS[3];
	return LEVELS[4];
};

class Pollen extends WeatherDisplay {
	constructor(navId, elemId, defaultActive) {
		super(navId, elemId, 'Air & Pollen', defaultActive);

		// set timings (seconds on screen)
		this.timing.baseDelay = 10000;
	}

	async getData(_weatherParameters) {
		if (!super.getData(_weatherParameters)) return;
		const { latitude, longitude } = this.weatherParameters;

		try {
			const keys = POLLEN_TYPES.map((type) => type.key).join(',');
			const response = await json(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=european_aqi&hourly=${keys}&forecast_days=1&timezone=auto`);

			const aqi = response.current?.european_aqi;
			this.aqi = Number.isFinite(aqi) ? { value: Math.round(aqi), band: aqiBand(aqi) } : null;

			this.data = POLLEN_TYPES.map((type) => {
				const values = (response.hourly?.[type.key] ?? []).filter((v) => v !== null);
				// daily average, to match the scales above
				const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
				return { ...type, average, level: levelFor(average, type.scale) };
			});
		} catch (error) {
			console.error('Pollen: unable to get pollen forecast', error);
			this.setStatus(STATUS.failed);
			return;
		}

		// outside Europe CAMS has no pollen data: the air quality alone, and nothing at all skips the screen
		this.hasPollen = this.data.some((type) => type.level !== null);
		if (!this.hasPollen && !this.aqi) {
			this.setStatus(STATUS.noData);
			return;
		}

		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();

		// air quality dial (left)
		const air = this.elem.querySelector('.air-quality');
		air.style.display = this.aqi ? '' : 'none';
		if (this.aqi) {
			air.querySelector('.dial').innerHTML = dialSvg(this.aqi.value, this.aqi.band);
			air.querySelector('.value').textContent = this.aqi.value;
			const pill = air.querySelector('.band');
			pill.textContent = this.aqi.band.text;
			// "Extremely Poor" is too long for the pill at the normal size
			pill.className = `band ${this.aqi.band.className}${this.aqi.band.text.length > 10 ? ' long' : ''}`;
		}
		// pollen (right); without the air quality it uses the whole width
		const table = this.elem.querySelector('.pollen-table');
		table.style.display = this.hasPollen ? '' : 'none';
		table.classList.toggle('alone', !this.aqi);

		const lines = this.data.map((type) => {
			const row = this.fillTemplate('pollen-row', {
				name: type.name,
				level: type.level?.text ?? 'N/A',
			});
			// four steps: low, moderate, high, very high
			const steps = type.level ? LEVELS.indexOf(type.level) : 0;
			const pips = row.querySelector('.pips');
			for (let i = 1; i <= 4; i += 1) {
				const pip = document.createElement('div');
				if (i <= steps) pip.className = `on ${type.level.className}`;
				pips.append(pip);
			}
			if (type.level) row.querySelector('.level').classList.add(type.level.className);
			return row;
		});

		const list = this.elem.querySelector('.pollen-lines');
		list.innerHTML = '';
		list.append(...lines);

		this.finishDraw();
	}
}

// register display
registerDisplay(new Pollen(11, 'pollen', true));
