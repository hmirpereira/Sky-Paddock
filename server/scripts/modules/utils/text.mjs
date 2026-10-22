// the Star4000 fonts draw accented letters, typographic quotes and long dashes blank: replace them by plain ones
// eslint-disable-next-line import/prefer-default-export
export const plainText = (text) => String(text ?? '')
	.normalize('NFD')
	.replace(/[̀-ͯ]/g, '')
	.replace(/[‘’´]/g, "'")
	.replace(/[“”«»]/g, '"')
	.replace(/[–—]/g, '-');
