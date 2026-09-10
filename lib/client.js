// Plugin Settings Card (settings.plugin.item).
window.__ModuleLoader__.load({
  id: '@goodandready/dsh-usage-guard',
  factory: (require) => {
    const module = { exports: {} };
    const React = require('react');
    const NS = 'dsh-usage-guard';

    const en = {
      title: 'Usage Guard',
      subtitle: 'Token-usage sanitizer & session crash protection',
      header_desc: 'Guards session history projections from corrupted or missing token counters across all LLM providers.',
      badge_active: 'Active Guard',
      badge_report_only: 'Report Only',
      'settings.loading': 'Loading Usage Guard settings…',
      'settings.unavailable': 'Settings scope unavailable (host namespace is not ready).',
      'settings.retry': 'Retry',
      saved: 'Settings saved successfully',
      save: 'Save Changes',
      saving: 'Saving…',
      repair: 'Auto-repair token counters',
      repairDesc: 'Replace missing, non-numeric, or malformed counters with 0 before summing to prevent NaN history lockups.',
      report: 'Log diagnostic warnings',
      reportDesc: 'Log a detailed warning naming the session turn, step, and raw sample whenever damaged usage arrives.',
      stats_title: 'Protection Status',
      stats_mode: 'Current Mode',
      stats_mode_repair: 'Active Repair (Safe)',
      stats_mode_report: 'Audit Only (Unsafe)',
      stats_scope: 'Scope Target',
      stats_scope_val: 'sessionProjections',
    };

    const ru = {
      title: 'Usage Guard',
      subtitle: 'Санитайзер расхода токенов и защита от сбоев сессий',
      header_desc: 'Защищает проекции истории сессий от повреждённых или отсутствующих счётчиков токенов всех LLM-провайдеров.',
      badge_active: 'Защита активна',
      badge_report_only: 'Только аудит',
      'settings.loading': 'Загрузка настроек Usage Guard…',
      'settings.unavailable': 'Настройки недоступны (пространство хоста ещё не готово).',
      'settings.retry': 'Повторить попытку',
      saved: 'Настройки успешно сохранены',
      save: 'Сохранить изменения',
      saving: 'Сохранение…',
      repair: 'Автоматическая починка счётчиков',
      repairDesc: 'Подставлять 0 вместо пропущенных или нечисловых счётчиков до сложения ядра, предотвращая зависание истории с ошибкой NaN.',
      report: 'Диагностические предупреждения',
      reportDesc: 'Выводить в системный журнал подробную строку с указанием сессии, хода, шага и сырой порции при обнаружении повреждений.',
      stats_title: 'Статус защиты',
      stats_mode: 'Текущий режим',
      stats_mode_repair: 'Активная починка (Безопасно)',
      stats_mode_report: 'Только аудит (Небезопасно)',
      stats_scope: 'Целевая служба',
      stats_scope_val: 'sessionProjections',
    };

    function makeT(dict, fallback) {
      return function t(key, vars) {
        let val = (dict && dict[key]) || (fallback && fallback[key]) || key;
        if (vars && typeof val === 'string') {
          for (const k of Object.keys(vars)) {
            val = val.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
          }
        }
        return val;
      };
    }

    function FallbackChevron() {
      return React.createElement(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none', 'aria-hidden': true },
        React.createElement('path', {
          d: 'M3.5 5.25L7 8.75L10.5 5.25',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        })
      );
    }
    const Chevron = FallbackChevron;

    function ensureCss() {
      if (typeof document === 'undefined') return;
      if (document.getElementById('dsh-usage-guard-full-css')) return;
      const style = document.createElement('style');
      style.id = 'dsh-usage-guard-full-css';
      style.dataset.dshPlugin = NS;
      style.textContent = `
.ug-section-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:14px;list-style:none}
.ug-head-btn{background:none;border:none;cursor:pointer;display:flex;align-items:center;width:100%;padding:0;text-align:left}
.ug-head-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}
.ug-head-sub{font-size:13px;color:var(--dsw-alias-label-secondary);margin-top:2px}

.ug-badge{font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);display:inline-flex;align-items:center;gap:5px;font-weight:500}
.ug-badge-ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);background:rgba(16,185,129,0.08)}
.ug-badge-warn{border-color:var(--dsw-alias-state-warning-primary);color:var(--dsw-alias-state-warning-primary);background:rgba(245,158,11,0.08)}
.ug-badge-bad{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);background:rgba(239,68,68,0.08)}

.ug-body{display:flex;flex-direction:column;gap:14px;border-top:1px solid var(--dsw-alias-border-l2);padding-top:16px;margin-top:4px}
.ug-field-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.ug-row{display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer}
.ug-row-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}
.ug-field-desc{font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.4}

.ug-checkbox{width:18px;height:18px;accent-color:var(--dsw-alias-state-brand-primary, #6366f1);cursor:pointer}

.ug-stats-grid{display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px}
.ug-stat-box{padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:2px}
.ug-stat-val{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.ug-stat-lbl{font-size:11px;color:var(--dsw-alias-label-secondary)}

.ug-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:7px 16px;font-size:13px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .15s ease}
.ug-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-4, var(--dsw-alias-bg-layer-2));border-color:var(--dsw-alias-label-dimmed, var(--dsw-alias-border-l2))}
.ug-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-color:transparent}
.ug-btn-primary:hover:not(:disabled){opacity:0.9}
.ug-btn:disabled{opacity:0.5;cursor:not-allowed}

.ug-alert-ok{padding:10px 14px;border-radius:8px;background:rgba(16,185,129,0.1);color:var(--dsw-alias-state-success-primary);font-size:13px;border:1px solid rgba(16,185,129,0.2)}
.ug-alert-bad{padding:10px 14px;border-radius:8px;background:rgba(239,68,68,0.1);color:var(--dsw-alias-state-error-primary);font-size:13px;border:1px solid rgba(239,68,68,0.2)}
`;
      document.head.appendChild(style);
    }

    function createErrorBoundary() {
      if (!React || typeof React.Component !== 'function') {
        return function NoopBoundary(props) { return props?.children || null; };
      }
      return class ErrorBoundary extends React.Component {
        constructor(props) {
          super(props);
          this.state = { hasError: false, error: null };
        }
        static getDerivedStateFromError(error) {
          return { hasError: true, error };
        }
        componentDidCatch(error, errorInfo) {
          console.error('[dsh-usage-guard] UI Error:', error, errorInfo);
        }
        render() {
          if (this.state.hasError) {
            return React.createElement(
              'div',
              { className: 'ug-alert-bad', style: { margin: '12px 0' } },
              React.createElement('div', { style: { fontWeight: 600, marginBottom: '4px' } }, '⚠️ Usage Guard UI Error:'),
              React.createElement('div', { style: { fontSize: '12px', wordBreak: 'break-all' } }, String(this.state.error?.message || this.state.error)),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'ug-btn',
                  style: { marginTop: '8px', fontSize: '12px', padding: '4px 10px' },
                  onClick: () => this.setState({ hasError: false, error: null }),
                },
                'Retry'
              )
            );
          }
          return this.props?.children || null;
        }
      };
    }
    const ErrorBoundary = createErrorBoundary();

    function SettingsPage({ ctx, t }) {
      const [snap, setSnap] = React.useState({ status: 'loading', value: {} });
      const [draft, setDraft] = React.useState({ repair: true, report: true });
      const [saving, setSaving] = React.useState(false);
      const [msg, setMsg] = React.useState({ text: '', ok: true });
      const isDirtyRef = React.useRef(false);
      const msgTimerRef = React.useRef(null);

      React.useEffect(() => {
        let active = true;
        try {
          const scope = ctx?.settingsScope && typeof ctx.settingsScope.bind === 'function'
            ? ctx.settingsScope.bind({ namespace: NS })
            : null;
          if (!scope) {
            setSnap({ status: 'unavailable', value: {} });
            return () => {};
          }
          const read = async () => {
            try {
              const res = await scope.get();
              if (active && res && typeof res === 'object') {
                setSnap({ status: 'ready', value: res });
                if (!isDirtyRef.current) {
                  setDraft({
                    repair: res.repair !== false,
                    report: res.report !== false,
                  });
                }
              }
            } catch (_) {
              if (active) setSnap({ status: 'unavailable', value: {} });
            }
          };
          read();
          const unwatch = typeof scope.watch === 'function'
            ? scope.watch((next) => {
                if (!active || !next || typeof next !== 'object') return;
                setSnap({ status: 'ready', value: next });
                if (!isDirtyRef.current) {
                  setDraft({
                    repair: next.repair !== false,
                    report: next.report !== false,
                  });
                }
              })
            : () => {};
          return () => {
            active = false;
            try { unwatch(); } catch (_) {}
          };
        } catch (_) {
          setSnap({ status: 'unavailable', value: {} });
          return () => {};
        }
      }, [ctx]);

      React.useEffect(() => {
        return () => {
          if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
        };
      }, []);

      const showMessage = (text, ok = true) => {
        if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
        setMsg({ text, ok });
        msgTimerRef.current = setTimeout(() => {
          setMsg({ text: '', ok: true });
        }, 4000);
      };

      const handleToggle = (field, checked) => {
        isDirtyRef.current = true;
        if (msg.text) {
          if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
          setMsg({ text: '', ok: true });
        }
        setDraft((prev) => ({ ...prev, [field]: checked }));
      };

      const onSave = async () => {
        if (!ctx?.settingsScope || typeof ctx.settingsScope.bind !== 'function') return;
        setSaving(true);
        try {
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
            showMessage(t('saved'), true);
          }
        } catch (e) {
          showMessage(String(e && e.message ? e.message : e), false);
        }
        setSaving(false);
      };

      if (snap.status === 'loading') {
        return React.createElement(
          'div',
          { className: 'ug-field-card', style: { color: 'var(--dsw-alias-label-secondary)' } },
          t('settings.loading')
        );
      }

      if (snap.status === 'unavailable') {
        return React.createElement(
          'div',
          { className: 'ug-alert-bad' },
          t('settings.unavailable')
        );
      }

      const isRepair = draft.repair !== false;

      return React.createElement(
        'div',
        { className: 'ug-body' },

        // Telemetry / Protection status banner
        React.createElement(
          'div',
          { className: 'ug-stats-grid' },
          React.createElement(
            'div',
            { className: 'ug-stat-box' },
            React.createElement('span', { className: 'ug-stat-lbl' }, t('stats_mode')),
            React.createElement(
              'span',
              {
                className: 'ug-stat-val',
                style: { color: isRepair ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-warning-primary)' },
              },
              isRepair ? t('stats_mode_repair') : t('stats_mode_report')
            )
          ),
          React.createElement(
            'div',
            { className: 'ug-stat-box' },
            React.createElement('span', { className: 'ug-stat-lbl' }, t('stats_scope')),
            React.createElement('span', { className: 'ug-stat-val' }, t('stats_scope_val'))
          )
        ),

        // Field 1: repair
        React.createElement(
          'div',
          { className: 'ug-field-card' },
          React.createElement(
            'label',
            { className: 'ug-row', htmlFor: 'ug-repair-toggle' },
            React.createElement('span', { className: 'ug-row-title' }, t('repair')),
            React.createElement('input', {
              id: 'ug-repair-toggle',
              type: 'checkbox',
              className: 'ug-checkbox',
              checked: !!draft.repair,
              onChange: (e) => handleToggle('repair', e.target.checked),
            })
          ),
          React.createElement('div', { className: 'ug-field-desc' }, t('repairDesc'))
        ),

        // Field 2: report
        React.createElement(
          'div',
          { className: 'ug-field-card' },
          React.createElement(
            'label',
            { className: 'ug-row', htmlFor: 'ug-report-toggle' },
            React.createElement('span', { className: 'ug-row-title' }, t('report')),
            React.createElement('input', {
              id: 'ug-report-toggle',
              type: 'checkbox',
              className: 'ug-checkbox',
              checked: !!draft.report,
              onChange: (e) => handleToggle('report', e.target.checked),
            })
          ),
          React.createElement('div', { className: 'ug-field-desc' }, t('reportDesc'))
        ),

        // Feedback message
        msg.text
          ? React.createElement(
              'div',
              { className: msg.ok ? 'ug-alert-ok' : 'ug-alert-bad' },
              msg.text
            )
          : null,

        // Actions
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' } },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'ug-btn ug-btn-primary',
              onClick: onSave,
              disabled: saving,
            },
            saving ? t('saving') : t('save')
          )
        )
      );
    }

    // Accordion PluginCard for settings.plugin.item
    function PluginCard(props) {
      const [open, setOpen] = React.useState(false);
      const t = props?.t || makeT(ru, en);

      React.useEffect(() => {
        ensureCss();
      }, []);

      const isRepairActive = props?.repair !== false;
      const badgeText = isRepairActive ? t('badge_active') : t('badge_report_only');
      const badgeClass = isRepairActive ? 'ug-badge ug-badge-ok' : 'ug-badge ug-badge-warn';

      return React.createElement(
        'li',
        { className: 'ug-section-card' },
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'ug-head-btn',
            'aria-expanded': open,
            onClick: () => setOpen((v) => !v),
          },
          React.createElement(
            'div',
            { style: { flex: 1, paddingRight: '12px' } },
            React.createElement('div', { className: 'ug-head-title' }, t('title')),
            React.createElement('div', { className: 'ug-head-sub' }, t('subtitle'))
          ),
          React.createElement('span', { className: badgeClass, style: { marginRight: '12px' } }, badgeText),
          React.createElement(
            'span',
            {
              style: {
                transform: open ? 'rotate(180deg)' : 'none',
                transition: 'transform .16s ease',
                display: 'inline-flex',
                color: 'var(--dsw-alias-label-tertiary)',
              },
            },
            React.createElement(Chevron)
          )
        ),
        open
          ? React.createElement(
              ErrorBoundary,
              null,
              React.createElement(SettingsPage, {
                ...props,
                ctx: (props && props.ctx) || ctx,
                t,
              })
            )
          : null
      );
    }

    function refreshMirrorUntilVisible(ctx) {
      const visible = () => {
        try {
          const s = (ctx?.get && ctx.get('lanSettings')) || ctx?.settingsScope;
          const view = s?.describe?.()?.getSnapshot?.()?.view;
          return !!view && Array.isArray(view.namespaces) && view.namespaces.some((row) => row.ns === NS);
        } catch (_) {
          return false;
        }
      };
      if (visible()) return () => {};
      let tries = 0;
      const timer = setInterval(() => {
        if (visible() || tries >= 15) {
          clearInterval(timer);
          return;
        }
        tries += 1;
        try {
          const s = (ctx?.get && ctx.get('lanSettings')) || ctx?.settingsScope;
          s?.describe?.()?.load?.();
        } catch (_) {}
      }, 1000);
      if (timer && typeof timer.unref === 'function') {
        timer.unref();
      }
      return () => clearInterval(timer);
    }

    let ctx = null;

    function apply(c) {
      ctx = c;
      const addLocale = (locale, dictionary) => {
        try {
          return ctx.locale.register(NS, locale, dictionary);
        } catch (_) {
          return () => {};
        }
      };

      if (ctx.locale && typeof ctx.locale.register === 'function') {
        if (typeof ctx.effect === 'function') {
          ctx.effect(() => {
            const undo = [addLocale('en', en), addLocale('ru', ru)];
            return () => {
              for (const off of undo) off();
            };
          }, 'dsh-usage-guard: dictionaries');
        } else {
          addLocale('en', en);
          addLocale('ru', ru);
        }
      }

      if (typeof ctx.effect === 'function') {
        ctx.effect(
          () => refreshMirrorUntilVisible(ctx),
          'dsh-usage-guard: re-read the settings mirror until namespace appears',
        );
      }

      function registerSlotWhenReady(slotName, registerFn) {
        if (!ctx.slots) return;
        if (typeof ctx.slots.inject === 'function') {
          try {
            ctx.slots.inject(slotName, () => {
              try {
                return registerFn();
              } catch (err) {
                console.warn('[dsh-usage-guard] Error registering slot ' + slotName + ':', err);
              }
            });
            return;
          } catch (err) {
            console.warn('[dsh-usage-guard] Failed to inject slot ' + slotName + ':', err);
          }
        }
        if (typeof ctx.slots.register === 'function') {
          try {
            registerFn();
          } catch (err) {
            console.warn('[dsh-usage-guard] Failed direct registration for ' + slotName + ':', err);
          }
        }
      }

      registerSlotWhenReady('settings.plugin.item', () =>
        ctx.slots.register(
          {
            name: 'settings.plugin.item',
            key: NS,
            locale: NS,
            inject: () => ({ ctx }),
          },
          (props) =>
            React.createElement(
              ErrorBoundary,
              null,
              React.createElement(PluginCard, { ...props, ctx: (props && props.ctx) || ctx })
            )
        )
      );
    }

    module.exports = {
      apply,
      inject: ['slots', 'locale', 'settingsScope'],
      makeT,
      ensureCss,
      createErrorBoundary,
    };
    return module.exports;
  },
});
