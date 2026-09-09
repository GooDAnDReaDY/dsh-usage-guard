window.__ModuleLoader__.load({
  id: '@goodandready/dsh-usage-guard',
  factory: (require) => {
    var module = { exports: {} };
    const React = require('react');
    const NS = 'dsh-usage-guard';

    let ChevronIcon = null;
    try {
      const primitives = require('@deepseek-ai/dsh-client-ui-primitives');
      ChevronIcon = primitives && primitives.IconChevronDownOutline14;
    } catch (_) {
      ChevronIcon = null;
    }

    function FallbackChevron(props) {
      return React.createElement('svg', {
        width: 14,
        height: 14,
        viewBox: '0 0 14 14',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        style: props.style,
        className: props.className,
        'aria-hidden': true,
      }, React.createElement('path', { d: 'M3.5 5.25L7 8.75L10.5 5.25' }));
    }
    const Chevron = ChevronIcon || FallbackChevron;

    function PluginCard({ ctx }) {
      const [expanded, setExpanded] = React.useState(false);
      const [snap, setSnap] = React.useState({ status: 'loading', value: null, writable: false });
      const [draft, setDraft] = React.useState({ repair: true, report: true });
      const [saving, setSaving] = React.useState(false);
      const [msg, setMsg] = React.useState('');

      const initializedRef = React.useRef(false);
      const isDirtyRef = React.useRef(false);
      const msgTimerRef = React.useRef(null);

      React.useEffect(() => {
        return () => {
          if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
        };
      }, []);

      React.useEffect(() => {
        let off = null;
        try {
          const scope = ctx.settingsScope && ctx.settingsScope.bind ? ctx.settingsScope.bind({ namespace: NS }) : null;
          if (!scope) {
            setSnap({ status: 'unavailable', value: null, writable: true });
            return;
          }
          const update = () => {
            const s = scope.getSnapshot ? scope.getSnapshot() : { status: 'unavailable', value: null };
            setSnap(s);
            if (s.status === 'ready' && s.value && (!initializedRef.current || !isDirtyRef.current)) {
              initializedRef.current = true;
              setDraft({
                repair: s.value.repair ?? true,
                report: s.value.report ?? true,
              });
            }
          };
          update();
          if (scope.subscribe) off = scope.subscribe(update);
        } catch (_) {
          setSnap({ status: 'unavailable', value: null, writable: true });
        }
        return () => {
          try { off && off(); } catch {}
        };
      }, [ctx]);

      const t = (() => {
        try {
          return ctx.locale && ctx.locale.bind ? ctx.locale.bind(NS) : (k) => k;
        } catch (_) {
          return (k) => k;
        }
      })();

      const showMessage = (text, autoDismiss = false) => {
        if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
        setMsg(text);
        if (autoDismiss) {
          msgTimerRef.current = setTimeout(() => {
            setMsg('');
          }, 3000);
        }
      };

      const onSave = async () => {
        setSaving(true);
        setMsg('');
        try {
          if (!ctx.settingsScope || !ctx.settingsScope.bind) {
            showMessage('settingsScope unavailable', false);
            setSaving(false);
            return;
          }
          const scope = ctx.settingsScope.bind({ namespace: NS });
          const errs = [];
          for (const k of ['repair', 'report']) {
            try {
              await scope.set(k, draft[k]);
            } catch (e) {
              errs.push(k + ': ' + (e && e.message ? e.message : String(e)));
            }
          }
          if (errs.length) {
            showMessage(errs.join('; '), false);
          } else {
            isDirtyRef.current = false;
            showMessage(t('saved') || 'Saved', true);
          }
        } catch (e) {
          showMessage(String(e && e.message ? e.message : e), false);
        }
        setSaving(false);
      };

      const handleToggle = (field, checked) => {
        isDirtyRef.current = true;
        if (msg) {
          if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
          setMsg('');
        }
        setDraft((prev) => ({ ...prev, [field]: checked }));
      };

      const isRepairActive = draft.repair !== false;
      const badgeLabel = isRepairActive ? (t('active') || 'ACTIVE') : (t('reportOnly') || 'REPORT ONLY');
      const badgeClass = isRepairActive ? 'ug-badge ug-badge-green' : 'ug-badge ug-badge-yellow';

      return React.createElement('div', { className: 'ug-card' },
        React.createElement('style', {'data-dsh-plugin': 'dsh-usage-guard'}, `
          .ug-card { border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-3); border-radius:12px; list-style:none }
          .ug-head { appearance:none; width:100%; font:inherit; color:inherit; text-align:left; cursor:pointer; background:0 0; border:0; border-radius:12px; display:flex; align-items:center; gap:12px; padding:14px 16px }
          .ug-title { color:var(--dsw-alias-label-primary); font-size:15px; font-weight:600; line-height:1.4 }
          .ug-sub { color:var(--dsw-alias-label-secondary); font-size:13px }
          .ug-body { border-top:1px solid var(--dsw-alias-border-l2); margin:0 16px; padding-bottom:8px }
          .ug-field { display:flex; flex-direction:column; gap:6px; padding:12px 0 }
          .ug-row { display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer; font-weight:500; color:var(--dsw-alias-label-primary) }
          .ug-checkbox { width:16px; height:16px; accent-color:var(--dsw-alias-color-primary, #6366f1); cursor:pointer }
          .ug-foot { border-top:1px solid var(--dsw-alias-border-l2); display:flex; justify-content:flex-end; align-items:center; gap:8px; padding:12px 0 4px }
          .ug-save { appearance:none; font:inherit; cursor:pointer; border:1px solid transparent; border-radius:8px; padding:5px 14px; font-size:13px; background:var(--dsw-alias-label-primary); color:var(--dsw-alias-bg-layer-3) }
          .ug-save:disabled { opacity:0.6; cursor:not-allowed }
          .ug-chev { margin-left:auto; flex:none; color:var(--dsw-alias-label-tertiary); transition:transform .16s }
          .ug-chev-open { transform:rotate(180deg) }
          .ug-badge { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px; border:1px solid var(--dsw-alias-border-l2); margin-left:auto }
          .ug-badge-green { background:var(--dsw-alias-color-success, #2da44e); color:#fff; border-color:transparent }
          .ug-badge-yellow { background:var(--dsw-alias-color-warning, #d9a400); color:#fff; border-color:transparent }
        `),
        React.createElement('button', {
          className: 'ug-head',
          onClick: () => setExpanded(!expanded),
          'aria-expanded': expanded,
        },
          React.createElement('span', { className: 'ug-title' }, t('title') || 'Usage Guard'),
          React.createElement('span', { className: 'ug-sub' }, t('subtitle') || 'Token-usage sanitizer & session crash protection'),
          React.createElement('span', { className: badgeClass }, badgeLabel),
          React.createElement(Chevron, { className: 'ug-chev' + (expanded ? ' ug-chev-open' : ''), 'aria-hidden': true })
        ),
        expanded ? React.createElement('div', { className: 'ug-body' },
          snap.status === 'loading' ? React.createElement('div', { className: 'ug-field', style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, t('loading') || 'Loading…') : null,
          snap.status === 'unavailable' ? React.createElement('div', { className: 'ug-field', style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, t('unavailable') || 'Settings scope unavailable') : null,
          snap.status === 'ready' ? React.createElement('div', null,
            React.createElement('div', { className: 'ug-field' },
              React.createElement('label', { className: 'ug-row', htmlFor: 'ug-repair-toggle' },
                React.createElement('span', null, t('repair') || 'Auto-repair token counters'),
                React.createElement('input', {
                  id: 'ug-repair-toggle',
                  type: 'checkbox',
                  className: 'ug-checkbox',
                  checked: !!draft.repair,
                  onChange: (e) => handleToggle('repair', e.target.checked),
                })
              ),
              React.createElement('div', { className: 'ug-sub' }, t('repairDesc') || 'Replace missing or non-numeric counters with 0 before summing to prevent NaN history lockups')
            ),
            React.createElement('div', { className: 'ug-field' },
              React.createElement('label', { className: 'ug-row', htmlFor: 'ug-report-toggle' },
                React.createElement('span', null, t('report') || 'Log diagnostic warnings'),
                React.createElement('input', {
                  id: 'ug-report-toggle',
                  type: 'checkbox',
                  className: 'ug-checkbox',
                  checked: !!draft.report,
                  onChange: (e) => handleToggle('report', e.target.checked),
                })
              ),
              React.createElement('div', { className: 'ug-sub' }, t('reportDesc') || 'Log a line naming the turn, step, and raw sample whenever damaged usage arrives')
            ),
            React.createElement('div', { className: 'ug-foot' },
              msg ? React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginRight: 'auto' } }, msg) : null,
              React.createElement('button', {
                className: 'ug-save',
                onClick: onSave,
                disabled: saving,
              }, saving ? (t('saving') || 'Saving…') : (t('save') || 'Save'))
            )
          ) : null
        ) : null
      );
    }

    module.exports.inject = ['slots', 'locale', 'settingsScope'];
    module.exports.apply = function apply(ctx) {
      try {
        ctx.locale.register(NS, {
          en: {
            title: 'Usage Guard',
            subtitle: 'Token-usage sanitizer & session crash protection',
            active: 'ACTIVE',
            reportOnly: 'REPORT ONLY',
            saved: 'Saved',
            loading: 'Loading…',
            unavailable: 'Settings scope unavailable',
            save: 'Save',
            saving: 'Saving…',
            repair: 'Auto-repair token counters',
            repairDesc: 'Replace missing or non-numeric counters with 0 before summing to prevent NaN history lockups.',
            report: 'Log diagnostic warnings',
            reportDesc: 'Log a line naming the turn, step, and raw sample whenever damaged usage arrives.',
          },
        });
      } catch (_) {}

      // Try to register in the settings.plugin.item slot (DSH Settings → Plugins tab).
      // The slot key must match the settings namespace (NS) for the tab to find our card.
      // If the slot is not available (older DSH build), fall back to a top-level settings.section.
      let primaryRegistered = false;
      try {
        if (ctx.slots && typeof ctx.slots.register === 'function') {
          ctx.slots.register(
            {
              name: 'settings.plugin.item',
              key: NS,
              locale: NS,
              inject: () => ({ ctx }),
            },
            PluginCard,
          );
          primaryRegistered = true;
        }
      } catch (_) {
        // slot not available in this build — fall through to section fallback
      }

      if (!primaryRegistered) {
        try {
          if (ctx.slots && typeof ctx.slots.register === 'function') {
            ctx.slots.register(
              {
                name: 'settings.section',
                id: '@goodandready/dsh-usage-guard',
                order: 50,
                locale: NS,
                label: () => (ctx.locale && ctx.locale.bind ? ctx.locale.bind(NS)('title') : 'Usage Guard'),
                inject: () => ({ ctx }),
              },
              PluginCard,
            );
          }
        } catch (_) {}
      }
    };

    return module.exports;
  },
});