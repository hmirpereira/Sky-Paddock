// Tabs of the side column of the page (views/index.ejs: .panel-tabs and the sections with data-tab-panel).
// The chosen tab is remembered in this browser only; without storage the page opens on Screens.
const KEY = 'panelTab';

const show = (name) => {
	document.querySelectorAll('.panel-tabs [data-tab]').forEach((button) => {
		const on = button.dataset.tab === name;
		button.classList.toggle('active', on);
		button.setAttribute('aria-selected', String(on));
	});
	document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
		panel.hidden = panel.dataset.tabPanel !== name;
	});
};

document.addEventListener('DOMContentLoaded', () => {
	const tabs = document.querySelector('.panel-tabs');
	if (!tabs) return;
	let saved = null;
	try { saved = localStorage.getItem(KEY); } catch { /* storage blocked */ }
	show(tabs.querySelector(`[data-tab="${saved}"]`) ? saved : 'screens');
	tabs.addEventListener('click', (event) => {
		const name = event.target.closest('[data-tab]')?.dataset.tab;
		if (!name) return;
		show(name);
		try { localStorage.setItem(KEY, name); } catch { /* storage blocked */ }
	});
});
