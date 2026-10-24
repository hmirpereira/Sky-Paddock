// size and scale of the track map on the F1 Next Race screen, so that the corner names beside the outline always fit

// the box of the map in the 640 x 480 page, in px
const MAP_WIDTH = 270;
const MAP_HEIGHT = 280;
// width of one letter of a corner name (Star4000 Small at 14 px), and the height above and below its baseline
const LETTER_WIDTH = 6.6;
const TEXT_ABOVE = 11;
const TEXT_BELOW = 3;
// radius of the dot of a corner, in px
const DOT_RADIUS = 4.5;
// the plain outline keeps this margin on every side, in outline units
const MARGIN = 40;

// where the names go and the box that holds the outline and them, with u outline units in one px; the offsets of the names
// ([name, x, y, side, dx, dy]: it starts (side 'r'), ends (side 'l') or is centred (side 'm') dx, dy px from the dot) are in px
const layout = (width, height, corners, u) => {
	const labels = corners.map(([name, x, y, side, dx, dy]) => ({
		x: x + dx * u, y: y + dy * u, side, name,
	}));
	let [left, right, top, bottom] = [-MARGIN, width + MARGIN, -MARGIN, height + MARGIN];
	corners.forEach(([name, x, y], index) => {
		const { x: lx, y: ly, side } = labels[index];
		const textWidth = name.length * LETTER_WIDTH * u;
		// side 'l': the name ends at lx, 'r': it starts there, 'm': it is centred there
		const [from, to] = { l: [lx - textWidth, lx], r: [lx, lx + textWidth], m: [lx - textWidth / 2, lx + textWidth / 2] }[side];
		left = Math.min(left, x - DOT_RADIUS * u, from);
		right = Math.max(right, x + DOT_RADIUS * u, to);
		top = Math.min(top, y - DOT_RADIUS * u, ly - TEXT_ABOVE * u);
		bottom = Math.max(bottom, y + DOT_RADIUS * u, ly + TEXT_BELOW * u);
	});
	return {
		box: {
			x: left, y: top, width: right - left, height: bottom - top,
		},
		labels,
	};
};

// viewBox of the map of an outline width x height (0 to 1000 units) with these corners, u (outline units in one px, to size
// what is drawn over the outline) and where each name goes. The offsets are in px, so the box is settled with the scale it makes.
const circuitView = (width, height, corners = []) => {
	let u = 1 / Math.min(MAP_WIDTH / (width + 2 * MARGIN), MAP_HEIGHT / (height + 2 * MARGIN));
	let { box, labels } = layout(width, height, corners, u);
	for (let i = 0; i < 50; i += 1) {
		u = Math.max(box.width / MAP_WIDTH, box.height / MAP_HEIGHT);
		({ box, labels } = layout(width, height, corners, u));
	}
	return { ...box, u, labels };
};

// the outline as a lap in the way of the race (reverse: it is drawn the other way round): lap.at(distance) is the point
// `distance` outline units from its first point, with the unit vector of the way it is going there; the lap closes on itself
const lapOf = (path, reverse = false) => {
	const points = path.split(' ').map((point) => point.split(',').map(Number));
	if (reverse) points.reverse();
	const lengths = [0];
	for (let i = 1; i < points.length; i += 1) {
		lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
	}
	const total = lengths.at(-1);
	const at = (distance) => {
		const d = ((distance % total) + total) % total;
		let i = lengths.findIndex((length) => length >= d);
		if (i <= 0) i = 1;
		const [ax, ay] = points[i - 1];
		const [bx, by] = points[i];
		const segment = lengths[i] - lengths[i - 1] || 1;
		const share = (d - lengths[i - 1]) / segment;
		return {
			x: ax + (bx - ax) * share, y: ay + (by - ay) * share, ux: (bx - ax) / segment, uy: (by - ay) / segment,
		};
	};
	return { at, total };
};

export {
	circuitView, lapOf, DOT_RADIUS, LETTER_WIDTH, TEXT_ABOVE, TEXT_BELOW,
};
