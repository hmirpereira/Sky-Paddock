// What the F1 Next Race map adds to the outline of a circuit (utils/f1-circuits.mjs), keyed by the same Jolpica circuitId:
// the lap record and the named corners. Written by hand, no accents (the Star4000 fonts cannot draw them).
// - record: the fastest lap set in a race, as in the infobox of the Wikipedia article of the circuit; check it each season.
// - corners: a corner is [name, x, y, side, dx, dy]. x and y are a point of the outline (its path, 0 to 1000); the name starts
//   ('r'), ends ('l') or is centred ('m') dx and dy px from the dot. Names are the ones of the Wikipedia article of the circuit; where there is
//   no well known name the number of the corner (T1) is used. Which corner sits at which point of the outline was worked out by
//   hand from the shape and the distance along the lap, so it is a good guess and not an official map: check it on the screen.
// - reverse: the outline of the circuit runs against the way of the race (utils/circuit-view.mjs and f1nextrace.mjs flip it).
// The outline of every circuit here starts on the start line (and runs the way of the race, apart from the reversed ones).
const FACTS = {
	albert_park: {
		record: { time: '1:19.813', driver: 'Leclerc', year: 2024 },
		corners: [
			['T1', 192, 599, 'm', 0, 17],
		],
	},
	americas: {
		record: { time: '1:36.169', driver: 'Leclerc', year: 2019 },
		corners: [
			['T1', 348, 573, 'm', 0, 17],
			['T11', 999, 5, 'm', 0, -9],
			['T12', 359, 134, 'm', 0, -9],
			['T20', 0, 306, 'm', 0, 17],
		],
	},
	baku: {
		record: { time: '1:43.009', driver: 'Leclerc', year: 2019 },
		corners: [
			['T1', 1000, 144, 'm', 0, -9],
		],
	},
	catalunya: {
		record: { time: '1:15.743', driver: 'Piastri', year: 2025 },
		corners: [
			['T1', 333, 942, 'm', 0, 17],
		],
	},
	hungaroring: {
		record: { time: '1:16.627', driver: 'Hamilton', year: 2020 },
		corners: [
			['T1', 4, 554, 'm', 0, 17],
		],
	},
	interlagos: {
		record: { time: '1:10.540', driver: 'Bottas', year: 2018 },
		corners: [
			['Senna S', 149, 996, 'l', -9, 5],
		],
	},
	jeddah: {
		record: { time: '1:30.734', driver: 'Hamilton', year: 2021 },
		corners: [
			['T1', 87, 621, 'm', 0, 17],
		],
	},
	losail: {
		record: { time: '1:22.384', driver: 'Norris', year: 2024 },
		corners: [
			['T1', 0, 325, 'm', 0, -9],
		],
	},
	madring: {
		record: { time: '1:35.587', driver: 'Russell', year: 2026 },
		corners: [
			['T1', 283, 990, 'm', 0, 17],
		],
	},
	marina_bay: {
		record: { time: '1:33.808', driver: 'Hamilton', year: 2025 },
		reverse: true,
		corners: [
			['T1', 950, 41, 'm', 0, -9],
		],
	},
	miami: {
		record: { time: '1:29.708', driver: 'Verstappen', year: 2023 },
		corners: [
			['T1', 632, 203, 'm', 0, 17],
		],
	},
	monaco: {
		record: { time: '1:12.909', driver: 'Hamilton', year: 2021 },
		corners: [
			['Sainte Devote', 618, 3, 'l', -9, -6],
			['Grand Hotel', 326, 472, 'r', 9, -8],
			['Portier', 79, 502, 'l', -9, 18],
			['Chicane', 100, 810, 'l', -9, 5],
			['Tabac', 188, 978, 'r', 9, 5],
			['Swimming Pool', 110, 999, 'l', -9, 5],
			['Rascasse', 21, 477, 'l', -9, -8],
		],
	},
	monza: {
		record: { time: '1:20.901', driver: 'Norris', year: 2025 },
		corners: [
			['Rettifilo', 47, 349, 'l', -9, 5],
			['Curva Grande', 71, 152, 'l', -9, 5],
			['Roggia', 386, 57, 'l', -9, -10],
			['Lesmo 1', 558, 9, 'r', 9, 5],
			['Lesmo 2', 578, 148, 'r', 9, 5],
			['Ascari', 185, 489, 'l', -9, 5],
			['Parabolica', 44, 992, 'l', -9, 5],
		],
	},
	red_bull_ring: {
		record: { time: '1:07.924', driver: 'Piastri', year: 2025 },
		corners: [
			['T1', 415, 631, 'm', 0, 17],
			['T3', 635, 70, 'm', 0, -9],
		],
	},
	rodriguez: {
		record: { time: '1:17.774', driver: 'Bottas', year: 2021 },
		corners: [
			['T1', 976, 136, 'm', 0, -9],
			['Foro Sol', 107, 81, 'l', -6, 22],
			['Peraltada', 3, 65, 'l', -9, -2],
		],
	},
	sepang: {
		record: { time: '1:34.080', driver: 'Vettel', year: 2017 },
		corners: [
			['T1', 23, 463, 'm', 0, 17],
		],
	},
	shanghai: {
		record: { time: '1:32.238', driver: 'Schumacher', year: 2004 },
		corners: [
			['T1', 122, 788, 'm', 0, 17],
			['T6', 4, 299, 'm', 0, -9],
			['T14', 1000, 871, 'm', 0, 17],
		],
	},
	silverstone: {
		record: { time: '1:27.097', driver: 'Verstappen', year: 2020 },
		corners: [
			['Abbey', 520, 26, 'r', 9, 5],
			['Village', 598, 508, 'r', 9, 5],
			['Brooklands', 244, 996, 'l', -9, 5],
			['Luffield', 83, 803, 'l', -9, 5],
			['Copse', 189, 496, 'l', -9, 5],
			['Chapel', 475, 487, 'l', -6, 20],
			['Stowe', 205, 115, 'r', 9, -4],
			['Club', 106, 164, 'l', -9, 5],
		],
	},
	spa: {
		record: { time: '1:44.701', driver: 'Perez', year: 2024 },
		corners: [
			['La Source', 133, 2, 'l', -9, 5],
			['Eau Rouge', 410, 226, 'r', 9, 5],
			['Les Combes', 594, 823, 'r', 9, 5],
			['Malmedy', 597, 903, 'r', 9, 5],
			['Rivage', 440, 993, 'l', -9, 14],
			['Pouhon', 382, 647, 'r', 10, -8],
			['Fagnes', 162, 840, 'l', -9, 5],
			['Stavelot', 15, 901, 'l', -9, 5],
			['Blanchimont', 258, 599, 'l', -9, 5],
			['Bus Stop', 261, 251, 'l', -9, 5],
		],
	},
	suzuka: {
		record: { time: '1:30.965', driver: 'Antonelli', year: 2025 },
		corners: [
			['Dunlop', 714, 332, 'r', 9, 14],
			['Hairpin', 424, 297, 'l', -9, 5],
			['Spoon', 7, 15, 'l', -9, 5],
			['130R', 603, 140, 'r', 9, -8],
		],
	},
	vegas: {
		record: { time: '1:33.365', driver: 'Verstappen', year: 2025 },
		corners: [
			['T1', 580, 821, 'm', 0, 17],
		],
	},
	villeneuve: {
		record: { time: '1:13.078', driver: 'Bottas', year: 2019 },
		corners: [
			['Wall of Champions', 251, 609, 'r', 9, 5],
		],
	},
	yas_marina: {
		record: { time: '1:25.637', driver: 'Magnussen', year: 2024 },
		corners: [
			['T1', 381, 533, 'm', 0, 17],
		],
	},
	zandvoort: {
		record: { time: '1:11.097', driver: 'Hamilton', year: 2021 },
		corners: [
			['Tarzan', 327, 3, 'l', -9, -8],
			['Hugenholtz', 189, 417, 'l', -9, -14],
			['Luyendyk', 63, 832, 'l', -9, 5],
		],
	},
	portimao: {
		record: { time: '1:18.750', driver: 'Hamilton', year: 2020 },
		corners: [
			['T1', 12, 70, 'm', 0, -9],
		],
	},
	istanbul: {
		record: { time: '1:24.770', driver: 'Montoya', year: 2005 },
		corners: [
			['T1', 519, 783, 'm', 0, 17],
			['T8', 1000, 108, 'm', 0, -9],
		],
	},
	bahrain: {
		record: { time: '1:31.447', driver: 'De la Rosa', year: 2005 },
		corners: [
			['T1', 40, 1, 'm', 0, -9],
		],
	},
};

export default FACTS;
