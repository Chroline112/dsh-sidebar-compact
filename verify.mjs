import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(manifest.name, 'dsh-sidebar-compact');
assert.equal(manifest.version, '1.3.3');
for (const entry of ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg', 'LICENSE', 'README.md']) {
  assert.ok(existsSync(path.join(root, entry)), `missing ${entry}`);
}
const en = JSON.parse(readFileSync(path.join(root, 'locale/en.json'), 'utf8'));
const zh = JSON.parse(readFileSync(path.join(root, 'locale/zh.json'), 'utf8'));
assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
assert.ok(en.meta.title && en.meta.description && zh.meta.title && zh.meta.description);
assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
assert.equal(manifest.exports['./client'], './client.js');
assert.equal(manifest.exports['./icon'], './icon.svg');

const source = readFileSync(path.join(root, 'client.js'), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('    function moduleClass(name)');
const end = source.indexOf('    function WorkspaceDensityStyles(', start);
assert.ok(start >= 0 && end > start);
// Exercise only the pure CSS string generator; no React or DOM emulation.
const { workspaceDensityCss } = runInNewContext(source.slice(start, end) + '\n({ workspaceDensityCss });');
const levels = ['standard', 'medium', 'compact'];
const heights = { medium: 28, compact: 26 };
for (const project of levels) {
  for (const session of levels) {
    const css = workspaceDensityCss(project, session);
    if (project === 'standard' && session === 'standard') assert.equal(css, '');
    assert.equal(css.includes('_projectRow'), project !== 'standard');
    assert.equal(css.includes('_sessionRow'), session !== 'standard');
    if (project !== 'standard') {
      const projectRule = css.split('\n').find(rule => rule.includes('_projectRow'));
      assert.ok(projectRule.endsWith(`{ height: ${heights[project]}px !important; }`));
    }
    if (session !== 'standard') {
      const sessionRule = css.split('\n').find(rule => rule.includes('_sessionRow'));
      assert.ok(sessionRule.endsWith(`{ height: ${heights[session]}px !important; }`));
      assert.ok(css.includes(`line-height: ${session === 'medium' ? 20 : 18}px !important;`));
    }
    for (const rule of css.split('\n').filter(Boolean)) {
      assert.ok(rule.startsWith('[data-slot="sidebar.workspaces"] '));
    }
  }
}
for (const key of [
  'dsh.sidebar-compact.collapse-workspaces.v1',
  'dsh.sidebar-compact.show-update.v1',
  'dsh.sidebar-compact.project-spacing.v1',
  'dsh.sidebar-compact.session-density.v1',
]) {
  assert.ok(source.includes(key), `preference changed: ${key}`);
}
assert.ok(!/YDXeBa_|wnFoaW_|bhn1Oq_|GAkraW_|DOUpOa_|VUhOWa_/.test(source));
// Exercise the actual preference stores and render gates without a browser.
const stored = new Map();
let factory;
const window = {
  localStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
  __ModuleLoader__: { load: definition => { factory = definition.factory; } },
};
const exposed = source.replace("    return {\n      inject: ['slots', 'layout', 'locale'],", `    window.test = { createBooleanPreference, createDensityPreference, WorkspaceDensityStyles, NavigationFeature, UpdateVisibilityStyles, SidebarPreferences, cssString, CompactPanelStyles, collapseWorkspaceGroups };
    return {
      inject: ['slots', 'layout', 'locale'],`);
runInNewContext(exposed, { window, console });
const plugin = factory(() => ({ createElement: (type, props, ...children) => ({ type, props, children }) }));
const api = window.test;
assert.ok(api, 'test instrumentation must match the plugin factory');
for (const key of ['collapse-workspaces', 'navigation', 'project-enabled', 'session-enabled']) {
  assert.equal(api.createBooleanPreference(`dsh.sidebar-compact.${key}.v1`).getSnapshot(), false);
}
assert.equal(api.createBooleanPreference('dsh.sidebar-compact.show-update.v1', true).getSnapshot(), true);
assert.equal(api.createDensityPreference('density').getSnapshot(), 'standard');
stored.set('density', 'compact');
assert.equal(api.createDensityPreference('density').getSnapshot(), 'compact');
stored.set('saved-boolean', 'true');
const preference = api.createBooleanPreference('saved-boolean');
assert.equal(preference.getSnapshot(), true);
let notifications = 0;
const unsubscribe = preference.subscribe(() => notifications++);
preference.set(false);
assert.equal(stored.get('saved-boolean'), 'false');
assert.equal(notifications, 1);
preference.set(false);
assert.equal(notifications, 1);
stored.set('saved-boolean', 'true');
preference.onStorage({ key: 'saved-boolean' });
assert.equal(preference.getSnapshot(), true);
assert.equal(notifications, 2);
unsubscribe();
const hook = value => select => select(value);
const densityProps = { useProjectSpacing: hook('compact'), useSessionDensity: hook('medium') };
for (const project of [false, true]) {
  for (const session of [false, true]) {
    const element = api.WorkspaceDensityStyles({ ...densityProps, useProjectEnabled: hook(project), useSessionEnabled: hook(session) });
    if (!project && !session) assert.equal(element, null, 'disabled overrides must emit no CSS even with saved density');
    else {
      assert.equal(element.children[0].includes('_projectRow'), project);
      assert.equal(element.children[0].includes('_sessionRow'), session);
    }
  }
}
const component = () => {};
assert.equal(api.NavigationFeature({ useNavigationEnabled: hook(false), component }), null);
assert.equal(api.NavigationFeature({ useNavigationEnabled: hook(true), component }).type, component);
assert.equal(api.UpdateVisibilityStyles({ useUpdateVisible: hook(true) }), null);
assert.equal(api.UpdateVisibilityStyles({ useUpdateVisible: hook(false) }).type, 'style');
// Restore mixed expansion states, including groups expanded by default.
let workspaceState = { groupBy: 'workspace', groupExpansion: { a: true, b: false } };
const workspaceView = {
  getSnapshot: () => workspaceState,
  actions: { setGroupExpanded(key, expanded) {
    workspaceState = { ...workspaceState, groupExpansion: { ...workspaceState.groupExpansion, [key]: expanded } };
  } },
};
api.collapseWorkspaceGroups(workspaceView, ['a', 'b', 'c']);
for (const key of ['', 'a', 'b', 'c']) assert.equal(workspaceState.groupExpansion[key], false);
workspaceView.actions.setGroupExpanded('b', true);
workspaceView.actions.setGroupExpanded('new', true);
api.collapseWorkspaceGroups(workspaceView, ['a', 'b', 'c', 'new']);
assert.equal(workspaceState.groupExpansion.a, true);
assert.equal(workspaceState.groupExpansion.b, false, 'originally closed project stays closed');
assert.equal(workspaceState.groupExpansion.c, true, 'implicit expanded state is restored');
assert.equal(workspaceState.groupExpansion[''], true);
assert.equal(workspaceState.groupExpansion.new, true, 'new project retains current state');
api.collapseWorkspaceGroups(workspaceView, ['a', 'b', 'c', 'new']);
api.collapseWorkspaceGroups(workspaceView, ['a', 'b', 'c', 'new']);
assert.equal(workspaceState.groupExpansion.b, false, 'repeated cycles retain mixed states');
workspaceState = { groupBy: 'flat', groupExpansion: {} };
api.collapseWorkspaceGroups(workspaceView, ['a']);
assert.deepEqual(workspaceState.groupExpansion, {}, 'flat view remains unchanged');
workspaceState = { groupBy: 'workspace', groupExpansion: { a: false, b: false, '': false } };
api.collapseWorkspaceGroups(workspaceView, ['a', 'b']);
api.collapseWorkspaceGroups(workspaceView, ['a', 'b']);
assert.equal(workspaceState.groupExpansion.a, false, 'all-closed state remains closed');
// Simulate slot lifecycles for both native sidebar generations and replaced themes.
window.addEventListener = () => {};
window.removeEventListener = () => {};
function verifyNavigation(mode) {
  stored.clear();
  const active = new Map();
  const cleanup = [];
  let reads = 0;
  const selected = [];
  const panels = { getSnapshot: () => [{ id: 'dsh-market', label: 'Marketplace' }, { id: 'plugins', label: 'Plugins' }], subscribe: () => () => {} };
  const original = {
    children: { 'sidebar.panellist': true, ...(mode === 'modern' ? { 'sidebar.panellist.actions': true } : {}) },
    inject() { reads++; return mode === 'missing-source' ? {} : { hooks: { panels } }; },
  };
  plugin.apply({
    locale: { register: () => () => {} },
    effect(effect) { cleanup.push(effect()); },
    layout: { selectPanel: id => selected.push(id) },
    slots: {
      entriesOfSlot: name => name === 'sidebar' && mode !== 'missing-owner' ? [original] : [],
      inject(name, effect) {
        const dispose = name === 'sidebar.workspaces.session.row.action' ? undefined : effect();
        const stop = () => dispose?.();
        cleanup.push(stop);
        return stop;
      },
      register(entry) {
        const id = entry.id || entry.key;
        active.set(id, entry);
        return () => active.delete(id);
      },
    },
  });
  assert.equal(reads, 0, 'disabled navigation must never access a theme panel source');
  const config = active.get('dsh-sidebar-compact').inject();
  config.setNavigationEnabled(true);
  const available = mode === 'legacy' || mode === 'modern';
  assert.equal(active.has('compact-panel-styles'), available);
  assert.equal(active.has('compact-legacy-more'), mode === 'legacy');
  assert.equal(active.has('compact-other-panels'), mode === 'modern');
  if (available) {
    const menu = active.get(mode === 'legacy' ? 'compact-legacy-more' : 'compact-other-panels').inject();
    assert.equal(menu.hooks.otherPanels.getSnapshot().length, 1);
    menu.openPanel('plugins');
    menu.openPanel('dsh-market');
    assert.deepEqual(selected, ['plugins']);
  }
  config.setNavigationEnabled(false);
  assert.equal(active.has('compact-panel-styles'), false);
  assert.equal(active.has('compact-legacy-more'), false);
  assert.equal(active.has('compact-other-panels'), false);
  config.setNavigationEnabled(true);
  assert.equal(active.has('compact-panel-styles'), available, 're-enable must restore supported navigation');
  for (const dispose of cleanup.reverse()) dispose?.();
  assert.equal(active.size, 0, 'unload must remove all registrations');
}
for (const mode of ['legacy', 'modern', 'missing-owner', 'missing-source']) verifyNavigation(mode);
const css = api.CompactPanelStyles({ usePanels: hook([{ id: 'plugins', label: 'Plugins' }]), legacyMore: true, t: () => 'Panels' }).children[0];
assert.ok(css.includes('[data-slot="sidebar"] nav'));
assert.ok(css.includes('@supports selector(:has(*))'));
assert.ok(css.includes('and (position-visibility: anchors-visible)'));
console.log('PASS: manifest, exports, locales, nine density combinations, neutral defaults, saved preferences, subscriptions, render gates, legacy/modern navigation lifecycle, replaced themes and CSS capability guards.');
