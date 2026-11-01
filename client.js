window.__ModuleLoader__.load({
  id: '@112chlorine/dsh-sidebar-compact',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const MARKET = 'dsh-market';
    const EMPTY = Object.freeze([]);

    // Cache by the upstream snapshot identity so React can subscribe without loops.
    function filterSource(source, predicate) {
      let previous;
      let selected = EMPTY;
      return {
        getSnapshot() {
          const next = source.getSnapshot();
          if (next !== previous) {
            previous = next;
            selected = next.filter(predicate);
          }
          return selected;
        },
        subscribe: listener => source.subscribe(listener),
      };
    }

    function PanelIcon({ id }) {
      const paths = id === 'schedules'
        ? [h('circle', { key: 'clock', cx: 12, cy: 12, r: 9 }), h('path', { key: 'hands', d: 'M12 6v6l4 2' })]
        : id === 'plugins'
          ? [h('path', { key: 'plugin', d: 'M8 3h8v5h3a3 3 0 0 1 0 6h-3v7H8v-5H5a3 3 0 0 1 0-6h3V3Z' })]
          : [h('rect', { key: 'frame', x: 4, y: 3, width: 16, height: 18, rx: 1 }), h('path', { key: 'lines', d: 'M8 7h1m3 0h4M8 12h1m3 0h4M8 17h1m3 0h4' })];
      return h('svg', {
        width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
      }, ...paths);
    }

    function OtherPanels({ useOtherPanels, usePanelInfo, openPanel, onDismiss, t }) {
      const panels = useOtherPanels(items => items);
      const active = usePanelInfo(info => info.activePanelId);
      if (panels.length === 0) return null;
      return h(React.Fragment, null,
        h('style', null, `
          .dsh-sidebar-compact-row {
            display: flex; align-items: center; gap: 10px; width: 100%;
            min-height: 36px; box-sizing: border-box; padding: 8px 10px;
            border: 0; border-radius: 6px; background: transparent;
            color: var(--dsw-alias-label-primary); font: inherit;
            text-align: start; cursor: pointer;
          }
          .dsh-sidebar-compact-row:hover,
          .dsh-sidebar-compact-row:focus,
          .dsh-sidebar-compact-row[aria-current="page"] {
            background: var(--dsw-alias-bg-layer-2);
          }
          .dsh-sidebar-compact-row:focus-visible {
            outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px;
          }
          .dsh-sidebar-compact-row svg { flex-shrink: 0; }
          .dsh-sidebar-compact-separator {
            height: 1px; margin: 6px 4px;
            background: var(--dsw-alias-border-l1);
          }
        `),
        h('div', { role: 'group', 'aria-label': t('menuLabel') },
          ...panels.map(panel => h('button', {
            key: panel.id, type: 'button', role: 'menuitem', tabIndex: -1,
            className: 'dsh-sidebar-compact-row',
            'aria-current': panel.id === active ? 'page' : undefined,
            onClick() {
              openPanel(panel.id);
              onDismiss();
            },
          }, h(PanelIcon, { id: panel.id }), h('span', null, panel.label))),
        ),
        h('div', { className: 'dsh-sidebar-compact-separator', role: 'separator' }),
      );
    }

    function cssString(value) {
      return '"' + String(value).replace(/["\\\n\r\f]/g,
        character => '\\' + character.charCodeAt(0).toString(16) + ' ') + '"';
    }

    function CompactPanelStyles({ usePanels, legacyMore, t }) {
      const panels = usePanels(items => items);
      const nav = '[data-slot="sidebar"] nav[aria-label=' + cssString(t('panels.label')) + ']';
      const css = panels.filter(panel => panel.id !== MARKET).map(panel => {
        const button = 'button[aria-label=' + cssString(panel.label) + ']:not([aria-haspopup])';
        // Cover both the direct button and a possible Tooltip wrapper.
        return nav + ' > ' + button + ' { display: none !important; }' +
          '@supports selector(:has(*)) { ' + nav + ' > :has(' + button + ') { display: none !important; } }';
      }).join('\n');
      const legacy = legacyMore ? `
        @supports (anchor-name: --dsh-compact-panel-nav) and (position-anchor: --dsh-compact-panel-nav) and (top: anchor(top)) and (width: anchor-size(width)) and (position-visibility: anchors-visible) {
          ${nav} { anchor-name: --dsh-compact-panel-nav; padding-bottom: 40px; }
        }
      ` : '';
      return h('style', { 'data-sidebar-compact': 'panel-navigation' }, css + legacy);
    }

    // rc.2 has no native More action slot. Use an additive footer control,
    // positioned in reserved nav space; never replace the native sidebar owner.
    function LegacyMoreMenu(props) {
      const { wide, t } = props;
      const [open, setOpen] = React.useState(false);
      const root = React.useRef(null);
      const trigger = React.useRef(null);
      const menu = React.useRef(null);
      const restoreFocus = () => {
        setOpen(false);
        trigger.current?.focus();
      };
      React.useEffect(() => {
        if (!open) return;
        menu.current?.querySelector('[role="menuitem"]')?.focus();
        const outside = event => {
          if (!root.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('focusin', outside);
        return () => {
          document.removeEventListener('pointerdown', outside);
          document.removeEventListener('focusin', outside);
        };
      }, [open]);
      const onKeyDown = event => {
        if (event.key === 'Escape') {
          event.preventDefault(); event.stopPropagation(); restoreFocus();
        } else if (event.key === 'Tab') {
          setOpen(false);
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          if (!open) { setOpen(true); return; }
          const items = Array.from(menu.current?.querySelectorAll('[role="menuitem"]') ?? []);
          if (!items.length) return;
          const current = items.indexOf(document.activeElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
            : event.key === 'ArrowDown' ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length;
          items[next].focus();
        }
      };
      return h('div', { ref: root, className: 'dsh-sidebar-compact-legacy-more', onKeyDown },
        h('style', null, `
          .dsh-sidebar-compact-legacy-more { position: relative; }
          .dsh-sidebar-compact-more-trigger {
            display: flex; align-items: center; gap: 8px; height: 36px;
            box-sizing: border-box; padding: 0 8px; border: 0; border-radius: 6px;
            background: transparent; color: var(--dsw-alias-label-primary);
            font: inherit; font-size: 14px; text-align: start; cursor: pointer;
          }
          .dsh-sidebar-compact-more-trigger[data-wide="false"] { justify-content: center; }
          .dsh-sidebar-compact-more-trigger:hover,
          .dsh-sidebar-compact-more-trigger[aria-expanded="true"] {
            background: var(--dsw-alias-interactive-bg-hover);
          }
          .dsh-sidebar-compact-more-trigger:focus-visible {
            outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px;
          }
          .dsh-sidebar-compact-more-menu {
            position: absolute; bottom: 100%; left: 0; z-index: 100;
            box-sizing: border-box; width: 224px; max-width: calc(100vw - 16px);
            max-height: min(360px, 50vh); overflow-y: auto; padding: 4px;
            border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
            background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
            box-shadow: 0 4px 16px color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent);
          }
          .dsh-sidebar-compact-more-menu .dsh-sidebar-compact-separator { display: none; }
          @supports (anchor-name: --dsh-compact-panel-nav) and (position-anchor: --dsh-compact-panel-nav) and (top: anchor(top)) and (width: anchor-size(width)) and (position-visibility: anchors-visible) {
            .dsh-sidebar-compact-more-trigger {
              position: fixed; position-anchor: --dsh-compact-panel-nav;
              top: calc(anchor(bottom, -10000px) - 36px); left: anchor(left, -10000px);
              width: anchor-size(width, 0px); position-visibility: anchors-visible;
              anchor-name: --dsh-compact-more-trigger; z-index: 3;
            }
            .dsh-sidebar-compact-more-menu {
              position: fixed; position-anchor: --dsh-compact-more-trigger;
              top: anchor(bottom); left: anchor(left); bottom: auto;
              margin-top: 4px; position-try-fallbacks: flip-block, flip-inline;
              position-visibility: anchors-visible;
            }
          }
        `),
        h('button', {
          ref: trigger, type: 'button', className: 'dsh-sidebar-compact-more-trigger',
          'data-wide': String(wide), 'aria-label': t('more'), title: t('more'),
          'aria-haspopup': 'menu', 'aria-expanded': open,
          'aria-controls': open ? 'dsh-sidebar-compact-more-menu' : undefined,
          onClick: () => setOpen(value => !value),
        }, h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true },
          ...[5, 12, 19].map(cx => h('circle', { key: cx, cx, cy: 12, r: 1.6 }))),
          wide ? h('span', null, t('more')) : null),
        open ? h('div', {
          ref: menu, id: 'dsh-sidebar-compact-more-menu', role: 'menu',
          'aria-label': t('menuLabel'), className: 'dsh-sidebar-compact-more-menu',
        }, h(OtherPanels, { ...props, onDismiss: restoreFocus })) : null,
      );
    }

    const PREFERENCE_KEY = 'dsh.sidebar-compact.collapse-workspaces.v1';
    const UPDATE_PREFERENCE_KEY = 'dsh.sidebar-compact.show-update.v1';
    const PROJECT_SPACING_KEY = 'dsh.sidebar-compact.project-spacing.v1';
    const SESSION_DENSITY_KEY = 'dsh.sidebar-compact.session-density.v1';
    const NAVIGATION_KEY = 'dsh.sidebar-compact.navigation.v1';
    const PROJECT_ENABLED_KEY = 'dsh.sidebar-compact.project-enabled.v1';
    const SESSION_ENABLED_KEY = 'dsh.sidebar-compact.session-enabled.v1';
    const DENSITY_LEVELS = Object.freeze(['standard', 'medium', 'compact']);

    function createBooleanPreference(preferenceKey = PREFERENCE_KEY, defaultValue = false) {
      let enabled = defaultValue;
      const listeners = new Set();
      function readStored() {
        try {
          const stored = window.localStorage.getItem(preferenceKey);
          return stored === null ? defaultValue : stored === 'true';
        }
        catch { return enabled; }
      }
      enabled = readStored();
      const publish = next => {
        if (enabled === next) return;
        enabled = next;
        for (const listener of listeners) listener();
      };
      return {
        getSnapshot: () => enabled,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        set(next) {
          try { window.localStorage.setItem(preferenceKey, String(next)); }
          catch (error) { console.warn('Compact Sidebar: preference could not be saved.', error); }
          publish(next);
        },
        onStorage(event) {
          if (event.key === preferenceKey || event.key === null) publish(readStored());
        },
      };
    }

    function createDensityPreference(preferenceKey) {
      let value = 'standard';
      const listeners = new Set();
      function readStored() {
        try {
          const stored = window.localStorage.getItem(preferenceKey);
          return DENSITY_LEVELS.includes(stored) ? stored : 'standard';
        } catch { return value; }
      }
      value = readStored();
      const publish = next => {
        if (value === next) return;
        value = next;
        for (const listener of listeners) listener();
      };
      return {
        getSnapshot: () => value,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        set(next) {
          if (!DENSITY_LEVELS.includes(next)) return;
          try { window.localStorage.setItem(preferenceKey, next); }
          catch (error) { console.warn('Compact Sidebar: preference could not be saved.', error); }
          publish(next);
        },
        onStorage(event) {
          if (event.key === preferenceKey || event.key === null) publish(readStored());
        },
      };
    }

    // CSS Module hashes vary by build and platform. Match complete local-name
    // suffixes inside the native slot, including rows cloned for exit animations.
    function moduleClass(name) {
      return `:is([class$="_${name}"], [class*="_${name} "])`;
    }

    function workspaceDensityCss(projectSpacing, sessionDensity) {
      const scope = '[data-slot="sidebar.workspaces"] ';
      const project = moduleClass('projectRow');
      const group = moduleClass('groupSection');
      const session = moduleClass('sessionRow');
      const title = `:is(${moduleClass('title')}, ${moduleClass('renameInput')})`;
      const overflow = moduleClass('sessionOverflowButton');
      const css = [];
      if (projectSpacing === 'medium' || projectSpacing === 'compact') {
        const height = projectSpacing === 'medium' ? 28 : 26;
        const gap = projectSpacing === 'medium' ? 1 : 0;
        css.push(`${scope}${project} { height: ${height}px !important; }`);
        css.push(`${scope}${group} + ${group} { margin-top: ${gap}px !important; }`);
      }
      if (sessionDensity === 'medium' || sessionDensity === 'compact') {
        const height = sessionDensity === 'medium' ? 28 : 26;
        const lineHeight = sessionDensity === 'medium' ? 20 : 18;
        css.push(`${scope}${session} { height: ${height}px !important; }`);
        css.push(`${scope}${session} > ${title} { font-size: 13px !important; line-height: ${lineHeight}px !important; }`);
        css.push(`${scope}${session} + ${session} { margin-top: 0 !important; }`);
        css.push(`${scope}${overflow} { height: ${height}px !important; }`);
      }
      // Standard means no override, including when just one setting is standard.
      return css.join('\n');
    }

    function WorkspaceDensityStyles({ useProjectSpacing, useSessionDensity, useProjectEnabled, useSessionEnabled }) {
      const project = useProjectSpacing(value => value);
      const session = useSessionDensity(value => value);
      const projectEnabled = useProjectEnabled(value => value);
      const sessionEnabled = useSessionEnabled(value => value);
      const css = workspaceDensityCss(projectEnabled ? project : 'standard', sessionEnabled ? session : 'standard');
      return css ? h('style', { 'data-sidebar-compact': 'workspace-density' }, css) : null;
    }

    function PresetPreference({ id, label, description, value, onChange, disabled, t }) {
      return h('fieldset', {
        className: 'dsh-sidebar-compact-preset', disabled, 'aria-describedby': id + '-description',
      },
        h('legend', null, label),
        h('div', { className: 'dsh-sidebar-compact-segments' },
          ...DENSITY_LEVELS.map(level => h('label', {
            key: level, className: 'dsh-sidebar-compact-segment',
            'data-checked': String(value === level),
          },
            h('input', {
              type: 'radio', name: id, value: level, checked: value === level,
              onChange: () => onChange(level),
            }),
            h('span', null, t('density.' + level)),
          )),
        ),
        h('div', { id: id + '-description', className: 'dsh-sidebar-compact-preference-description' }, description),
      );
    }

    function DensityPreferences({ useProjectSpacing, useSessionDensity, useProjectEnabled, useSessionEnabled, setProjectSpacing, setSessionDensity, setProjectEnabled, setSessionEnabled, t }) {
      const project = useProjectSpacing(value => value);
      const session = useSessionDensity(value => value);
      const projectEnabled = useProjectEnabled(value => value);
      const sessionEnabled = useSessionEnabled(value => value);
      return h('section', {
        className: 'dsh-sidebar-compact-density', 'aria-labelledby': 'dsh-sidebar-compact-density-title',
      },
        h('style', null, `
          .dsh-sidebar-compact-density {
            margin-top: 12px; padding-top: 16px; border-top: 1px solid var(--dsw-alias-border-l1);
            color: var(--dsw-alias-label-primary);
          }
          .dsh-sidebar-compact-density h3 { margin: 0 0 16px; font-size: 14px; font-weight: 600; }
          .dsh-sidebar-compact-preset { margin: 0 0 20px; padding: 0; border: 0; min-width: 0; }
          .dsh-sidebar-compact-preset:disabled { opacity: 0.5; }
          .dsh-sidebar-compact-preset:disabled label { cursor: default; }
          .dsh-sidebar-compact-preset legend { margin-bottom: 8px; padding: 0; font-size: 14px; }
          .dsh-sidebar-compact-segments {
            display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px;
            box-sizing: border-box; max-width: 480px; padding: 3px; border-radius: 8px;
            background: var(--dsw-alias-bg-layer-1);
          }
          .dsh-sidebar-compact-segment {
            position: relative; display: flex; min-width: 0; border-radius: 5px;
            cursor: pointer; color: var(--dsw-alias-label-secondary);
          }
          .dsh-sidebar-compact-segment[data-checked="true"] {
            background: var(--dsw-alias-bg-base); color: var(--dsw-alias-brand-primary);
            box-shadow: 0 0 0 1px var(--dsw-alias-border-l1);
          }
          .dsh-sidebar-compact-segment input {
            position: absolute; width: 1px; height: 1px; margin: 0;
            clip-path: inset(50%); overflow: hidden;
          }
          .dsh-sidebar-compact-segment span {
            display: flex; align-items: center; justify-content: center; width: 100%;
            min-height: 32px; padding: 0 4px; box-sizing: border-box;
            border-radius: 5px; font-size: 13px;
          }
          .dsh-sidebar-compact-segment[data-checked="true"] span { font-weight: 600; }
          .dsh-sidebar-compact-segment input:focus-visible + span {
            outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px;
          }
        `),
        h('h3', { id: 'dsh-sidebar-compact-density-title' }, t('densityHeading')),
        h(BooleanPreference, { id: 'project-enabled', label: t('projectEnabledSetting'), description: t('projectEnabledDescription'), enabled: projectEnabled, onChange: setProjectEnabled }),
        h(PresetPreference, {
          id: 'dsh-sidebar-compact-project-spacing', label: t('projectSpacingSetting'),
          description: t('projectSpacingDescription'), value: project, onChange: setProjectSpacing, disabled: !projectEnabled, t,
        }),
        h(BooleanPreference, { id: 'session-enabled', label: t('sessionEnabledSetting'), description: t('sessionEnabledDescription'), enabled: sessionEnabled, onChange: setSessionEnabled }),
        h(PresetPreference, {
          id: 'dsh-sidebar-compact-session-density', label: t('sessionDensitySetting'),
          description: t('sessionDensityDescription'), value: session, onChange: setSessionDensity, disabled: !sessionEnabled, t,
        }),
        h('div', { className: 'dsh-sidebar-compact-preference-description' }, t('densityHint')),
      );
    }

    function collapseWorkspaceGroups(view, workspaceIds) {
      const state = view.getSnapshot();
      if (state.groupBy === 'flat') return;
      const keys = new Set(['', ...workspaceIds, ...Object.keys(state.groupExpansion)]);
      for (const key of keys) {
        if (state.groupExpansion[key] !== false) view.actions.setGroupExpanded(key, false);
      }
    }

    function CollapsePreference({ useCollapseEnabled, setCollapseEnabled, t }) {
      const enabled = useCollapseEnabled(value => value);
      return h('div', { className: 'dsh-sidebar-compact-preference' },
        h('style', null, `
          .dsh-sidebar-compact-preference {
            display: flex; align-items: center; justify-content: space-between;
            gap: 24px; padding: 12px 0; color: var(--dsw-alias-label-primary);
          }
          .dsh-sidebar-compact-preference-description {
            margin-top: 4px; color: var(--dsw-alias-label-secondary); font-size: 12px;
          }
          .dsh-sidebar-compact-switch {
            appearance: none; box-sizing: border-box; display: inline-flex;
            align-items: center; justify-content: flex-start; flex: none;
            width: 36px; height: 20px; margin: 0; padding: 2px; border: 0;
            border-radius: 999px; cursor: pointer; vertical-align: middle;
            background: var(--dsw-alias-border-l2); line-height: 0;
            transition: background-color 150ms ease;
          }
          .dsh-sidebar-compact-switch[aria-checked="true"] {
            background: var(--dsw-alias-brand-primary);
          }
          .dsh-sidebar-compact-switch > span {
            display: block; flex: none; width: 16px; height: 16px;
            border-radius: 50%; background: var(--dsw-alias-bg-base);
            transform: translateX(0); transition: transform 150ms ease;
            pointer-events: none;
          }
          .dsh-sidebar-compact-switch[aria-checked="true"] > span { transform: translateX(16px); }
          .dsh-sidebar-compact-switch:focus-visible {
            outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px;
          }
          .dsh-sidebar-compact-switch:disabled { cursor: not-allowed; opacity: 0.5; }
          @media (prefers-reduced-motion: reduce) {
            .dsh-sidebar-compact-switch,
            .dsh-sidebar-compact-switch > span { transition: none; }
          }
        `),
        h('div', null,
          h('div', { id: 'dsh-sidebar-compact-collapse-label' }, t('collapseSetting')),
          h('div', { id: 'dsh-sidebar-compact-collapse-description', className: 'dsh-sidebar-compact-preference-description' }, t('collapseDescription')),
        ),
        h('button', {
          type: 'button', role: 'switch', className: 'dsh-sidebar-compact-switch',
          'aria-checked': enabled,
          'aria-labelledby': 'dsh-sidebar-compact-collapse-label',
          'aria-describedby': 'dsh-sidebar-compact-collapse-description',
          onClick: () => setCollapseEnabled(!enabled),
        }, h('span', { 'aria-hidden': true })),
      );
    }

    function BooleanPreference({ id, label, description, enabled, onChange }) {
      const prefix = 'dsh-sidebar-compact-' + id;
      return h('div', { className: 'dsh-sidebar-compact-preference' },
        h('div', null,
          h('div', { id: prefix + '-label' }, label),
          h('div', { id: prefix + '-description', className: 'dsh-sidebar-compact-preference-description' }, description),
        ),
        h('button', {
          type: 'button', role: 'switch', className: 'dsh-sidebar-compact-switch',
          'aria-checked': enabled, 'aria-labelledby': prefix + '-label',
          'aria-describedby': prefix + '-description', onClick: () => onChange(!enabled),
        }, h('span', { 'aria-hidden': true })),
      );
    }

    function SidebarPreferences(props) {
      const visible = props.useUpdateVisible(value => value);
      const navigation = props.useNavigationEnabled(value => value);
      const { t } = props;
      if (props.view === 'summary') return h('span', null, t('settingsHint'));
      return h(React.Fragment, null,
        h(CollapsePreference, props),
        h(BooleanPreference, {
          id: 'navigation', label: t('navigationSetting'), description: t('navigationDescription'),
          enabled: navigation, onChange: props.setNavigationEnabled,
        }),
        h(BooleanPreference, {
          id: 'update', label: t('hideUpdateSetting'), description: t('hideUpdateDescription'),
          enabled: !visible, onChange: hidden => props.setUpdateVisible(!hidden),
        }),
        h(DensityPreferences, props),
        h('p', { className: 'dsh-sidebar-compact-preference-description' }, t('settingsHint')),
      );
    }

    function NavigationFeature({ useNavigationEnabled, component, ...props }) {
      const enabled = useNavigationEnabled(value => value);
      return enabled ? h(component, props) : null;
    }
    const NavigationStyles = props => h(NavigationFeature, { ...props, component: CompactPanelStyles });
    const NavigationMenu = props => h(NavigationFeature, { ...props, component: LegacyMoreMenu });
    const NavigationPanels = props => h(NavigationFeature, { ...props, component: OtherPanels });

    function UpdateVisibilityStyles({ useUpdateVisible }) {
      const visible = useUpdateVisible(value => value);
      if (visible) return null;
      // The native desktop update control is the indicator button in this slot.
      // Keep the match independent of the platform-specific CSS Module hash.
      return h('style', { 'data-sidebar-compact': 'update-visibility' },
        `[data-slot="sidebar.settings"] button${moduleClass('indicator')} { display: none !important; }`,
      );
    }

    function WorkspaceCollapseControl({ wide, useCollapseEnabled, useWorkspaceView, useWorkspaces, collapseAll, t }) {
      const enabled = useCollapseEnabled(value => value);
      const groupBy = useWorkspaceView(state => state.groupBy);
      const workspaces = useWorkspaces(state => state.items);
      if (!wide || !enabled || groupBy === 'flat') return null;
      return h(React.Fragment, null,
        h('style', null, `
          @supports (anchor-name: --dsh-workspace-title) and (position-anchor: --dsh-workspace-title) and (top: anchor(top)) and (width: anchor-size(width)) and (position-visibility: anchors-visible) {
            [data-slot="sidebar.workspaces"] [class*="sectionLabel"]:not([class*="sectionLabelHidden"]) {
              anchor-name: --dsh-workspace-title;
            }
            .dsh-sidebar-compact-collapse-all {
              position: fixed; position-anchor: --dsh-workspace-title;
              top: anchor(top, -10000px); left: anchor(left, -10000px);
              width: anchor-size(width, 0px); height: anchor-size(height, 0px);
              position-visibility: anchors-visible;
              margin: 0; padding: 0; border: 0; border-radius: 3px;
              background: transparent; color: transparent; z-index: 2;
              overflow: hidden;
            }
          }
          .dsh-sidebar-compact-collapse-all { cursor: pointer; font: inherit; }
          .dsh-sidebar-compact-collapse-all:focus-visible {
            outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 3px;
          }
        `),
        h('button', {
          type: 'button', className: 'dsh-sidebar-compact-collapse-all',
          'aria-label': t('collapseAll'), title: t('collapseAll'),
          onClick: () => collapseAll(workspaces.map(item => item.workspaceId)),
        }, t('collapseAll')),
      );
    }

    return {
      inject: ['slots', 'layout', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('sidebar-compact', {
          en: {
            "menuLabel": "Other panels",
            "more": "More",
            "collapseAll": "Collapse all workspace sessions",
            "collapseSetting": "Click Workspaces heading to collapse all",
            "collapseDescription": "Collapse every project’s session list by clicking Workspaces. Individual projects can still be expanded.",
            "densityHeading": "List display",
            "projectSpacingSetting": "Project spacing",
            "projectSpacingDescription": "Adjust the space between projects while keeping project titles at their original size.",
            "sessionDensitySetting": "Session density",
            "sessionDensityDescription": "Adjust session title size, line height and spacing together. Icons and times keep their original size.",
            "densityHint": "Enable the matching override to apply its preset. Turn it off or choose Standard to restore the theme.",
            "density.standard": "Standard",
            "density.medium": "Moderate",
            "density.compact": "Compact",
            "navigationSetting": "Compact panel navigation",
            "navigationDescription": "Move panels other than Marketplace into More. Turn off to use native theme navigation.",
            "projectEnabledSetting": "Override project spacing",
            "projectEnabledDescription": "Apply the project spacing preset only while enabled. Turn off to restore the theme.",
            "sessionEnabledSetting": "Override session density",
            "sessionEnabledDescription": "Apply session title size, line height and spacing only while enabled. Turn off to restore the theme.",
            "hideUpdateSetting": "Hide new version button",
            "hideUpdateDescription": "Hide only the sidebar update entry. The host still manages update checks and installation.",
            "settingsHint": "Sidebar adjustments default to off. Enable each as needed to reduce theme conflicts. Saved in this browser; existing explicit choices are retained."
          },
          zh: {
            "menuLabel": "其他面板",
            "more": "更多",
            "collapseAll": "收起所有项目的会话",
            "collapseSetting": "点击工作区标题收起全部",
            "collapseDescription": "点击“工作区”收起所有项目的会话列表，之后仍可逐个展开。",
            "densityHeading": "列表显示",
            "projectSpacingSetting": "项目间距",
            "projectSpacingDescription": "调整项目之间的垂直距离，项目名称保持原字号。",
            "sessionDensitySetting": "会话密度",
            "sessionDensityDescription": "联动调整会话字号、行高与间距，图标和时间保持原样。",
            "densityHint": "开启对应覆盖开关后应用所选档位；关闭开关或选择“标准”恢复主题原样。",
            "density.standard": "标准",
            "density.medium": "适中",
            "density.compact": "紧凑",
            "navigationSetting": "精简面板导航",
            "navigationDescription": "将插件市场以外的面板移入“更多”；关闭时沿用主题的原生导航。",
            "projectEnabledSetting": "覆盖项目间距",
            "projectEnabledDescription": "开启后才应用下方的项目间距；关闭时恢复主题原样。",
            "sessionEnabledSetting": "覆盖会话密度",
            "sessionEnabledDescription": "开启后才应用下方的会话字号、行高和间距；关闭时恢复主题原样。",
            "hideUpdateSetting": "隐藏新版本按钮",
            "hideUpdateDescription": "仅隐藏侧边栏更新入口，检查和安装更新仍由宿主管理。",
            "settingsHint": "侧边栏调整默认关闭，按需独立开启以减少与其他主题的冲突。设置保存在当前浏览器，已有明确选择会保留。"
          },
        }));

        const preference = createBooleanPreference();
        const updatePreference = createBooleanPreference(UPDATE_PREFERENCE_KEY, true);
        const navigationEnabled = createBooleanPreference(NAVIGATION_KEY);
        const projectEnabled = createBooleanPreference(PROJECT_ENABLED_KEY);
        const sessionEnabled = createBooleanPreference(SESSION_ENABLED_KEY);
        const projectSpacing = createDensityPreference(PROJECT_SPACING_KEY);
        const sessionDensity = createDensityPreference(SESSION_DENSITY_KEY);
        ctx.effect(() => {
          const onStorage = event => {
            navigationEnabled.onStorage(event);
            projectEnabled.onStorage(event);
            sessionEnabled.onStorage(event);
            preference.onStorage(event);
            updatePreference.onStorage(event);
            projectSpacing.onStorage(event);
            sessionDensity.onStorage(event);
          };
          window.addEventListener('storage', onStorage);
          return () => window.removeEventListener('storage', onStorage);
        });
        ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config', key: '@112chlorine/dsh-sidebar-compact',
          registrant: 'sidebar-compact', locale: 'sidebar-compact',
          inject: () => ({
            hooks: {
              collapseEnabled: preference, updateVisible: updatePreference,
              projectSpacing, sessionDensity, navigationEnabled, projectEnabled, sessionEnabled,
            },
            setNavigationEnabled: next => navigationEnabled.set(next),
            setProjectEnabled: next => projectEnabled.set(next),
            setSessionEnabled: next => sessionEnabled.set(next),
            setCollapseEnabled: next => preference.set(next),
            setUpdateVisible: next => updatePreference.set(next),
            setProjectSpacing: next => projectSpacing.set(next),
            setSessionDensity: next => sessionDensity.set(next),
          }),
        }, SidebarPreferences));
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action', id: 'compact-update-visibility',
          registrant: 'sidebar-compact',
          inject: () => ({ hooks: { updateVisible: updatePreference } }),
        }, UpdateVisibilityStyles));
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action', id: 'compact-workspace-density',
          registrant: 'sidebar-compact',
          inject: () => ({ hooks: { projectSpacing, sessionDensity, projectEnabled, sessionEnabled } }),
        }, WorkspaceDensityStyles));
        // Wait for a child declaration: its native owner and shared view store
        // have then been committed, regardless of client module activation order.
        ctx.slots.inject('sidebar.workspaces.session.row.action', () => {
          const browser = ctx.slots.entriesOfSlot('sidebar.workspaces').find(entry =>
            entry.children?.['sidebar.workspaces.session.row.action'] && entry.store?.create,
          );
          const view = browser?.store.create();
          if (!view?.getSnapshot || typeof view.actions?.setGroupExpanded !== 'function') {
            console.warn('Compact Sidebar: workspace collapse is unavailable in this DSH version.');
            return () => {};
          }
          return ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
            name: 'sidebar.footer.action', id: 'compact-workspace-collapse',
            registrant: 'sidebar-compact', locale: 'sidebar-compact',
            inject: () => ({
              hooks: { collapseEnabled: preference, workspaceView: view },
              collapseAll: ids => {
                if (preference.getSnapshot()) collapseWorkspaceGroups(view, ids);
              },
            }),
          }, WorkspaceCollapseControl));
        });

        ctx.slots.inject('sidebar.panellist', () => {
          let disposeNavigation = () => {};
          const syncNavigation = () => {
            disposeNavigation();
            disposeNavigation = () => {};
            if (!navigationEnabled.getSnapshot()) return;
            const original = ctx.slots.entriesOfSlot('sidebar').find(entry =>
              entry.children?.['sidebar.panellist'] && typeof entry.inject === 'function',
            );
            if (!original) {
              console.warn('Compact Sidebar: panel navigation skipped; this sidebar does not expose the native panel interface.');
              return;
            }
            const base = original.inject();
            const panels = base?.hooks?.panels;
            if (!panels?.getSnapshot || !panels?.subscribe) {
              console.warn('Compact Sidebar: panel navigation skipped; this sidebar does not expose the native panel source.');
              return;
            }
            const otherPanels = filterSource(panels, panel => panel.id !== MARKET);
            const legacyMore = !original.children?.['sidebar.panellist.actions'];
            const openPanel = id => {
              if (otherPanels.getSnapshot().some(panel => panel.id === id)) ctx.layout.selectPanel(id);
            };
            const disposers = [];
            try {
              // The native sidebar remains the only owner of all its children.
              disposers.push(ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
                name: 'sidebar.footer.action', id: 'compact-panel-styles',
                registrant: 'sidebar-compact', locale: original.locale,
                inject: () => ({ hooks: { panels, navigationEnabled }, legacyMore }),
              }, NavigationStyles)));
              if (legacyMore) {
                disposers.push(ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
                  name: 'sidebar.footer.action', id: 'compact-legacy-more',
                  registrant: 'sidebar-compact', locale: 'sidebar-compact',
                  inject: () => ({ hooks: { otherPanels, navigationEnabled }, openPanel }),
                }, NavigationMenu)));
              } else {
                disposers.push(ctx.slots.inject('sidebar.panellist.actions', () => ctx.slots.register({
                  name: 'sidebar.panellist.actions', id: 'compact-other-panels', order: -100,
                  registrant: 'sidebar-compact', locale: 'sidebar-compact',
                  inject: () => ({ hooks: { otherPanels, navigationEnabled }, openPanel }),
                }, NavigationPanels)));
              }
            } catch (error) {
              while (disposers.length) disposers.pop()();
              throw error;
            }
            disposeNavigation = () => {
              while (disposers.length) disposers.pop()();
            };
          };
          syncNavigation();
          const unsubscribe = navigationEnabled.subscribe(syncNavigation);
          return () => {
            unsubscribe();
            disposeNavigation();
          };
        });
      },
    };
  },
});
