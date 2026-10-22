// Raises the version in package.json and in the two places of package-lock.json, and prints it.
//   node .claude/skills/publicar/bump.mjs patch|minor|<x.y.z>
// Run from the project root. patch: last number (fixes); minor: middle number, last back to 0 (features).
import { readFileSync, writeFileSync } from 'node:fs';

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const write = (file, data) => writeFileSync(file, `${JSON.stringify(data, null, '\t')}\n`);

const pkg = read('package.json');
const lock = read('package-lock.json');
const [major, minor, patch] = pkg.version.split('.').map(Number);
const arg = process.argv[2];
let next;
if (arg === 'patch') next = `${major}.${minor}.${patch + 1}`;
else if (arg === 'minor') next = `${major}.${minor + 1}.0`;
else if (/^\d+\.\d+\.\d+$/.test(arg ?? '')) next = arg;
else {
	console.error('usage: node .claude/skills/publicar/bump.mjs patch|minor|<x.y.z>');
	process.exit(1);
}

if (lock.version !== pkg.version || lock.packages?.[''].version !== pkg.version) {
	console.error(`package.json (${pkg.version}) and package-lock.json (${lock.version}, ${lock.packages?.[''].version}) disagree: fix by hand first`);
	process.exit(1);
}
pkg.version = next;
lock.version = next;
lock.packages[''].version = next;
write('package.json', pkg);
write('package-lock.json', lock);
console.log(next);
