// the bottom bar of a screen (views/partials/footer.ejs): the sources of the data on the left, the page counter on the right
import { sourceLogo } from './news.mjs';

// sources: names (shown by their logo when there is one, see utils/news.mjs) or elements; page is the index of the page shown
const fillFooter = (elem, sources, page = 0, pages = 1) => {
	const footer = elem.querySelector('.source-footer');
	footer.querySelector('.sources').replaceChildren(...sources.map((source) => (typeof source === 'string' ? sourceLogo(source) : source)));
	footer.querySelector('.page').textContent = pages > 1 ? `${page + 1}/${pages}` : '';
};

export default fillFooter;
