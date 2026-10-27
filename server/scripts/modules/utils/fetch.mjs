const json = (url, params) => fetchAsync(url, 'json', params);
const text = (url, params) => fetchAsync(url, 'text', params);
const blob = (url, params) => fetchAsync(url, 'blob', params);

// A request that fails because the network or the server had a problem (not a 4xx answer) is asked again, after 1, 2 and 5 s
// (the idea comes from ws4kp). Not repeated: a request with a signal of its own (its caller decides how long to wait), one that
// timed out (a slow server is no faster the second time), and the Pi service on this machine (it answers at once or not at all).
const RETRY_DELAYS = [1000, 2000, 5000];
const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const fetchWithRetry = async (url, params) => {
	const ownSignal = !params.signal;
	const retries = params.retryCount ?? (ownSignal && !LOCAL_HOSTS.includes(url.hostname) ? RETRY_DELAYS.length : 0);
	for (let attempt = 0; ; attempt += 1) {
		try {
			// no request waits for ever: without a signal of its own, give up after 30 s
			// eslint-disable-next-line no-await-in-loop
			const response = await fetch(url, ownSignal ? { ...params, signal: AbortSignal.timeout(params.timeout ?? 30000) } : params);
			if (response.status < 500 || attempt >= retries) return response;
		} catch (error) {
			if (error.name === 'AbortError' || error.name === 'TimeoutError' || attempt >= retries) throw error;
		}
		// eslint-disable-next-line no-await-in-loop
		await wait(RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]);
	}
};

const fetchAsync = async (_url, responseType, _params = {}) => {
	// combine default and provided parameters
	const params = {
		method: 'GET',
		mode: 'cors',
		type: 'GET',
		..._params,
	};
	const url = new URL(_url, document.baseURI);
	// add parameters if necessary
	if (params.data) {
		Object.keys(params.data).forEach((key) => {
			// get the value
			const value = params.data[key];
			// add to the url
			url.searchParams.append(key, value);
		});
	}

	// make the request
	const response = await fetchWithRetry(url, params);

	// check for ok response
	if (!response.ok) throw new Error(`Fetch error ${response.status} ${response.statusText} while fetching ${response.url}`);
	// return the requested response
	switch (responseType) {
		case 'json':
			return response.json();
		case 'text':
			return response.text();
		case 'blob':
			return response.blob();
		default:
			return response;
	}
};

export {
	json,
	text,
	blob,
};
