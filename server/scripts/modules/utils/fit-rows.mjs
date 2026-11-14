// How the rows of a screen are fitted on its pages (no DOM, so it can be tested in Node): all the rows go on one page at the
// biggest scale that fits them (smaller rows and letters); only when even the smallest scale is not enough are there more pages.
// heights: the height of each row at scale 1 (px); avail: the height of a page (px); scales: from the biggest to the smallest.
// Returns { scale, pages: [[row index, ...], ...] }.

// the scales from 1 down to `min`, in steps of `step`
const scaleSteps = (min, step) => {
	const out = [];
	for (let s = 1; s >= min - 1e-9; s -= step) out.push(Math.round(s * 1000) / 1000);
	return out;
};

// the rows in pages of at most `capacity` px (greedy), as a list of index lists
const fillPages = (heights, capacity) => {
	const pages = [[]];
	let used = 0;
	heights.forEach((h, i) => {
		if (used + h > capacity && pages.at(-1).length) {
			pages.push([]);
			used = 0;
		}
		pages.at(-1).push(i);
		used += h;
	});
	return pages;
};

const fitRows = (heights, avail, scales) => {
	if (heights.length === 0) return { scale: scales[0], pages: [[]] };
	const total = (s) => heights.reduce((sum, h) => sum + h * s, 0);
	const fit = scales.find((s) => total(s) <= avail);
	if (fit !== undefined) return { scale: fit, pages: [heights.map((_, i) => i)] };
	// not even the smallest scale: pages, as even as possible (the smallest page height that gives the same number of pages)
	const scale = scales.at(-1);
	const scaled = heights.map((h) => h * scale);
	const count = fillPages(scaled, avail).length;
	let low = Math.max(...scaled);
	let high = avail;
	while (high - low > 0.5) {
		const mid = (low + high) / 2;
		if (fillPages(scaled, mid).length <= count) high = mid; else low = mid;
	}
	return { scale, pages: fillPages(scaled, high) };
};

export { fitRows, scaleSteps };
