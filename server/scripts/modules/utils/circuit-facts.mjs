// What the F1 Next Race map adds to the outline of a circuit (utils/f1-circuits.mjs), keyed by the same Jolpica circuitId:
// the lap record and the corner names with where to put them. Written by hand, no accents (the Star4000 fonts cannot draw them).
// Lap record: the fastest lap set in a race, as in the infobox of the Wikipedia article of the circuit; check it each season.
// Corner names: Wikipedia and the circuit's own map. A corner is [name, x, y, labelX, labelY, side]: x and y are on the outline
// (the same 0 to 1000 space as its path), the label sits at labelX, labelY and 'l' ends at that point, 'r' starts there.
// Circuits without an entry keep the plain outline.
const FACTS = {
	spa: {
		record: { time: '1:44.701', driver: 'Perez', year: 2024 },
		corners: [
			['La Source', 133, 2, 165, -12, 'r'],
			['Eau Rouge', 395, 220, 440, 205, 'r'],
			['Les Combes', 604, 813, 640, 790, 'r'],
			['Malmedy', 597, 903, 625, 900, 'r'],
			['Rivage', 440, 993, 410, 1000, 'l'],
			['Pouhon', 382, 647, 330, 625, 'r'],
			['Fagnes', 162, 840, 60, 800, 'r'],
			['Stavelot', 15, 901, -20, 900, 'l'],
			['Blanchimont', 258, 599, 225, 590, 'l'],
			['Bus Stop', 250, 251, 215, 250, 'l'],
		],
	},
};

export default FACTS;
