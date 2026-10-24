// What the F1 Next Race map adds to the outline of a circuit (utils/f1-circuits.mjs), keyed by the same Jolpica circuitId:
// the lap record, where the start line is and the named corners. Written by hand, no accents (the Star4000 fonts cannot draw them).
// - record: the fastest lap set in a race, as in the infobox of the Wikipedia article of the circuit; check it each season.
// - reverse: the outline runs against the way of the race (it is drawn from its first point the other way round).
// - start: where the start line is, as a share of the lap from the first point of the outline (in the way of the race).
//   The outline does not start on the line: its first point is anywhere on the lap.
// - corners: [name, x, y, side, dx, dy]. x and y are a point of the outline (0 to 1000); the name starts ('r'), ends ('l')
//   or is centred ('m') dx and dy px from the dot. Only corners and sections that have a name are marked, never a bare number.
// The start line, the way of the race and each corner were checked against the real positions of the circuit (the outlines
// agree with them to 2 to 9 m); a circuit with no start has not been checked and only gets its lap record.
const FACTS = {
	albert_park: {
		record: { time: '1:19.813', driver: 'Leclerc', year: 2024 },
		start: 0.0244,
	},
	americas: {
		record: { time: '1:36.169', driver: 'Leclerc', year: 2019 },
		start: 0.9422,
	},
	baku: {
		record: { time: '1:43.009', driver: 'Leclerc', year: 2019 },
		reverse: true,
		start: 0.5484,
	},
	catalunya: {
		record: { time: '1:15.743', driver: 'Piastri', year: 2025 },
		start: 0.9714,
	},
	hungaroring: {
		record: { time: '1:16.627', driver: 'Hamilton', year: 2020 },
		start: 0.8950,
	},
	interlagos: {
		record: { time: '1:10.540', driver: 'Bottas', year: 2018 },
		start: 0.9854,
		corners: [
			['Senna S', 228, 955, 'l', -9, 5],
		],
	},
	jeddah: {
		record: { time: '1:30.734', driver: 'Hamilton', year: 2021 },
		start: 0.1629,
	},
	losail: {
		record: { time: '1:22.384', driver: 'Norris', year: 2024 },
		start: 0.1720,
	},
	madring: {
		record: { time: '1:35.587', driver: 'Russell', year: 2026 },
	},
	marina_bay: {
		record: { time: '1:33.808', driver: 'Hamilton', year: 2025 },
		reverse: true,
		start: 0.9051,
	},
	miami: {
		record: { time: '1:29.708', driver: 'Verstappen', year: 2023 },
		reverse: true,
		start: 0.0103,
	},
	monaco: {
		record: { time: '1:12.909', driver: 'Hamilton', year: 2021 },
		reverse: true,
		start: 0.7063,
		corners: [
			['Ste Devote', 723, 223, 'r', 9, 5],
			['Hairpin', 405, 377, 'r', 9, -8],
			['Portier', 328, 408, 'l', -9, 5],
			['Chicane', 64, 919, 'l', -9, 5],
			['Tabac', 111, 904, 'r', 9, 5],
			['Piscine', 89, 721, 'l', -9, 5],
			['Rascasse', 200, 479, 'l', -9, 5],
		],
	},
	monza: {
		record: { time: '1:20.901', driver: 'Norris', year: 2025 },
		start: 0.9646,
		corners: [
			['Rettifilo', 59, 320, 'l', -9, 5],
			['Curva Grande', 97, 120, 'l', -9, 5],
			['Roggia', 419, 37, 'l', -9, -6],
			['Lesmo 1', 570, 46, 'r', 9, -6],
			['Lesmo 2', 553, 166, 'r', 9, 5],
			['Ascari', 185, 488, 'l', -9, 5],
			['Parabolica', 35, 986, 'l', -9, 5],
		],
	},
	red_bull_ring: {
		record: { time: '1:07.924', driver: 'Piastri', year: 2025 },
		start: 0.9766,
	},
	rodriguez: {
		record: { time: '1:17.774', driver: 'Bottas', year: 2021 },
		start: 0.9252,
		corners: [
			['Foro Sol', 184, 211, 'l', -9, 5],
			['Peraltada', 123, 96, 'l', -9, -12],
		],
	},
	sepang: {
		record: { time: '1:34.080', driver: 'Vettel', year: 2017 },
	},
	shanghai: {
		record: { time: '1:32.238', driver: 'Schumacher', year: 2004 },
		start: 0.9296,
	},
	silverstone: {
		record: { time: '1:27.097', driver: 'Verstappen', year: 2020 },
		start: 0.5050,
		corners: [
			['Abbey', 161, 526, 'l', -9, 5],
			['Village', 408, 432, 'r', 9, 5],
			['Brooklands', 221, 120, 'l', -9, 5],
			['Luffield', 149, 202, 'l', -9, 5],
			['Copse', 465, 0, 'r', 9, 5],
			['Chapel', 563, 562, 'r', 9, 5],
			['Stowe', 292, 988, 'l', -9, 5],
			['Club', 82, 804, 'l', -9, 5],
		],
	},
	spa: {
		record: { time: '1:44.701', driver: 'Perez', year: 2024 },
		start: 0.9957,
		corners: [
			['La Source', 135, 1, 'l', -9, 5],
			['Eau Rouge', 364, 191, 'r', 9, 5],
			['Les Combes', 616, 803, 'r', 9, 5],
			['Malmedy', 599, 892, 'r', 9, 5],
			['Rivage', 496, 924, 'l', -9, 16],
			['Pouhon', 416, 650, 'r', 9, 5],
			['Fagnes', 234, 852, 'r', 9, 16],
			['Stavelot', 170, 838, 'l', -9, -6],
			['Blanchimont', 284, 539, 'l', -9, 5],
			['Bus Stop', 245, 251, 'l', -9, 5],
		],
	},
	suzuka: {
		record: { time: '1:30.965', driver: 'Antonelli', year: 2025 },
		start: 0.9707,
		corners: [
			['Dunlop', 695, 209, 'r', 9, -8],
			['Hairpin', 376, 85, 'l', -9, 5],
			['Spoon', 45, 2, 'l', -9, 5],
			['130R', 461, 247, 'l', -9, 14],
		],
	},
	vegas: {
		record: { time: '1:33.365', driver: 'Verstappen', year: 2025 },
		start: 0.9850,
	},
	villeneuve: {
		record: { time: '1:13.078', driver: 'Bottas', year: 2019 },
		start: 0.9259,
		corners: [
			['Wall of Champions', 210, 336, 'r', 9, 5],
		],
	},
	yas_marina: {
		record: { time: '1:25.637', driver: 'Magnussen', year: 2024 },
		start: 0.4014,
	},
	zandvoort: {
		record: { time: '1:11.097', driver: 'Hamilton', year: 2021 },
		start: 0.0904,
		corners: [
			['Tarzan', 281, 310, 'l', -9, 5],
			['Hugenholtz', 491, 398, 'l', -9, 5],
			['Luyendyk', 78, 496, 'l', -9, 5],
		],
	},
	portimao: {
		record: { time: '1:18.750', driver: 'Hamilton', year: 2020 },
	},
	istanbul: {
		record: { time: '1:24.770', driver: 'Montoya', year: 2005 },
	},
	bahrain: {
		record: { time: '1:31.447', driver: 'De la Rosa', year: 2005 },
		start: 0.7365,
	},
};

export default FACTS;
