// travel forecast display: page 1 high and low of a few cities, page 2 the current weather and local time
// of one city chosen in the settings (utils/travel-cities.mjs). Both from Open-Meteo.
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import { getWeatherRegionalIconFromIconLink, getWeatherIconFromIconLink } from './icons.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { getConditionText } from './utils/weather.mjs';
import { directionToNSEW } from './utils/calc.mjs';
import ConversionHelpers from './utils/conversionHelpers.mjs';
import settings from './settings.mjs';
import { TRAVEL_CITIES, detailCity } from './utils/travel-cities.mjs';

// after this local hour the forecast shown on page 1 is for tomorrow
const SWITCH_TO_TOMORROW_HOUR = 18;

const API = 'https://api.open-meteo.com/v1/forecast';

class TravelForecast extends WeatherDisplay {
	constructor(elemId, defaultActive) {
		super(elemId, 'Travel Forecast', defaultActive);

		// Remove from loading screen
		this.showOnProgress = false;

		// the pages that have data, 10 seconds each
		this.timing.baseDelay = 10000;
		this.pages = [];
	}

	async getData() {
		// super checks for enabled
		if (!super.getData()) return;

		const [list, detail] = await Promise.all([getList(), getDetail(detailCity(settings.travelCity?.value))]);
		this.pages = [];
		if (list) this.pages.push('list');
		if (detail) this.pages.push('detail');
		this.list = list;
		this.detail = detail;

		if (!this.pages.length) {
			this.setStatus(STATUS.noData);
			return;
		}

		this.timing.totalScreens = this.pages.length;
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
		if (list) this.drawList(list);
	}

	drawList(cities) {
		const list = this.elem.querySelector('.travel-lines');
		list.innerHTML = '';
		const rows = cities.map((city) => this.fillTemplate('travel-row', {
			city: city.name,
			low: Math.round(city.low).toString(),
			high: Math.round(city.high).toString(),
			icon: { type: 'img', src: city.icon },
		}));
		list.append(...rows);
	}

	async drawCanvas() {
		super.drawCanvas();

		const page = this.pages[Math.min(Math.max(this.screenIndex, 0), this.pages.length - 1)];
		const isList = page === 'list';
		this.elem.querySelector('.travel-page.list').style.display = isList ? 'block' : 'none';
		this.elem.querySelector('.travel-page.detail').style.display = isList ? 'none' : 'block';
		// the detail page sits in the box of the background (like Current Conditions)
		this.elem.querySelector('.main').classList.toggle('has-box', !isList);

		if (isList) {
			this.elem.querySelector('.header .title.dual .bottom').textContent = `For ${getTravelCitiesDayName(this.list)}`;
		} else {
			this.drawDetail(this.detail);
		}

		this.finishDraw();
	}

	drawDetail(detail) {
		this.elem.querySelector('.header .title.dual .bottom').textContent = detail.name;
		const degree = String.fromCharCode(176);
		const fill = {
			temp: `${Math.round(detail.temperature)}${degree}`,
			condition: detail.condition,
			time: detail.time,
			feels: `${Math.round(detail.feelsLike)}${degree}`,
			humidity: `${Math.round(detail.humidity)}%`,
			wind: `${detail.windDirection} ${Math.round(detail.windSpeed)} ${ConversionHelpers.getWindUnitText()}`,
			pressure: `${Math.round(detail.pressure)} ${ConversionHelpers.getPressureUnitText()}`,
		};
		Object.entries(fill).forEach(([key, value]) => {
			this.elem.querySelector(`.travel-page.detail .${key}`).textContent = value;
		});
		this.elem.querySelector('.travel-page.detail .icon img').src = detail.icon;
	}
}

// high and low of the page 1 cities, in one request; null when none answered
const getList = async () => {
	const today = DateTime.local().hour < SWITCH_TO_TOMORROW_HOUR;
	const dayIndex = today ? 0 : 1;
	try {
		const lats = TRAVEL_CITIES.map((city) => city.lat).join(',');
		const lons = TRAVEL_CITIES.map((city) => city.lon).join(',');
		const response = await json(`${API}?latitude=${lats}&longitude=${lons}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=2`);
		const results = Array.isArray(response) ? response : [response];

		const cities = TRAVEL_CITIES.map((city, index) => {
			const daily = results[index]?.daily;
			if (!daily) return null;
			const condition = getConditionText(Number(daily.weather_code[dayIndex]));
			return {
				today,
				high: ConversionHelpers.convertTemperatureUnits(daily.temperature_2m_max[dayIndex]),
				low: ConversionHelpers.convertTemperatureUnits(daily.temperature_2m_min[dayIndex]),
				name: city.Name,
				icon: getWeatherRegionalIconFromIconLink(condition, 1),
			};
		}).filter(Boolean);
		return cities.length ? cities : null;
	} catch (error) {
		console.error('GetTravelWeather failed', error);
		return null;
	}
};

// current weather and local time of the chosen city; null when it did not answer
const getDetail = async (city) => {
	try {
		const response = await json(`${API}?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl&timezone=auto`);
		const { current } = response;
		const local = DateTime.fromISO(current.time);
		const condition = getConditionText(Number(current.weather_code));
		return {
			name: city.name,
			temperature: ConversionHelpers.convertTemperatureUnits(current.temperature_2m),
			feelsLike: ConversionHelpers.convertTemperatureUnits(current.apparent_temperature),
			humidity: current.relative_humidity_2m,
			windSpeed: ConversionHelpers.convertWindUnits(current.wind_speed_10m),
			windDirection: directionToNSEW(current.wind_direction_10m),
			pressure: ConversionHelpers.convertPressureUnits(current.pressure_msl),
			condition,
			icon: getWeatherIconFromIconLink(condition, response.timezone),
			// local time in the city (Open-Meteo gives it in the time zone of the city)
			time: local.toFormat(ConversionHelpers.getHoursFormat() === '12-hour' ? 'h:mm a' : 'HH:mm'),
		};
	} catch (error) {
		console.error('GetTravelDetail failed', error);
		return null;
	}
};

// the day name of the first city (today or tomorrow)
const getTravelCitiesDayName = (cities) => DateTime.local().plus({ days: cities[0].today ? 0 : 1 }).toLocaleString({ weekday: 'long' });

// register display, not active by default
registerDisplay(new TravelForecast('travel', false));
