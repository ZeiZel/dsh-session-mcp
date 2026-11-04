/**
 * dsh-session-mcp — Client half.
 *
 * Registers the MCP settings page: live status, the last few requests, the
 * endpoint, the bearer token, and copy-ready configuration blocks for every
 * client this harness can serve.
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
;(globalThis as any).__ModuleLoader__.load({
  id: '@nones/dsh-session-mcp',
  factory(require: (id: string) => any) {
    const g: any = globalThis
    const React = require('react')
    const h = React.createElement

    /** Locale namespace owned by this page. */
    const NS = 'dsh-session-mcp'

    /** Where the Host publishes the live config, status and request journal. */
    const CONFIG_URL = '/api/dsh-session-mcp/config'

    /** How often the page refreshes while open. */
    const REFRESH_MS = 10000

    const EN: Record<string, string> = {
      title: 'MCP',
      heading: 'MCP endpoint',
      description:
        'Connect Claude Code, Codex, Cursor or any other MCP client to this harness. The endpoint starts together with the harness and requires the bearer token below.',
      statusTitle: 'Status',
      listening: 'Listening',
      uptime: 'Uptime',
      requests: 'Requests',
      lastError: 'Last error',
      logTitle: 'Recent requests',
      logEmpty: 'No requests yet. Connect a client and call a tool.',
      colTime: 'Time',
      colTool: 'Request',
      colSession: 'Conversation',
      colResult: 'Result',
      endpoint: 'Endpoint',
      bearer: 'Bearer token',
      show: 'Show',
      hide: 'Hide',
      copy: 'Copy',
      copied: 'Copied',
      jsonTitle: 'JSON — mcpServers',
      codexTitle: 'Codex — ~/.codex/config.toml',
      claudeTitle: 'Claude Code — CLI',
      note:
        'Paste any block into your client. The token is stable across restarts; it rotates only when you delete $DSH_HOME/state/dsh-session-mcp.json and restart the harness.',
      loading: 'Loading…',
      error: 'Could not read the endpoint config: ',
      noSession: '—',
      failed: 'error',
    }

    const RU: Record<string, string> = {
      title: 'MCP',
      heading: 'MCP-эндпоинт',
      description:
        'Подключите Claude Code, Codex, Cursor или любой другой MCP-клиент к этому харнесу. Эндпоинт поднимается вместе с харнесом и требует Bearer-токен ниже.',
      statusTitle: 'Статус',
      listening: 'Слушает',
      uptime: 'В работе',
      requests: 'Запросов',
      lastError: 'Последняя ошибка',
      logTitle: 'Последние запросы',
      logEmpty: 'Запросов пока нет. Подключите клиент и вызовите инструмент.',
      colTime: 'Время',
      colTool: 'Запрос',
      colSession: 'Сессия',
      colResult: 'Результат',
      endpoint: 'Эндпоинт',
      bearer: 'Bearer-токен',
      show: 'Показать',
      hide: 'Скрыть',
      copy: 'Копировать',
      copied: 'Скопировано',
      jsonTitle: 'JSON — mcpServers',
      codexTitle: 'Codex — ~/.codex/config.toml',
      claudeTitle: 'Claude Code — CLI',
      note:
        'Вставьте любой блок в свой клиент. Токен не меняется между перезапусками; он обновится только если удалить $DSH_HOME/state/dsh-session-mcp.json и перезапустить харнес.',
      loading: 'Загрузка…',
      error: 'Не удалось прочитать конфиг эндпоинта: ',
      noSession: '—',
      failed: 'ошибка',
    }

    /** Theme-bound inline styles; no colors are hardcoded. */
    const styles: Record<string, any> = {
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
      pillOk: {
        display: 'inline-block',
        padding: '1px 9px',
        borderRadius: '999px',
        fontSize: '11px',
        border: '1px solid var(--dsw-alias-state-success-primary)',
        color: 'var(--dsw-alias-state-success-primary)',
        whiteSpace: 'nowrap',
      },
      pillError: {
        display: 'inline-block',
        padding: '1px 9px',
        borderRadius: '999px',
        fontSize: '11px',
        border: '1px solid var(--dsw-alias-state-error-primary)',
        color: 'var(--dsw-alias-state-error-primary)',
        whiteSpace: 'nowrap',
      },
      table: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
      th: {
        textAlign: 'left',
        fontWeight: 600,
        color: 'var(--dsw-alias-label-secondary)',
        padding: '0 8px 6px 0',
        borderBottom: '1px solid var(--dsw-alias-border-l1)',
        whiteSpace: 'nowrap',
      },
      td: {
        padding: '6px 8px 6px 0',
        borderBottom: '1px solid var(--dsw-alias-border-l1)',
        verticalAlign: 'top',
      },
      mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
      muted: { color: 'var(--dsw-alias-label-secondary)' },
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
    }

    /** `45s`, `12m 3s`, `1h 12m`. */
    function formatUptime(ms: number): string {
      const total = Math.max(0, Math.floor(ms / 1000))
      if (total < 60) return `${String(total)}s`
      const minutes = Math.floor(total / 60)
      if (minutes < 60) return `${String(minutes)}m ${String(total % 60)}s`
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return `${String(hours)}h ${String(minutes % 60)}m`
      return `${String(Math.floor(hours / 24))}d ${String(hours % 24)}h`
    }

    /** Local wall-clock time for one ISO timestamp. */
    function formatTime(iso: string): string {
      const date = new Date(iso)
      return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString()
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx: any) {
        ctx.effect(() => ctx.locale.register(NS, 'en', EN))
        ctx.effect(() => ctx.locale.register(NS, 'ru', RU))
        const t = ctx.locale.bind(NS)

        /** Re-render on locale switches so the page follows the active language. */
        function useLocaleRevision(): void {
          const [, bump] = React.useState(0)
          React.useEffect(() => ctx.locale.subscribe(() => bump((n: number) => n + 1)), [])
        }

        function CopyButton(props: { text: string }): any {
          const [copied, setCopied] = React.useState(false)
          const onCopy = React.useCallback(() => {
            const clipboard = g.navigator?.clipboard
            if (clipboard === undefined) return
            clipboard.writeText(props.text).then(
              () => {
                setCopied(true)
                g.setTimeout(() => setCopied(false), 1600)
              },
              () => undefined,
            )
          }, [props.text])
          return h('button', { type: 'button', style: styles.button, onClick: onCopy }, copied ? t('copied') : t('copy'))
        }

        function Snippet(props: { title: string; text: string }): any {
          return h(
            'section',
            { style: styles.card },
            h(
              'div',
              { style: styles.cardHead },
              h('span', { style: styles.cardTitle }, props.title),
              h(CopyButton, { text: props.text }),
            ),
            h('pre', { style: styles.pre }, props.text),
          )
        }

        function StatusCard(props: { status: any }): any {
          const status = props.status
          const failure = status.lastFailure
          return h(
            'section',
            { style: styles.card },
            h(
              'div',
              { style: styles.cardHead },
              h('span', { style: styles.cardTitle }, t('statusTitle')),
              h('span', { style: styles.pillOk }, t('listening')),
            ),
            h(
              'div',
              { style: styles.row },
              h('span', { style: styles.rowLabel }, t('uptime')),
              h('span', { style: styles.rowValue }, formatUptime(Number(status.uptimeMs))),
            ),
            h(
              'div',
              { style: styles.row },
              h('span', { style: styles.rowLabel }, t('requests')),
              h('span', { style: styles.rowValue }, String(status.totalCalls)),
            ),
            failure === null || failure === undefined
              ? null
              : h(
                  'div',
                  { style: styles.row },
                  h('span', { style: styles.rowLabel }, t('lastError')),
                  h(
                    'span',
                    { style: { ...styles.rowValue, color: 'var(--dsw-alias-state-error-primary)' } },
                    `${String(failure.tool)} · ${formatTime(String(failure.at))} · ${String(failure.message)}`,
                  ),
                ),
          )
        }

        function LogCard(props: { entries: readonly any[] }): any {
          const entries = props.entries ?? []
          const head = h(
            'div',
            { style: styles.cardHead },
            h('span', { style: styles.cardTitle }, t('logTitle')),
            h('span', { style: styles.muted }, String(entries.length)),
          )
          if (entries.length === 0) {
            return h('section', { style: styles.card }, head, h('p', { style: styles.note }, t('logEmpty')))
          }
          const rows = entries.map((entry: any) =>
            h(
              'tr',
              { key: String(entry.id) },
              h('td', { style: { ...styles.td, ...styles.mono, whiteSpace: 'nowrap' } }, formatTime(String(entry.at))),
              h('td', { style: { ...styles.td, ...styles.mono } }, String(entry.tool)),
              h(
                'td',
                { style: styles.td },
                entry.sessionId === null
                  ? h('span', { style: styles.muted }, t('noSession'))
                  : h('span', { title: String(entry.sessionId) }, String(entry.sessionTitle ?? `${String(entry.sessionId).slice(0, 14)}…`)),
              ),
              h(
                'td',
                { style: { ...styles.td, whiteSpace: 'nowrap' } },
                entry.ok
                  ? h('span', { style: styles.pillOk }, `ok · ${String(entry.ms)}ms`)
                  : h('span', { style: styles.pillError, title: String(entry.error ?? '') }, t('failed')),
              ),
            ),
          )
          return h(
            'section',
            { style: styles.card },
            head,
            h(
              'table',
              { style: styles.table },
              h(
                'thead',
                null,
                h(
                  'tr',
                  null,
                  h('th', { style: styles.th }, t('colTime')),
                  h('th', { style: styles.th }, t('colTool')),
                  h('th', { style: styles.th }, t('colSession')),
                  h('th', { style: styles.th }, t('colResult')),
                ),
              ),
              h('tbody', null, rows),
            ),
          )
        }

        function Section(): any {
          useLocaleRevision()
          const [state, setState] = React.useState({ status: 'loading' })
          const [revealed, setRevealed] = React.useState(false)

          React.useEffect(() => {
            let alive = true
            const load = (): void => {
              g.fetch(CONFIG_URL, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
                .then((response: any) =>
                  response.ok ? response.json() : Promise.reject(new Error(`HTTP ${String(response.status)}`)),
                )
                .then((data: any) => {
                  if (alive) setState({ status: 'ready', data })
                })
                .catch((error: any) => {
                  if (alive) setState({ status: 'error', message: String(error?.message ?? error) })
                })
            }
            load()
            const timer = g.setInterval(load, REFRESH_MS)
            return () => {
              alive = false
              g.clearInterval(timer)
            }
          }, [])

          const header = h(
            'div',
            { style: { display: 'grid', gap: '4px' } },
            h('h2', { style: styles.heading }, t('heading')),
            h('p', { style: styles.description }, t('description')),
          )

          if (state.status === 'loading') {
            return h('div', { style: styles.page }, header, h('p', { style: styles.note }, t('loading')))
          }
          if (state.status === 'error') {
            return h(
              'div',
              { style: styles.page },
              header,
              h('p', { style: styles.error }, `${t('error')}${String(state.message)}`),
            )
          }

          const data = state.data
          const token = String(data.token)
          const masked = `${token.slice(0, 6)}…${token.slice(-4)}`

          return h(
            'div',
            { style: styles.page },
            header,
            h(StatusCard, { status: data.status }),
            h(LogCard, { entries: data.log ?? [] }),
            h(
              'section',
              { style: styles.card },
              h(
                'div',
                { style: styles.row },
                h('span', { style: styles.rowLabel }, t('endpoint')),
                h('span', { style: styles.rowValue }, data.url),
                h('div', { style: styles.actions }, h(CopyButton, { text: data.url })),
              ),
              h(
                'div',
                { style: styles.row },
                h('span', { style: styles.rowLabel }, t('bearer')),
                h('span', { style: styles.rowValue }, revealed ? token : masked),
                h(
                  'div',
                  { style: styles.actions },
                  h(
                    'button',
                    {
                      type: 'button',
                      style: styles.button,
                      onClick: () => setRevealed((value: boolean) => !value),
                    },
                    revealed ? t('hide') : t('show'),
                  ),
                  h(CopyButton, { text: token }),
                ),
              ),
            ),
            h(Snippet, { title: t('jsonTitle'), text: data.snippets.json }),
            h(Snippet, { title: t('codexTitle'), text: data.snippets.codexToml }),
            h(Snippet, { title: t('claudeTitle'), text: data.snippets.claudeCode }),
            h('p', { style: styles.note }, t('note')),
          )
        }

        ctx.slots.inject('settings.section', () =>
          ctx.slots.register({ name: 'settings.section', id: NS, order: 30, label: () => t('title') }, Section),
        )
      },
    }
  },
})
