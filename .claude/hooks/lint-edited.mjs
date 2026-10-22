// PostToolUse hook (Edit, Write, MultiEdit): lints the .mjs file Claude just changed under server/scripts/,
// with the same ESLint config as `npm run lint`, so an error is seen at once and not at the next commit.
// Exit 2 sends ESLint's output back to Claude; anything else is silent.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
	let file;
	try {
		file = JSON.parse(input).tool_input?.file_path;
	} catch {
		process.exit(0);
	}
	const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
	const relative = file ? path.relative(root, path.resolve(root, file)).split(path.sep).join('/') : '';
	// the same files `npm run lint` checks (vendor is in .eslintignore)
	if (!/^server\/scripts\/.+\.mjs$/.test(relative) || relative.startsWith('server/scripts/vendor/')) process.exit(0);
	const eslint = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
	if (!existsSync(eslint) || !existsSync(path.join(root, relative))) process.exit(0);
	const result = spawnSync(process.execPath, [eslint, relative], { cwd: root, encoding: 'utf8' });
	if (result.status === 0) process.exit(0);
	console.error(`ESLint: ${relative}\n${result.stdout}${result.stderr}`.trim());
	process.exit(2);
});
