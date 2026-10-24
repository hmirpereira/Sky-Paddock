// GT World: logos shown instead of the team name (always on).
// Only logos supplied by the owner go here (for now only Verstappen's team): put the SVG or PNG in server/images/gt-teams/ and add a line.
// 'match' is tested against the team name of the official site (e.g. "Mercedes-AMG Team Verstappen Racing").
const GT_TEAM_LOGOS = [
	{ match: /verstappen/i, file: 'verstappen-racing.svg' },
];

const gtTeamLogo = (team) => GT_TEAM_LOGOS.find((logo) => logo.match.test(team ?? ''))?.file;

export default gtTeamLogo;
