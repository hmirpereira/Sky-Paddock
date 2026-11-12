// the maps of the Regional Forecast: Esri's ocean tiles, drawn at run time with the coast, border and district lines of the
// radar; the cities sit where their coordinates fall on the page (Web Mercator, the same projection as the tiles)
// shortcut: the views are fixed (zoom and centre per page, as the tiles need an integer zoom), a map of another area needs its own view
export const MAP_W = 640;
export const MAP_H = 310;

export const PAGES = ['north', 'centre', 'lisbon', 'south', 'madeira', 'azores'];

export const VIEWS = {
	north: { z: 8, lat: 41.47785, lon: -7.7948 },
	centre: { z: 8, lat: 40.2023, lon: -8.0373 },
	lisbon: { z: 8, lat: 38.91055, lon: -8.2839 },
	south: { z: 7, lat: 37.7954, lon: -7.8968 },
	madeira: { z: 9, lat: 32.75, lon: -16.95 },
	azores: { z: 9, lat: 37.75, lon: -25.55 },
};

// the Madeira cities are south of the Azores group; every island city is one of the two
export const islandGroup = (city) => (city.lat < 33.5 ? 'madeira' : 'azores');

// the world pixel of a point at zoom z (256 pixels a tile)
export const worldPx = (z, lat, lon) => {
	const w = 256 * 2 ** z;
	const x = ((lon + 180) / 360) * w;
	const r = (lat * Math.PI) / 180;
	const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * w;
	return [x, y];
};

// the tiles [z, x, y] that cover the map of a view
export const tilesFor = (view) => {
	const [cx, cy] = worldPx(view.z, view.lat, view.lon);
	const tiles = [];
	for (let tx = Math.floor((cx - MAP_W / 2) / 256); tx <= Math.floor((cx + MAP_W / 2) / 256); tx += 1) {
		for (let ty = Math.floor((cy - MAP_H / 2) / 256); ty <= Math.floor((cy + MAP_H / 2) / 256); ty += 1) tiles.push([view.z, tx, ty]);
	}
	return tiles;
};

// the position on the map (pixels from its top left corner) of a point
export const project = (view, lat, lon) => {
	const [x, y] = worldPx(view.z, lat, lon);
	const [cx, cy] = worldPx(view.z, view.lat, view.lon);
	return [MAP_W / 2 + (x - cx), MAP_H / 2 + (y - cy)];
};

// the top left corner of each label (w x h pixels), starting on its city: the free place nearest to it inside the map, which
// does not cover another label or another city, so a label moves only as far as needed; with none free, it stays on its city
export const placeLabels = (items, h = 50) => {
	const placed = [];
	const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + h && b.y < a.y + h;
	const covers = (box, c) => c.x >= box.x - 3 && c.x <= box.x + box.w + 3 && c.y >= box.y - 3 && c.y <= box.y + h + 3;
	return items.map(({ x, y, w }, index) => {
		const others = items.filter((_, j) => j !== index);
		const inside = (b) => b.x >= 0 && b.x + w <= MAP_W && b.y >= 0 && b.y + h <= MAP_H;
		const free = (b) => inside(b) && placed.every((q) => !overlaps(b, q)) && others.every((c) => !covers(b, c)) && !covers(b, { x, y });
		let best = null;
		let bestCost = Infinity;
		for (let oy = -62; oy <= 40; oy += 2) {
			for (let ox = -w + 12; ox <= 24; ox += 2) {
				const b = { x: Math.round(x + ox), y: Math.round(y + oy), w };
				const cost = Math.hypot(ox - 6, oy + 22);
				if (cost < bestCost && free(b)) {
					best = b;
					bestCost = cost;
				}
			}
		}
		if (!best) best = { x: Math.min(Math.max(Math.round(x - 6), 0), MAP_W - w), y: Math.min(Math.max(Math.round(y - 6), 0), MAP_H - h), w };
		placed.push(best);
		return [best.x, best.y];
	});
};
