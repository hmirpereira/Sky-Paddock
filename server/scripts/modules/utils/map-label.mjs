// where the label of a line across the track goes: beside the track, 24 px from it, on the side away from the middle of the
// box, unless that side is outside the box (the labels used to be cut off at the edge); then the other side, and if neither
// fits the label is pushed inside. The text is `size` px high, centred on x, with its baseline at y.
const placeLabel = (px, py, sx, sy, width, height, size = 16, reach = 24) => {
	const away = (px - width / 2) * sx + (py - height / 2) * sy >= 0 ? 1 : -1;
	const at = (side) => [px + sx * side * reach, py + sy * side * reach + 6];
	// room for a label of 3 characters (about 1.6 x size wide)
	const halfW = size * 0.8;
	const fits = ([x, y]) => x - halfW >= 0 && x + halfW <= width && y - size >= 0 && y <= height;
	const [first, second] = [at(away), at(-away)];
	const [x, y] = [first, second].find(fits) ?? first;
	return [Math.min(Math.max(x, halfW), width - halfW), Math.min(Math.max(y, size), height)];
};

export default placeLabel;
