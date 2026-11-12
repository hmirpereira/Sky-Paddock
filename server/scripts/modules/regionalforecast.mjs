// Regional Forecast for Portugal: district capitals and island capitals on six maps
// (north, centre, Lisbon area, south, Madeira, Azores); each city has a white dot on its place and its label beside it, each with the day's weather icon, high and low.
// Before 18:00 it shows today, after that tomorrow (like the Travel Forecast).
// Data: one Open-Meteo request for all 22 cities. The maps are Esri's ocean tiles with the coast, border and district lines
// of the radar (utils/regional-map.mjs draws them); the cities and their coordinates come from utils/regional-pt.mjs
// (made by ferramentas/mkregional.py from Natural Earth, public domain; its map images are no longer used).
// (The original screen used the US National Weather Service and a US map, so it never worked here.)
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import { getWeatherRegionalIconFromIconLink } from './icons.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import fillFooter from './utils/footer.mjs';
import { registerDisplay } from './navigation.mjs';
import { getConditionText } from './utils/weather.mjs';
import ConversionHelpers from './utils/conversionHelpers.mjs';
import REGIONAL_PAGES from './utils/regional-pt.mjs';
import { BORDER, COAST, DISTRICTS } from './utils/radar-lines.mjs';
import { ISLAND_COAST } from './utils/island-lines.mjs';
import {
	MAP_H, MAP_W, PAGES, VIEWS, islandGroup, placeLabels, project, tilesFor, worldPx,
} from './utils/regional-map.mjs';

const SWITCH_TO_TOMORROW_HOUR = 18;
const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile';
const SVG_NS = 'http://www.w3.org/2000/svg';
const PAGE_TITLES = {
	north: 'North', centre: 'Centre', lisbon: 'Lisbon', south: 'South', madeira: 'Madeira', azores: 'Azores',
};

// the cities of a page: the island cities of the Islands page are split between Madeira and the Azores
// cities whose label sits higher than usual, so the label of a city beside them keeps to its own district (Lisboa over Setubal)
const ABOVE_POINT = new Set(['lisboa']);

const citiesOf = (id) => {
	// the Azores page shows Ponta Delgada only (the map is on its island); the other island cities stay in the request
	if (id === 'azores') return REGIONAL_PAGES.find((page) => page.id === 'islands').cities.filter((city) => city.key === 'pontadelgada');
	if (id === 'madeira') {
		return REGIONAL_PAGES.find((page) => page.id === 'islands').cities.filter((city) => islandGroup(city) === id);
	}
	return REGIONAL_PAGES.find((page) => page.id === id).cities;
};

class RegionalForecast extends WeatherDisplay {
	constructor(elemId) {
		super(elemId, 'Regional Forecast', false);
		this.timing.baseDelay = 6000;
		this.timing.totalScreens = PAGES.length;
	}

	async getData(_weatherParameters) {
		if (!super.getData(_weatherParameters)) return;

		const cities = REGIONAL_PAGES.flatMap((page) => page.cities);
		this.today = DateTime.local().hour < SWITCH_TO_TOMORROW_HOUR;
		const day = this.today ? 0 : 1;
		try {
			const lats = cities.map((c) => c.lat).join(',');
			const lons = cities.map((c) => c.lon).join(',');
			const response = await json(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=2`);
			const results = Array.isArray(response) ? response : [response];
			this.forecast = {};
			cities.forEach((city, index) => {
				const daily = results[index]?.daily;
				if (!daily) return;
				this.forecast[city.key] = {
					icon: getWeatherRegionalIconFromIconLink(getConditionText(Number(daily.weather_code[day])), 1),
					high: Math.round(ConversionHelpers.convertTemperatureUnits(daily.temperature_2m_max[day])),
					low: Math.round(ConversionHelpers.convertTemperatureUnits(daily.temperature_2m_min[day])),
				};
			});
		} catch (error) {
			console.error('RegionalForecast: no data', error);
			this.forecast = {};
		}
		if (Object.keys(this.forecast).length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		const id = PAGES[Math.min(Math.max(this.screenIndex, 0), PAGES.length - 1)];
		const view = VIEWS[id];

		this.elem.querySelector('.header .title.dual .top').textContent = 'National Forecast';
		this.elem.querySelector('.header .title.dual .bottom').textContent = PAGE_TITLES[id];
		this.drawMap(id, view);
		// the map credit in the bottom right corner, as the sources of the Local Radar
		fillFooter(this.elem, ['Esri', 'Natural Earth']);

		const cities = citiesOf(id).filter((city) => this.forecast[city.key]);
		// each label starts on its city and moves to a free place when another label is there (placeLabels)
		const spots = placeLabels(cities.map((city) => {
			const [x, y] = project(view, city.lat, city.lon);
			return {
				x, y, w: city.w, oy: ABOVE_POINT.has(city.key) ? -50 : undefined,
			};
		}));
		const blocks = cities.map((city, i) => {
			const data = this.forecast[city.key];
			const block = this.fillTemplate('location', {
				city: city.name,
				high: data.high,
				low: data.low,
				icon: { type: 'img', src: data.icon },
			});
			block.style.left = `${spots[i][0]}px`;
			block.style.top = `${spots[i][1]}px`;
			block.style.width = `${city.w}px`;
			return block;
		});

		const container = this.elem.querySelector('.location-container');
		container.innerHTML = '';
		// a white dot with a black edge on the exact place of each city; its label sits beside it
		const dots = cities.map((city) => {
			const [x, y] = project(view, city.lat, city.lon);
			const dot = document.createElement('div');
			dot.className = 'city-dot';
			dot.style.left = `${x}px`;
			dot.style.top = `${y}px`;
			return dot;
		});
		container.append(...dots, ...blocks);

		this.finishDraw();
	}

	// the ocean tiles, then the lines over them: the coast, border and districts of Portugal, or the coast of an island group
	drawMap(id, view) {
		const [cx, cy] = worldPx(view.z, view.lat, view.lon);
		const tiles = tilesFor(view).map(([z, x, y]) => {
			const img = document.createElement('img');
			img.className = 'tile';
			img.alt = '';
			img.src = `${TILE_URL}/${z}/${y}/${x}`;
			img.style.left = `${Math.round(x * 256 - (cx - MAP_W / 2))}px`;
			img.style.top = `${Math.round(y * 256 - (cy - MAP_H / 2))}px`;
			return img;
		});
		const sets = (id === 'madeira' || id === 'azores')
			? [{ rings: ISLAND_COAST[id], halo: 4, width: 1.6 }]
			: [
				{ rings: COAST, halo: 4, width: 1.6 },
				{ rings: BORDER, halo: 4, width: 1.6 },
				{
					rings: DISTRICTS, halo: 3, width: 0.9,
				},
			];
		const svg = document.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('class', 'lines');
		svg.setAttribute('width', MAP_W);
		svg.setAttribute('height', MAP_H);
		const stroke = (points, color, width, opacity, dash) => {
			const line = document.createElementNS(SVG_NS, 'polyline');
			line.setAttribute('points', points);
			line.setAttribute('fill', 'none');
			line.setAttribute('stroke', color);
			line.setAttribute('stroke-width', width);
			line.setAttribute('stroke-opacity', opacity);
			line.setAttribute('stroke-linejoin', 'round');
			if (dash) line.setAttribute('stroke-dasharray', dash);
			svg.append(line);
		};
		sets.forEach(({
			rings, halo, width, dash,
		}) => rings.forEach((ring) => {
			const points = ring.map(([lat, lon]) => project(view, lat, lon).join(',')).join(' ');
			stroke(points, '#000', halo, 0.45);
			stroke(points, '#fff', width, 0.95, dash);
		}));
		this.elem.querySelector('.map').replaceChildren(...tiles, svg);
	}
}

registerDisplay(new RegionalForecast('regional-forecast'));
