// the synopsis of a Plex screen in its box: the letters get smaller, down to minPt, until the text fits; then it is cut at a word
// (with "...") where the box ends. text is already plain text (plainText).
const fitSummary = (elem, text, basePt = 15, minPt = 11) => {
	let words = text.split(' ');
	let size = basePt;
	elem.style.fontSize = `${size}pt`;
	elem.textContent = words.join(' ');
	while (size > minPt && elem.scrollHeight > elem.clientHeight) {
		size = Math.max(minPt, size - 0.5);
		elem.style.fontSize = `${size}pt`;
	}
	while (words.length > 3 && elem.scrollHeight > elem.clientHeight) {
		words = words.slice(0, -Math.max(1, Math.round(words.length * 0.05)));
		elem.textContent = `${words.join(' ').replace(/[.,;:!?-]+$/, '')}...`;
	}
};

export default fitSummary;
