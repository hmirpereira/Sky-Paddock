// the Automatic setting of the Christmas, Halloween and Dark Mode screens (mode 3): looks again once a minute
// and returns the new timer; any old one is cleared first
const autoTimer = (timer, mode, apply) => {
	clearInterval(timer);
	return mode === 3 ? setInterval(apply, 60 * 1000) : null;
};

export default autoTimer;
