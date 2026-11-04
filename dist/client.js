"use strict";
/**
 * dsh-session-mcp — Client half.
 *
 * Registers the MCP settings page: the live endpoint, the bearer token, and
 * copy-ready configuration blocks for every client this harness can serve.
 *
 * The page reads the config over the authenticated `/api` channel, so the token
 * never appears in the served HTML.
 *
 * This file is a classic script on purpose: the Web shell loads it through
 * `window.__ModuleLoader__`, and React arrives from the browser module table.
 * Every binding lives inside the factory so re-evaluating the script (HMR)
 * cannot redeclare a global.
 *
 * @module dsh-session-mcp/client
 */
;
globalThis.__ModuleLoader__.load({
    id: '@nones/dsh-session-mcp',
    factory(require) {
        const g = globalThis;
        const React = require('react');
        const h = React.createElement;
        /** Locale namespace owned by this page. */
        const NS = 'dsh-session-mcp';
        /** Where the Host publishes the live config. */
        const CONFIG_URL = '/api/dsh-session-mcp/config';
        const EN = {
            title: 'MCP',
            heading: 'MCP endpoint',
            description: 'Connect Claude Code, Codex, Cursor or any other MCP client to this harness. The endpoint starts together with the harness and requires the bearer token below.',
            endpoint: 'Endpoint',
            bearer: 'Bearer token',
            show: 'Show',
            hide: 'Hide',
            copy: 'Copy',
            copied: 'Copied',
            jsonTitle: 'JSON — mcpServers',
            codexTitle: 'Codex — ~/.codex/config.toml',
            claudeTitle: 'Claude Code — CLI',
            note: 'Paste any block into your client. The token is stable across restarts; it rotates only when you delete $DSH_HOME/state/dsh-session-mcp.json and restart the harness.',
            loading: 'Loading…',
            error: 'Could not read the endpoint config: ',
        };
        const RU = {
            title: 'MCP',
            heading: 'MCP-эндпоинт',
            description: 'Подключите Claude Code, Codex, Cursor или любой другой MCP-клиент к этому харнесу. Эндпоинт поднимается вместе с харнесом и требует Bearer-токен ниже.',
            endpoint: 'Эндпоинт',
            bearer: 'Bearer-токен',
            show: 'Показать',
            hide: 'Скрыть',
            copy: 'Копировать',
            copied: 'Скопировано',
            jsonTitle: 'JSON — mcpServers',
            codexTitle: 'Codex — ~/.codex/config.toml',
            claudeTitle: 'Claude Code — CLI',
            note: 'Вставьте любой блок в свой клиент. Токен не меняется между перезапусками; он обновится только если удалить $DSH_HOME/state/dsh-session-mcp.json и перезапустить харнес.',
            loading: 'Загрузка…',
            error: 'Не удалось прочитать конфиг эндпоинта: ',
        };
        /** Theme-bound inline styles; no colors are hardcoded. */
        const styles = {
            page: {
                display: 'grid',
                gap: '16px',
                maxWidth: '760px',
                fontSize: '13px',
                lineHeight: 1.5,
                color: 'var(--dsw-alias-label-primary)',
            },
            heading: { margin: 0, fontSize: '16px', fontWeight: 600 },
            description: { margin: 0, color: 'var(--dsw-alias-label-secondary)' },
            card: {
                display: 'grid',
                gap: '10px',
                padding: '14px 16px',
                border: '1px solid var(--dsw-alias-border-l1)',
                borderRadius: '12px',
                background: 'var(--dsw-alias-bg-layer-1)',
            },
            cardHead: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
            },
            cardTitle: { fontSize: '12px', fontWeight: 600, color: 'var(--dsw-alias-label-secondary)' },
            row: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
            },
            rowLabel: { color: 'var(--dsw-alias-label-secondary)', whiteSpace: 'nowrap' },
            rowValue: {
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '12px',
                wordBreak: 'break-all',
                flex: '1 1 auto',
                textAlign: 'right',
            },
            actions: { display: 'flex', gap: '6px', flex: '0 0 auto' },
            button: {
                font: 'inherit',
                fontSize: '12px',
                padding: '3px 10px',
                borderRadius: '8px',
                border: '1px solid var(--dsw-alias-border-l2)',
                background: 'var(--dsw-alias-bg-layer-2)',
                color: 'var(--dsw-alias-label-primary)',
                cursor: 'pointer',
            },
            pre: {
                margin: 0,
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--dsw-alias-bg-layer-2)',
                border: '1px solid var(--dsw-alias-border-l1)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '12px',
                lineHeight: 1.45,
                overflow: 'auto',
                maxHeight: '220px',
                whiteSpace: 'pre',
            },
            note: { margin: 0, color: 'var(--dsw-alias-label-secondary)', fontSize: '12px' },
            error: { margin: 0, color: 'var(--dsw-alias-state-error-primary)' },
        };
        return {
            inject: ['slots', 'locale'],
            apply(ctx) {
                ctx.effect(() => ctx.locale.register(NS, 'en', EN));
                ctx.effect(() => ctx.locale.register(NS, 'ru', RU));
                const t = ctx.locale.bind(NS);
                /** Re-render on locale switches so the page follows the active language. */
                function useLocaleRevision() {
                    const [, bump] = React.useState(0);
                    React.useEffect(() => ctx.locale.subscribe(() => bump((n) => n + 1)), []);
                }
                function CopyButton(props) {
                    const [copied, setCopied] = React.useState(false);
                    const onCopy = React.useCallback(() => {
                        const clipboard = g.navigator?.clipboard;
                        if (clipboard === undefined)
                            return;
                        clipboard.writeText(props.text).then(() => {
                            setCopied(true);
                            g.setTimeout(() => setCopied(false), 1600);
                        }, () => undefined);
                    }, [props.text]);
                    return h('button', { type: 'button', style: styles.button, onClick: onCopy }, copied ? t('copied') : t('copy'));
                }
                function Snippet(props) {
                    return h('section', { style: styles.card }, h('div', { style: styles.cardHead }, h('span', { style: styles.cardTitle }, props.title), h(CopyButton, { text: props.text })), h('pre', { style: styles.pre }, props.text));
                }
                function Section() {
                    useLocaleRevision();
                    const [state, setState] = React.useState({ status: 'loading' });
                    const [revealed, setRevealed] = React.useState(false);
                    React.useEffect(() => {
                        let alive = true;
                        g.fetch(CONFIG_URL, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
                            .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${String(response.status)}`)))
                            .then((data) => {
                            if (alive)
                                setState({ status: 'ready', data });
                        })
                            .catch((error) => {
                            if (alive)
                                setState({ status: 'error', message: String(error?.message ?? error) });
                        });
                        return () => {
                            alive = false;
                        };
                    }, []);
                    const header = h('div', { style: { display: 'grid', gap: '4px' } }, h('h2', { style: styles.heading }, t('heading')), h('p', { style: styles.description }, t('description')));
                    if (state.status === 'loading') {
                        return h('div', { style: styles.page }, header, h('p', { style: styles.note }, t('loading')));
                    }
                    if (state.status === 'error') {
                        return h('div', { style: styles.page }, header, h('p', { style: styles.error }, `${t('error')}${String(state.message)}`));
                    }
                    const data = state.data;
                    const token = String(data.token);
                    const masked = `${token.slice(0, 6)}…${token.slice(-4)}`;
                    return h('div', { style: styles.page }, header, h('section', { style: styles.card }, h('div', { style: styles.row }, h('span', { style: styles.rowLabel }, t('endpoint')), h('span', { style: styles.rowValue }, data.url), h('div', { style: styles.actions }, h(CopyButton, { text: data.url }))), h('div', { style: styles.row }, h('span', { style: styles.rowLabel }, t('bearer')), h('span', { style: styles.rowValue }, revealed ? token : masked), h('div', { style: styles.actions }, h('button', {
                        type: 'button',
                        style: styles.button,
                        onClick: () => setRevealed((value) => !value),
                    }, revealed ? t('hide') : t('show')), h(CopyButton, { text: token })))), h(Snippet, { title: t('jsonTitle'), text: data.snippets.json }), h(Snippet, { title: t('codexTitle'), text: data.snippets.codexToml }), h(Snippet, { title: t('claudeTitle'), text: data.snippets.claudeCode }), h('p', { style: styles.note }, t('note')));
                }
                ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: NS, order: 30, label: () => t('title') }, Section));
            },
        };
    },
});
