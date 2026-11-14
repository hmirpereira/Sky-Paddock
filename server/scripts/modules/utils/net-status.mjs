// Debug: a dot at the end of the line in the bottom right corner, between brackets: green with a network connection, red without
// (the link, as the browser knows it: navigator.onLine; it says nothing about the internet working). Only events, no polling.
const update = () => {
	document.querySelector('#version-mark .net')?.classList.toggle('on', navigator.onLine);
};

window.addEventListener('online', update);
window.addEventListener('offline', update);
document.addEventListener('DOMContentLoaded', update);
