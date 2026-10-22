// text from other sites (news feeds, flight and aircraft data, race results, geocoding) must never be
// read as HTML: escapeHtml makes it safe to put inside markup that the page builds itself
const escapeHtml = (text) => String(text ?? '')
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#39;');

export {
	// eslint-disable-next-line import/prefer-default-export
	escapeHtml,
};
