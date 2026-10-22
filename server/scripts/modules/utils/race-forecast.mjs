// forecast for the hour a race starts, only when it is within Open-Meteo's 16 days (F1 Next Race, GT World Next)
import { json } from './fetch.mjs';
import { DateTime } from '../../vendor/auto/luxon.mjs';
import { getConditionText } from './weather.mjs';
import { getWeatherRegionalIconFromIconLink } from '../icons.mjs';
import ConversionHelpers from './conversionHelpers.mjs';

const raceForecast = async (start, lat, lon, label) => {
	if (!start || !lat) return null;
	const time = DateTime.fromISO(start).toUTC();
	if (time > DateTime.now().plus({ days: 15 })) return null;
	try {
		const day = time.toISODate();
		const response = await json(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=weather_code,temperature_2m,precipitation_probability,is_day&timezone=GMT&start_date=${day}&end_date=${day}`);
		const index = response?.hourly?.time?.indexOf(time.startOf('hour').toFormat("yyyy-MM-dd'T'HH:mm"));
		if (index === undefined || index < 0) return null;
		const condition = getConditionText(Number(response.hourly.weather_code[index]));
		return {
			condition,
			icon: getWeatherRegionalIconFromIconLink(condition, response.hourly.is_day[index]),
			temperature: Math.round(ConversionHelpers.convertTemperatureUnits(response.hourly.temperature_2m[index])),
			rain: response.hourly.precipitation_probability[index],
		};
	} catch (error) {
		console.error(`${label}: unable to get the forecast`, error);
		return null;
	}
};

export default raceForecast;
