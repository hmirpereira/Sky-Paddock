// Place search suggestions under the address box, without jQuery (replaces jquery.autocomplete).
// Same look as before: the .autocomplete-suggestions list and its classes are styled in _page.scss.
// Keyboard: arrows move, Enter picks the highlighted (or the first) suggestion, Escape closes.
import { json } from './fetch.mjs';

const autocomplete = (input, {
	serviceUrl, paramName, params = {}, transformResult, minChars = 3, deferRequestBy = 300,
	noSuggestionNotice = 'No results found.', width = 490, onSelect,
}) => {
	const list = document.createElement('div');
	list.className = 'autocomplete-suggestions';
	list.style.cssText = 'position:absolute;display:none;z-index:9999;max-height:300px;overflow:auto;';
	document.body.append(list);

	let suggestions = [];
	let selected = -1;
	let timer = null;
	let request = 0;
	let previousValue = null;

	const place = () => {
		const box = input.getBoundingClientRect();
		list.style.left = `${box.left + window.scrollX}px`;
		list.style.top = `${box.bottom + window.scrollY}px`;
		list.style.width = `${Math.min(width, Math.max(box.width, 200))}px`;
	};
	const hide = () => { list.style.display = 'none'; selected = -1; };
	const highlight = (index) => {
		selected = index;
		[...list.children].forEach((child, i) => child.classList.toggle('autocomplete-selected', i === index));
		list.children[index]?.scrollIntoView({ block: 'nearest' });
	};
	const choose = (index) => {
		const suggestion = suggestions[index];
		if (!suggestion) return;
		input.value = suggestion.value;
		hide();
		// do not look up the same place twice in a row
		if (suggestion.value === previousValue) return;
		previousValue = suggestion.value;
		onSelect?.(suggestion);
	};
	const show = () => {
		list.innerHTML = '';
		if (!suggestions.length) {
			const notice = document.createElement('div');
			notice.className = 'autocomplete-no-suggestion';
			notice.textContent = noSuggestionNotice;
			list.append(notice);
		}
		suggestions.forEach((suggestion, index) => {
			const item = document.createElement('div');
			item.className = 'autocomplete-suggestion';
			item.textContent = suggestion.value;
			// mousedown runs before the input loses focus, so the click is never lost
			item.addEventListener('mousedown', (e) => { e.preventDefault(); choose(index); });
			item.addEventListener('mouseenter', () => highlight(index));
			list.append(item);
		});
		selected = -1;
		place();
		list.style.display = 'block';
	};

	const search = async () => {
		const text = input.value.trim();
		if (text.length < minChars) { suggestions = []; hide(); return; }
		request += 1;
		const mine = request;
		try {
			const response = await json(serviceUrl, { data: { ...params, [paramName]: text } });
			// an older answer arriving after a newer one is ignored
			if (mine !== request) return;
			suggestions = transformResult(response).suggestions ?? [];
			show();
		} catch (error) {
			if (mine === request) { suggestions = []; hide(); }
			console.warn('Place search failed', error.message);
		}
	};

	input.setAttribute('autocomplete', 'off');
	input.addEventListener('input', () => {
		clearTimeout(timer);
		timer = setTimeout(search, deferRequestBy);
	});
	input.addEventListener('keydown', (e) => {
		if (list.style.display !== 'block') return;
		if (e.key === 'ArrowDown') { e.preventDefault(); highlight(Math.min(selected + 1, suggestions.length - 1)); }
		if (e.key === 'ArrowUp') { e.preventDefault(); highlight(Math.max(selected - 1, 0)); }
		if (e.key === 'Escape') hide();
	});
	input.addEventListener('blur', () => setTimeout(hide, 150));
	window.addEventListener('resize', () => { if (list.style.display === 'block') place(); });

	return {
		// Enter or the Go button: the highlighted suggestion, otherwise the first one
		selectCurrent: () => {
			if (!suggestions.length) return false;
			choose(selected >= 0 ? selected : 0);
			return true;
		},
	};
};

export default autocomplete;
