// Plugin Settings Card (settings.plugin.item).
window.__ModuleLoader__.load({
  id: '@goodandready/dsh-usage-guard',
  factory: (require) => {
    const module = { exports: {} };
    const React = require('react');
    const NS = 'dsh-usage-guard';
    // Plugins page row seat (DSH 0.1.6-alpha.2): key = '<package name>#<row id>'.
    const PKG = '@goodandready/dsh-usage-guard';
    const ROW_ID = 'dsh-usage-guard';
    const ROW_CONFIG_KEY = PKG + '#' + ROW_ID;

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
      maxStepTokens: 'Token Spike Clamping Limit',
      maxStepTokensDesc: 'Clamp abnormally huge step usage counters (e.g., > 1,000,000) before projection calculation to prevent integer overflow and corrupted session summaries. Set 0 to disable.',
      stats_title: 'Protection Status',
      stats_mode: 'Current Mode',
      stats_mode_repair: 'Active Repair (Safe)',
      stats_mode_report: 'Audit Only (Unsafe)',
      stats_scope: 'Scope Target',
      stats_scope_val: 'sessionProjections',
      telemetry_title: 'Live Telemetry',
      telemetry_rescued: 'Rescued Events',
      telemetry_tokens: 'Fixed Tokens',
      telemetry_clamped: 'Clamped Spikes',
      telemetry_last_incident: 'Last Incident',
      telemetry_no_incidents: 'No incidents detected (System healthy)',
      telemetry_refresh: 'Refresh Telemetry',
      telemetry_refreshing: 'Refreshing…',
      updater_title: 'Plugin Version & Updates',
      updater_current: 'Current Version',
      updater_latest: 'Latest Version',
      updater_checking: 'Checking…',
      updater_check: 'Check for Updates',
      updater_updating: 'Updating…',
      updater_update_now: 'Update to {version}',
      updater_up_to_date: 'Plugin is up to date',
      updater_failed: 'Update check failed',
      updater_success: 'Update successful. Please reload page.',
    };

    const zh = {
      title: 'Token 用量防护',
      subtitle: 'Token 用量清洗与会话防崩溃保护',
      header_desc: '保护会话历史投影免受所有 LLM 提供商损坏或缺失的 Token 计数器影响。',
      badge_active: '保护生效中',
      badge_report_only: '仅审计',
      'settings.loading': '正在加载 Usage Guard 设置…',
      'settings.unavailable': '设置不可用（宿主命名空间尚未就绪）。',
      'settings.unmonitored': '配置监听不可用。当前使用默认配置运行；变更需重启 DSH 生效。',
      'settings.retry': '重试',
      saved: '设置保存成功',
      save: '保存更改',
      saving: '正在保存…',
      repair: '自动修复 Token 计数器',
      repairDesc: '在求和前将缺失、非数值或格式错误的计数器替换为 0，防止 NaN 导致会话历史崩溃锁死。',
      report: '记录诊断告警',
      reportDesc: '每当收到损坏的用量数据时，记录详细警告并指出会话轮次、步骤和原始样本。',
      maxStepTokens: '单步 Token 突增削峰阈值',
      maxStepTokensDesc: '在进行投影计算前，对异常巨大的单步用量计数器（例如 > 1,000,000）进行削峰限制，防止整数溢出与会话汇总异常。设为 0 表示禁用。',
      stats_title: '保护状态',
      stats_mode: '当前模式',
      stats_mode_repair: '主动修复（安全）',
      stats_mode_report: '仅审计（不安全）',
      stats_scope: '作用范围',
      stats_scope_val: 'sessionProjections',
      telemetry_title: '实时拦截指标',
      telemetry_rescued: '已挽救异常事件',
      telemetry_tokens: '已修复 Token 数',
      telemetry_clamped: '削峰拦截次数',
      telemetry_last_incident: '最近一次拦截事件',
      telemetry_no_incidents: '未检测到拦截事件（系统运行健康）',
      telemetry_refresh: '刷新指标',
      telemetry_refreshing: '正在刷新…',
      updater_title: '插件版本与在线更新',
      updater_current: '当前版本',
      updater_latest: '最新版本',
      updater_checking: '正在检查…',
      updater_check: '检查更新',
      updater_updating: '正在更新…',
      updater_update_now: '立即更新至 {version}',
      updater_up_to_date: '已是最新版本',
      updater_failed: '检查更新失败',
      updater_success: '更新成功，请刷新页面。',
    };

    function getActiveLocale(c) {
      try {
        const snap = (typeof c?.locale?.getLocale === 'function' ? c.locale.getLocale() : null)
          || (typeof c?.locale?.getSnapshot === 'function' ? c.locale.getSnapshot() : null);
        const cur = snap?.active || snap?.locale || '';
        if (typeof cur === 'string' && cur.toLowerCase().startsWith('zh')) return 'zh';
      } catch (err) {
        void err;
      }
      return 'en';
    }

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

    let ChevronIcon = null;
    try {
      const primitives = require('@deepseek-ai/dsh-client-ui-primitives');
      ChevronIcon = primitives && primitives.IconChevronDownOutline14;
    } catch (err) {
      void err;
    }
    const Chevron = ChevronIcon || FallbackChevron;

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
.ug-badge-ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-state-success-bg, var(--dsw-alias-bg-layer-2))}
.ug-badge-warn{border-color:var(--dsw-alias-state-warning-primary);color:var(--dsw-alias-state-warning-primary);background:var(--dsw-alias-state-warning-bg, var(--dsw-alias-bg-layer-2))}
.ug-badge-bad{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-state-error-bg, var(--dsw-alias-bg-layer-2))}

.ug-body{display:flex;flex-direction:column;gap:14px;border-top:1px solid var(--dsw-alias-border-l2);padding-top:16px;margin-top:4px}
.ug-field-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.ug-row{display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer}
.ug-row-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}
.ug-field-desc{font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.4}

.ug-checkbox{width:18px;height:18px;accent-color:var(--dsw-alias-state-brand-primary);cursor:pointer}
.ug-number-input{background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:6px 10px;color:var(--dsw-alias-label-primary);font-size:13px;font-family:inherit;width:140px}
.ug-number-input:focus{outline:none;border-color:var(--dsw-alias-state-brand-primary)}

.ug-stats-grid{display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:10px}
.ug-stat-box{padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:2px}
.ug-stat-val{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.ug-stat-num{font-size:18px;font-weight:700;color:var(--dsw-alias-label-primary);letter-spacing:-0.02em}
.ug-stat-lbl{font-size:11px;color:var(--dsw-alias-label-secondary)}

.ug-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:7px 16px;font-size:13px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .15s ease}
.ug-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-4, var(--dsw-alias-bg-layer-2));border-color:var(--dsw-alias-label-dimmed, var(--dsw-alias-border-l2))}
.ug-btn-sm{padding:4px 10px;font-size:12px;border-radius:6px}
.ug-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-color:transparent}
.ug-btn-primary:hover:not(:disabled){opacity:0.9}
.ug-btn-accent{background:var(--dsw-alias-state-brand-primary);color:var(--dsw-alias-label-invert, var(--dsw-alias-bg-layer-3));border-color:transparent}
.ug-btn-accent:hover:not(:disabled){opacity:0.9}
.ug-btn:disabled{opacity:0.5;cursor:not-allowed}

.ug-alert-ok{padding:10px 14px;border-radius:8px;background:var(--dsw-alias-state-success-bg, var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-state-success-primary);font-size:13px;border:1px solid var(--dsw-alias-state-success-border, var(--dsw-alias-border-l2))}
.ug-alert-bad{padding:10px 14px;border-radius:8px;background:var(--dsw-alias-state-error-bg, var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-state-error-primary);font-size:13px;border:1px solid var(--dsw-alias-state-error-border, var(--dsw-alias-border-l2))}
.ug-update-banner{margin-top:8px;display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:6px;background:var(--dsw-alias-state-warning-bg, var(--dsw-alias-bg-layer-2));border:1px solid var(--dsw-alias-state-warning-border, var(--dsw-alias-border-l2))}
.ug-incident-box{margin-top:6px;padding:8px 10px;border-radius:6px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);font-size:12px;font-family:monospace;color:var(--dsw-alias-label-secondary);overflow-x:auto}
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
                  className: 'ug-btn ug-btn-sm',
                  style: { marginTop: '8px' },
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

    function TelemetrySection({ t }) {
      const [telemetry, setTelemetry] = React.useState(null);
      const [loading, setLoading] = React.useState(false);
      const [err, setErr] = React.useState(null);

      const fetchTelemetry = React.useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
          const res = await fetch('/api/dsh-usage-guard/telemetry', {
            headers: { accept: 'application/json' },
            cache: 'no-store',
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setTelemetry(data);
        } catch (e) {
          setErr(e?.message || String(e));
        } finally {
          setLoading(false);
        }
      }, []);

      React.useEffect(() => {
        fetchTelemetry();
      }, [fetchTelemetry]);

      const recent = telemetry?.recentIncidents || [];
      const lastIncident = recent.length > 0 ? recent[recent.length - 1] : null;

      return React.createElement(
        'div',
        { className: 'ug-field-card' },
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          React.createElement('span', { className: 'ug-row-title' }, t('telemetry_title')),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'ug-btn ug-btn-sm',
              onClick: fetchTelemetry,
              disabled: loading,
            },
            loading ? t('telemetry_refreshing') : t('telemetry_refresh')
          )
        ),
        err
          ? React.createElement('div', { className: 'ug-alert-bad', style: { padding: '6px 10px', fontSize: '12px' } }, err)
          : null,
        React.createElement(
          'div',
          { className: 'ug-stats-grid', style: { marginTop: '8px' } },
          React.createElement(
            'div',
            { className: 'ug-stat-box' },
            React.createElement('span', { className: 'ug-stat-lbl' }, t('telemetry_rescued')),
            React.createElement('span', { className: 'ug-stat-num', style: { color: 'var(--dsw-alias-state-success-primary)' } }, String(telemetry?.rescuedEvents ?? 0))
          ),
          React.createElement(
            'div',
            { className: 'ug-stat-box' },
            React.createElement('span', { className: 'ug-stat-lbl' }, t('telemetry_tokens')),
            React.createElement('span', { className: 'ug-stat-num', style: { color: 'var(--dsw-alias-state-brand-primary)' } }, Number(telemetry?.fixedTokens ?? 0).toLocaleString())
          ),
          React.createElement(
            'div',
            { className: 'ug-stat-box' },
            React.createElement('span', { className: 'ug-stat-lbl' }, t('telemetry_clamped')),
            React.createElement('span', { className: 'ug-stat-num', style: { color: 'var(--dsw-alias-state-warning-primary)' } }, String(telemetry?.clampedSpikes ?? 0))
          )
        ),
        React.createElement(
          'div',
          { style: { marginTop: '8px' } },
          React.createElement('div', { className: 'ug-stat-lbl' }, t('telemetry_last_incident')),
          lastIncident
            ? React.createElement(
                'div',
                { className: 'ug-incident-box' },
                `[${lastIncident.timestamp}] ${lastIncident.kind || 'incident'} | Turn: ${lastIncident.turn ?? '-'} Step: ${lastIncident.step ?? '-'} | Target: ${lastIncident.target || '-'}`
              )
            : React.createElement(
                'div',
                { style: { fontSize: '12px', color: 'var(--dsw-alias-state-success-primary)', marginTop: '4px' } },
                `✓ ${t('telemetry_no_incidents')}`
              )
        )
      );
    }

    function UpdaterSection({ t }) {
      const [status, setStatus] = React.useState(null);
      const [loading, setLoading] = React.useState(false);
      const [updating, setUpdating] = React.useState(false);
      const [feedback, setFeedback] = React.useState({ text: '', ok: true });

      const checkUpdate = React.useCallback(async () => {
        setLoading(true);
        setFeedback({ text: '', ok: true });
        try {
          const res = await fetch('/api/dsh-usage-guard/update', {
            headers: { accept: 'application/json' },
            cache: 'no-store',
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setStatus(data);
        } catch (e) {
          setFeedback({ text: `${t('updater_failed')}: ${e?.message || String(e)}`, ok: false });
        } finally {
          setLoading(false);
        }
      }, [t]);

      const onUpdateNow = async () => {
        setUpdating(true);
        setFeedback({ text: '', ok: true });
        try {
          const res = await fetch('/api/dsh-usage-guard/update', {
            method: 'POST',
            headers: {
              'x-dsh-plugin-update': '1',
              'content-type': 'application/json',
            },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
          setStatus(data);
          setFeedback({ text: t('updater_success'), ok: true });
        } catch (e) {
          setFeedback({ text: e?.message || String(e), ok: false });
        } finally {
          setUpdating(false);
        }
      };

      React.useEffect(() => {
        checkUpdate();
      }, [checkUpdate]);

      const currentVer = status?.currentVersion || '0.1.9';
      const latestVer = status?.latestVersion;
      const updateAvailable = !!status?.updateAvailable && !!latestVer && latestVer !== currentVer;

      return React.createElement(
        'div',
        { className: 'ug-field-card' },
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          React.createElement('span', { className: 'ug-row-title' }, t('updater_title')),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'ug-btn ug-btn-sm',
              onClick: checkUpdate,
              disabled: loading || updating,
            },
            loading ? t('updater_checking') : t('updater_check')
          )
        ),
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', fontSize: '13px' } },
          React.createElement(
            'div',
            null,
            React.createElement('span', { className: 'ug-stat-lbl' }, t('updater_current') + ': '),
            React.createElement('strong', { style: { color: 'var(--dsw-alias-label-primary)' } }, `v${currentVer}`)
          ),
          latestVer
            ? React.createElement(
                'div',
                null,
                React.createElement('span', { className: 'ug-stat-lbl' }, t('updater_latest') + ': '),
                React.createElement(
                  'strong',
                  { style: { color: updateAvailable ? 'var(--dsw-alias-state-warning-primary)' : 'var(--dsw-alias-state-success-primary)' } },
                  `v${latestVer}`
                )
              )
            : null
        ),
        updateAvailable
          ? React.createElement(
              'div',
              { className: 'ug-update-banner' },
              React.createElement('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-state-warning-primary)', fontWeight: 500 } }, `New release available: v${latestVer}`),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'ug-btn ug-btn-sm ug-btn-accent',
                  onClick: onUpdateNow,
                  disabled: updating,
                },
                updating ? t('updater_updating') : t('updater_update_now', { version: latestVer })
              )
            )
          : null,
        feedback.text
          ? React.createElement(
              'div',
              { className: feedback.ok ? 'ug-alert-ok' : 'ug-alert-bad', style: { marginTop: '8px', padding: '6px 10px', fontSize: '12px' } },
              feedback.text
            )
          : null
      );
    }

    function SettingsPage({ ctx, t }) {
      const [snap, setSnap] = React.useState({ status: 'loading', value: {} });
      const [draft, setDraft] = React.useState({ repair: true, report: true, maxStepTokens: 1000000 });
      const [saving, setSaving] = React.useState(false);
      const [msg, setMsg] = React.useState({ text: '', ok: true });
      const isDirtyRef = React.useRef(false);
      const msgTimerRef = React.useRef(null);

      React.useEffect(() => {
        let active = true;
        try {
          const scope = ctx?.configForms && typeof ctx.configForms.get === 'function'
            ? ctx.configForms.get(NS)
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
                    maxStepTokens: typeof res.maxStepTokens === 'number' ? res.maxStepTokens : 1000000,
                  });
                }
              }
            } catch (_) {
              if (active) setSnap({ status: 'unavailable', value: {} });
            }
          };
          read();
          if (typeof scope.watch !== 'function' && active) {
            setSnap((prev) => ({ ...prev, unmonitored: true }));
          }
          const unwatch = typeof scope.watch === 'function'
            ? scope.watch((next) => {
                if (!active || !next || typeof next !== 'object') return;
                setSnap({ status: 'ready', value: next });
                if (!isDirtyRef.current) {
                  setDraft({
                    repair: next.repair !== false,
                    report: next.report !== false,
                    maxStepTokens: typeof next.maxStepTokens === 'number' ? next.maxStepTokens : 1000000,
                  });
                }
              })
            : () => {};
          return () => {
            active = false;
            try { unwatch(); } catch (_) {
              // Intentional cleanup catch: ignore errors if subscription was already disposed
            }
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

      const handleNumberChange = (field, rawVal) => {
        isDirtyRef.current = true;
        if (msg.text) {
          if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
          setMsg({ text: '', ok: true });
        }
        const val = rawVal === '' ? 0 : Number(rawVal);
        setDraft((prev) => ({ ...prev, [field]: isNaN(val) ? 0 : val }));
      };

      const onSave = async () => {
        if (!ctx?.configForms || typeof ctx.configForms.get !== 'function') return;
        setSaving(true);
        try {
          const scope = ctx.configForms.get(NS);
          const errs = [];
          for (const k of ['repair', 'report', 'maxStepTokens']) {
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

        snap.unmonitored
          ? React.createElement(
              'div',
              { className: 'ug-alert-bad', style: { marginBottom: '12px' } },
              t('settings.unmonitored')
            )
          : null,

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

        // Field 3: maxStepTokens
        React.createElement(
          'div',
          { className: 'ug-field-card' },
          React.createElement(
            'div',
            { className: 'ug-row' },
            React.createElement('label', { className: 'ug-row-title', htmlFor: 'ug-tokens-input' }, t('maxStepTokens')),
            React.createElement('input', {
              id: 'ug-tokens-input',
              type: 'number',
              className: 'ug-number-input',
              min: 0,
              step: 10000,
              value: draft.maxStepTokens ?? 1000000,
              onChange: (e) => handleNumberChange('maxStepTokens', e.target.value),
            })
          ),
          React.createElement('div', { className: 'ug-field-desc' }, t('maxStepTokensDesc'))
        ),

        // Feedback message
        msg.text
          ? React.createElement(
              'div',
              { className: msg.ok ? 'ug-alert-ok' : 'ug-alert-bad' },
              msg.text
            )
          : null,

        // Save action
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
        ),

        // Live Telemetry section
        React.createElement(TelemetrySection, { t }),

        // Updater section
        React.createElement(UpdaterSection, { t })
      );
    }

    // Accordion PluginCard for settings.plugin.item
    function PluginCard(props) {
      const page = !!(props && props.view === 'page');
      const [open, setOpen] = React.useState(!!page);
      const hostCtx = (props && props.ctx) || ctx;
      const locale = getActiveLocale(hostCtx);
      const dict = locale === 'zh' ? zh : en;
      const t = props?.t || makeT(dict, en);

      React.useEffect(() => {
        ensureCss();
      }, []);

      // Row seat (plugins.row.config): the host page draws title/icon/crumb and the
      // padding, so the summary is a one-liner and the page drops our card chrome.
      if (props && props.view === 'summary') {
        return React.createElement('span', { className: 'ug-sub' }, t('title'));
      }

      const isRepairActive = props?.repair !== false;
      const badgeText = isRepairActive ? t('badge_active') : t('badge_report_only');
      const badgeClass = isRepairActive ? 'ug-badge ug-badge-ok' : 'ug-badge ug-badge-warn';

      return React.createElement(
        page ? 'div' : 'li',
        { className: page ? 'ug-page' : 'ug-section-card' },
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'ug-head-btn',
            style: page ? { display: 'none' } : undefined,
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
                ctx: hostCtx,
                t,
              })
            )
          : null
      );
    }

    function refreshMirrorUntilVisible(c) {
      const visible = () => {
        try {
          const s = (c?.get && c.get('lanSettings')) || c?.configForms;
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
          const s = (c?.get && c.get('lanSettings')) || c?.configForms;
          s?.describe?.()?.load?.();
        } catch (err) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[dsh-usage-guard] settings mirror load attempt failed:', err?.message || err);
          }
        }
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
            const undo = [addLocale('en', en), addLocale('zh', zh)];
            return () => {
              for (const off of undo) off();
            };
          }, 'dsh-usage-guard: dictionaries');
        } else {
          addLocale('en', en);
          addLocale('zh', zh);
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

      // Plugin-list seat (plugins.item) first: the seat the current core
      // (0.1.6-alpha.2) renders as the plugin's own page with its configuration. The
      // label is a static string on purpose — it is resolved while the page renders,
      // and a locale lookup there would take the whole client batch down with it.
      registerSlotWhenReady('plugins.item', () =>
        ctx.slots.register(
          {
            name: 'plugins.item',
            id: ROW_ID,
            order: 60,
            label: () => 'Usage Guard',
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
      )

      // Row seat and the legacy seat stay as fallbacks.
      registerSlotWhenReady('plugins.row.config', () =>
        ctx.slots.register(
          {
            name: 'plugins.row.config',
            key: ROW_CONFIG_KEY,
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
      inject: ['slots', 'locale', 'configForms'],
      makeT,
      ensureCss,
      createErrorBoundary,
      getActiveLocale,
    };
    return module.exports;
  },
});
