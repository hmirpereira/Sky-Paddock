// track state of nosleep locally to avoid a null case error
// when nosleep.disable is called without first calling .enable

let wakeLock = false;

const noSleep = (enable = false) => {
	// get a nosleep controller
	if (!noSleep.controller) noSleep.controller = new NoSleep();
	// don't call anything if the states match
	if (wakeLock === enable) return false;
	// store the value
	wakeLock = enable;
	// call the function (the browser may refuse the wake lock, e.g. without a user gesture: not an error)
	if (enable) return Promise.resolve(noSleep.controller.enable()).catch((error) => console.warn('noSleep:', error.message));
	return noSleep.controller.disable();
};

export default noSleep;
