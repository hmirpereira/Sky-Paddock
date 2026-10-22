const json = (url, params) => fetchAsync(url, 'json', params);
const text = (url, params) => fetchAsync(url, 'text', params);
const blob = (url, params) => fetchAsync(url, 'blob', params);

const fetchAsync = async (_url, responseType, _params = {}) => {
	// combine default and provided parameters
	const params = {
		method: 'GET',
		mode: 'cors',
		type: 'GET',
		..._params,
	};
	// no request waits for ever: without a signal of its own, give up after 30 s
	if (!params.signal) params.signal = AbortSignal.timeout(params.timeout ?? 30000);

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
	const response = await fetch(url, params);

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
