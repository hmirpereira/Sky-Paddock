// Debug: a dot in the line of the bottom right corner, between brackets, to the right of the date of the build: green with a network connection, red without.
// The Pi says it (skypaddock-hub /musica.json, `online`: a default route through an interface that is up, polled by music-name.mjs); when the hub does not
// answer (anywhere but the Pi) the browser's own link is used (navigator.onLine, which says nothing about the internet working). Only events, no polling here.
let hubState = null;

const update = () => {
	document.querySelector('#version-mark .net')?.classList.toggle('on', hubState ?? navigator.onLine);
};

// true or false from the hub; null (or anything else) when it said nothing
const setHubOnline = (value) => {
	hubState = typeof value === 'boolean' ? value : null;
	update();
};

window.addEventListener('online', update);
window.addEventListener('offline', update);
document.addEventListener('DOMContentLoaded', update);

export default setHubOnline;
