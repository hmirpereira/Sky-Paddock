// Full screen for the page. The browser's own when it has one (the API is spelled several ways: standard, WebKit with a
// small or a capital S, Firefox, old Edge); when it has none or refuses (Safari on the iPhone cannot take a page element
// full screen) the "pseudo" full screen: the screen fills the browser window (the `pseudo-fullscreen` class on <body>, _page.scss).
// The document is a parameter so the functions can be tested without a browser.
const REQUESTS = ['requestFullscreen', 'webkitRequestFullscreen', 'webkitRequestFullScreen', 'mozRequestFullScreen', 'msRequestFullscreen'];
const EXITS = ['exitFullscreen', 'webkitExitFullscreen', 'webkitCancelFullScreen', 'mozCancelFullScreen', 'msExitFullscreen'];
const PSEUDO = 'pseudo-fullscreen';

const findMethod = (target, names) => names.find((name) => typeof target[name] === 'function');

const nativeElement = (doc = document) => doc.fullscreenElement || doc.webkitFullscreenElement
	|| doc.mozFullScreenElement || doc.msFullscreenElement || null;

const isPseudo = (doc = document) => doc.body.classList.contains(PSEUDO);

const isFullscreen = (doc = document) => !!nativeElement(doc) || isPseudo(doc);

// 'native' or 'pseudo' (what was done)
const enterFullscreen = async (element, doc = document) => {
	const name = findMethod(element, REQUESTS);
	if (name) {
		try {
			await element[name]({ navigationUI: 'hide' });
			return 'native';
		} catch (error) {
			console.warn('Full screen refused, using the pseudo full screen', error);
		}
	}
	doc.body.classList.add(PSEUDO);
	return 'pseudo';
};

const exitFullscreen = async (doc = document) => {
	doc.body.classList.remove(PSEUDO);
	if (nativeElement(doc)) {
		const name = findMethod(doc, EXITS);
		if (name) await doc[name]();
	}
};

export {
	isFullscreen, isPseudo, enterFullscreen, exitFullscreen, findMethod, REQUESTS, EXITS,
};
