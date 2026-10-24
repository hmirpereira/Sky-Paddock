// travel forecast display: page 1 high and low of a few cities, page 2 the current weather and local time
// of one city chosen in the settings (utils/travel-cities.mjs). Both from Open-Meteo.
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import { getWeatherRegionalIconFromIconLink, getWeatherIconFromIconLink } from './icons.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { getConditionText, shortConditions } from './utils/weather.mjs';
import { directionToNSEW } from './utils/calc.mjs';
import ConversionHelpers from './utils/conversionHelpers.mjs';
import settings from './settings.mjs';
import { TRAVEL_CITIES, detailCity, flagFile } from './utils/travel-cities.mjs';

// after this local hour the forecast shown on page 1 is for tomorrow
const SWITCH_TO_TOMORROW_HOUR = 18;

const API = 'https://api.open-meteo.com/v1/forecast';

class TravelForecast extends WeatherDisplay {
	constructor(elemId, defaultActive) {
		super(elemId, 'Travel Forecast', defaultActive);

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
		// like Current Conditions: the city is in the list on the right, the title only says what the page is
		this.elem.querySelector('.header .title.dual .bottom').textContent = 'Conditions';
		const degree = String.fromCharCode(176);
		const fill = {
			temp: `${Math.round(detail.temperature)}${degree}`,
			condition: detail.condition.length > 15 ? shortConditions(detail.condition) : detail.condition,
			wind: detail.windDirection.padEnd(3, '') + detail.windSpeed.toString().padStart(3, ' '),
			'wind-gusts': `Gusts to ${detail.windGust}`,
			city: detail.name,
			time: detail.time,
			feels: `${Math.round(detail.feelsLike)}${degree}`,
			humidity: `${Math.round(detail.humidity)}%`,
			dewpoint: `${detail.dewPoint}${degree}`,
			visibility: `${detail.visibility}${detail.distanceUnit}`,
			pressure: `${detail.pressure}${detail.pressureUnit}`,
			cloud: `${Math.round(detail.cloudCover)}%`,
		};
		const page = this.elem.querySelector('.travel-page.detail');
		Object.entries(fill).forEach(([key, value]) => {
			page.querySelector(`.${key}`).textContent = value;
		});
		// the arrow of a rising or falling pressure, as in Current Conditions
		if (detail.pressureTrend !== 'steady') {
			const arrow = document.createElement('img');
			arrow.className = `pressure-arrow${detail.pressureTrend === 'falling' ? ' invert-pressure-arrow' : ''}`;
			arrow.src = 'images/pressure-arrow.png';
			page.querySelector('.pressure').append(arrow);
		}
		// the 8-bit flag of the country beside the city, as on the F1 screens (hidden if the picture is missing)
		const flag = page.querySelector('.location .flag');
		flag.style.display = '';
		flag.onerror = () => { flag.style.display = 'none'; };
		flag.src = `images/flags/${detail.flag}.png`;
		page.querySelector('.icon img').src = detail.icon;
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
		// the last 3 hours of pressure give its trend
		const response = await json(`${API}?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,weather_code,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl&hourly=pressure_msl&past_hours=3&forecast_hours=1&timezone=auto`);
		const { current } = response;
		const local = DateTime.fromISO(current.time);
		const condition = getConditionText(Number(current.weather_code));
		// raw pressure is in hPa
		const change = current.pressure_msl - response.hourly.pressure_msl[0];
		let pressureTrend = 'steady';
		if (change > 0.5) pressureTrend = 'rising';
		if (change < -0.5) pressureTrend = 'falling';
		return {
			name: city.name,
			flag: flagFile(city.country),
			temperature: ConversionHelpers.convertTemperatureUnits(current.temperature_2m),
			feelsLike: ConversionHelpers.convertTemperatureUnits(current.apparent_temperature),
			dewPoint: ConversionHelpers.convertTemperatureUnits(current.dew_point_2m),
			humidity: current.relative_humidity_2m,
			cloudCover: current.cloud_cover,
			visibility: ConversionHelpers.convertDistanceUnits(current.visibility / 1000),
			distanceUnit: ConversionHelpers.getDistanceUnitText(),
			windSpeed: ConversionHelpers.convertWindUnits(current.wind_speed_10m),
			windGust: ConversionHelpers.convertWindUnits(current.wind_gusts_10m),
			windDirection: directionToNSEW(current.wind_direction_10m),
			pressure: ConversionHelpers.convertPressureUnits(current.pressure_msl),
			pressureUnit: ConversionHelpers.getPressureUnitText(),
			pressureTrend,
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
