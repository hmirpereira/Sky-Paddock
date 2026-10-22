---
name: publicar
description: Publish a new Sky Paddock version (version bump, README, LOGBOOK, lint, build, tests, commit, push, wait for the Publish site workflow, confirm the version on the site, optionally restart the TV). Use only when the owner asks to publish a version.
disable-model-invocation: true
---

# Publish a Sky Paddock version

Follows "Publicar uma versão" in `CLAUDE.local.md` (the Pi host, the project folder and the commands live there:
read it, do not copy them here: this repository is public). Reply to the owner in European Portuguese, as
`CLAUDE.local.md` says. Do the steps in order; stop and report if one fails. Never skip a step to save time.

## 1. Look before touching

- `git status`, `git diff --stat`, `git fetch`, and `git status -sb`: must be on `main`, not behind `origin/main`.
- Read the current version in `package.json`. Do not change anything yet.
- Decide the new version (`CLAUDE.md`, Rules): last number for fixes, middle number for new screens or features.
  When in doubt, say which you chose and why.

## 2. Prepare

1. `node .claude/skills/publicar/bump.mjs patch` (or `minor`, or an exact `x.y.z`). It changes `package.json` and both
   version fields of `package-lock.json` and prints the new version.
2. `README.md`: update what the change affects (it describes every screen and option). English.
3. `LOGBOOK.md` in the project folder: a new entry at the top of `## Histórico`, in Portuguese:
   `- **<today>:** versão <x.y.z>. <what changed, why, what was tested>`; update the "última atualização" date near the top.

## 3. Check

- `npm run lint`, `npm run build`, `npm test` (all three must pass; never push a red build).
- If a screen asked for new data, `npm run test:record` first and look at the statuses in `tests/recorded/recorded.json`.
- If something visible changed, `SCREENSHOTS=1 npm test` and show the owner the pictures (16:9 and 4:3): the owner decides how it looks.

## 4. Ask once, then publish

Show the owner: the list of changed files, the commit message (English, `<x.y.z>: summary`, a short bullet list, and the
attribution line the session gives for commits), and ask in one question: publish now, and restart the TV afterwards?
Wait for the answer. Then:

- `git add` the files by name (never `git add -A`: the repository is public; no personal data, keys or coordinates) and commit.
- `git push origin main`.

## 5. Wait and confirm

- Poll the Publish site run for the pushed commit until it is `completed`:
  `https://api.github.com/repos/hmirpereira/Sky-Paddock/actions/runs?head_sha=<sha>` (no `gh` on this machine). A failed run:
  stop, read why, do not retry blindly.
- Confirm the version on the site: `https://hmirpereira.github.io/Sky-Paddock/` contains `id="version-mark">v<x.y.z>`.
  The site shows the commit date, so it must be the one of this commit.

## 6. The Pi

- If `skypaddock-hub.py` (project folder) changed in this version, install it with the commands in `CLAUDE.local.md` and
  show `--status` (or `--news`, `--f1jet`...) afterwards. Never read `/etc/skypaddock-hub.conf`.
- If the owner said yes to the TV: restart the page with the command in `CLAUDE.local.md`, wait about 90 s and check the
  heartbeat (`skypaddock-hub --kiosk`: `lastBeat` recent). That only proves the page is alive: say so, do not claim what
  the screen shows.

## 7. Report

Short, in European Portuguese: version and commit, whether the Actions run passed, the version seen on the site, what was
done on the Pi, and clearly what was verified, what was inferred and what was not checked.
