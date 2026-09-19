import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LogsConsole, RolesConsole, UsersConsole } from './console'
import { Ideas } from './ideas'
import {
  ClaudeMark,
  CodexMark,
  CursorMark,
  GitHubMark,
  LinearMark,
  OpenCodeMark,
  ResendMark,
  SentryMark,
  SlackMark,
  StripeMark,
} from './marks'
import { Sky } from './sky'
import { ClaudeWindow, useCopy } from './terminals'

// The wire shapes, mirroring what the worker returns.
export interface Me {
  id: string
  name: string
  email: string
  is_admin: boolean
}
export interface Todo {
  key: string
  text: string
  done: boolean
  updatedAt: string
}
export interface ChatAnswer {
  text: string
  model: string
}
export interface FileMeta {
  name: string
  content_type: string
  size: number
  updated_at: string
}
export interface EmailReceipt {
  to: string
  status: string
}

// One slice of state per panel: it loads on its own, fails on its own, and is
// the only thing a write touches.
export interface Slice<T> {
  data: T
  loading: boolean
  error: string | null
}

export function pending<T>(empty: T): Slice<T> {
  return { data: empty, loading: true, error: null }
}
export function ready<T>(data: T): Slice<T> {
  return { data, loading: false, error: null }
}
export function failed<T>(data: T, error: unknown): Slice<T> {
  return { data, loading: false, error: error instanceof Error ? error.message : String(error) }
}

export interface WelcomeActions {
  addTodo: (text: string) => Promise<void>
  toggleTodo: (key: string) => Promise<void>
  deleteTodo: (key: string) => Promise<void>
  // Streams: onText receives each piece as it lands; the promise settles with the whole answer.
  ask: (question: string, onText: (text: string) => void) => Promise<ChatAnswer>
  uploadFile: (file: File) => Promise<void>
  deleteFile: (name: string) => Promise<void>
  fileHref: (name: string) => string
  emailMyTodos: () => Promise<EmailReceipt>
}

// The "now go build" prompt the terminal types out and its Copy button copies.
export const BUILD_PROMPT =
  'Based on what you know about me, build me a Railcode app that would help me in my ' +
  'day to day work. Help me set up the necessary connectors and deploy when done.'

const TABS = ['build', 'features', 'resources', 'plans'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = { build: 'Build', features: 'Features', resources: 'Resources', plans: 'Paid features' }

function firstNameOf(me: Me | null): string {
  if (!me) return ''
  const name = me.name.trim()
  const space = name.indexOf(' ')
  return space === -1 ? name : name.slice(0, space)
}

// The org home page ("launcher") lives one DNS label up from this app's host —
// its Connectors tab and the admin console live there. On localhost dev there
// is no launcher host to point at, so callers fall back.
function launcherOrigin(): string | null {
  const host = window.location.host
  if (/^(localhost|127\.|\[)/.test(host)) return null
  const parts = host.split('.')
  if (parts.length < 3) return null
  return window.location.protocol + '//' + parts.slice(1).join('.')
}

// ── theme: the OS's, unless the toggle said otherwise ────────────────────────
function useTheme(): [boolean, () => void] {
  const [night, setNight] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'dark' || saved === 'light') return saved === 'dark'
    } catch {
      // storage blocked — follow the OS
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', night)
  }, [night])
  const toggle = () => {
    setNight((n) => {
      try {
        localStorage.setItem('theme', n ? 'light' : 'dark')
      } catch {
        // storage blocked — the toggle still works for this visit
      }
      return !n
    })
  }
  return [night, toggle]
}

// ── tabs live in the hash, so a tab can be linked to; keys 1–4 switch ────────
function useTab(): [Tab, (t: Tab) => void] {
  const read = (): Tab => {
    const h = window.location.hash.slice(1) as Tab
    return (TABS as readonly string[]).includes(h) ? h : 'build'
  }
  const [tab, setTab] = useState<Tab>(read)
  useEffect(() => {
    const onHash = () => setTab(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = (t: Tab) => {
    history.replaceState(null, '', '#' + t)
    setTab(t)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= TABS.length) go(TABS[n - 1]!)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return [tab, go]
}

function Section(props: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section className="sec">
      <h2>{props.title}</h2>
      {props.lead ? <p className="lead">{props.lead}</p> : null}
      <div className="body">{props.children}</div>
    </section>
  )
}

// ── Build ────────────────────────────────────────────────────────────────────
function BuildTab(props: { dir: string }) {
  return (
    <>
      <Section
        title="Build with your coding agent of choice"
        lead="Build apps, create connectors, and manage users directly from your agent"
      >
        <ClaudeWindow dir={props.dir} prompt={BUILD_PROMPT} />
        <p className="agents">
          <span>
            <ClaudeMark />
            Claude Code
          </span>
          <span>
            <CodexMark />
            Codex
          </span>
          <span>
            <CursorMark />
            Cursor
          </span>
          <span>
            <OpenCodeMark />
            OpenCode
          </span>
          <span className="any">any agent works</span>
        </p>
      </Section>
      <Section title="Here are some ideas">
        <Ideas />
      </Section>
    </>
  )
}

// ── Features ─────────────────────────────────────────────────────────────────
function Todos(props: { todos: Slice<Todo[]>; actions: WelcomeActions }) {
  const [text, setText] = useState('')
  return (
    <div className="fp">
      <h3>Database</h3>
      <form
        className="frow"
        onSubmit={async (e) => {
          e.preventDefault()
          const v = text.trim()
          if (!v) return
          setText('')
          await props.actions.addTodo(v)
        }}
      >
        <input className="fin" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a todo…" />
        <button type="submit" className="ghost-btn">
          Add
        </button>
      </form>
      {props.todos.error ? <p className="err">{props.todos.error}</p> : null}
      {props.todos.loading ? (
        <p className="empty">Loading…</p>
      ) : props.todos.data.length === 0 ? (
        <p className="empty">Nothing yet. Add one — it lands in this app's own database.</p>
      ) : (
        <ul className="list">
          {props.todos.data.map((t) => (
            <li key={t.key}>
              <input className="chk" type="checkbox" checked={t.done} onChange={() => props.actions.toggleTodo(t.key)} />
              <span className={t.done ? 'grow done' : 'grow'}>{t.text}</span>
              <button type="button" className="del" onClick={() => props.actions.deleteTodo(t.key)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type ChatState =
  | { status: 'idle' }
  | { status: 'streaming'; text: string }
  | { status: 'done'; answer: ChatAnswer }
  | { status: 'error'; error: string }

function Chat(props: { ask: WelcomeActions['ask'] }) {
  const [question, setQuestion] = useState("What's on my todo list?")
  const [state, setState] = useState<ChatState>({ status: 'idle' })
  const busy = state.status === 'streaming'
  return (
    <div className="fp">
      <h3>LLM</h3>
      <form
        className="frow"
        onSubmit={async (e) => {
          e.preventDefault()
          const q = question.trim()
          if (!q || busy) return
          setState({ status: 'streaming', text: '' })
          try {
            // The answer streams in: every piece the worker relays lands here.
            const answer = await props.ask(q, (text) => setState({ status: 'streaming', text }))
            setState({ status: 'done', answer })
          } catch (error) {
            setState({ status: 'error', error: error instanceof Error ? error.message : String(error) })
          }
        }}
      >
        <input className="fin" type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask anything about your todos…" />
        <button type="submit" className="ghost-btn" disabled={busy}>
          {busy ? 'Thinking…' : 'Ask'}
        </button>
      </form>
      {state.status === 'error' ? <p className="err">{state.error}</p> : null}
      {state.status === 'streaming' && state.text ? (
        <p className="answer">
          {state.text}
          <span className="caret" aria-hidden="true" />
        </p>
      ) : null}
      {state.status === 'done' ? <p className="answer">{state.answer.text}</p> : null}
    </div>
  )
}

type EmailState =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'sent'; receipt: EmailReceipt }
  | { status: 'error'; error: string }

function EmailPanel(props: { emailMyTodos: () => Promise<EmailReceipt> }) {
  const [state, setState] = useState<EmailState>({ status: 'idle' })
  const busy = state.status === 'working'
  return (
    <div className="fp">
      <h3>Email</h3>
      <div className="frow">
        <button
          type="button"
          className="ghost-btn"
          disabled={busy}
          onClick={async () => {
            setState({ status: 'working' })
            try {
              setState({ status: 'sent', receipt: await props.emailMyTodos() })
            } catch (error) {
              setState({ status: 'error', error: error instanceof Error ? error.message : String(error) })
            }
          }}
        >
          {busy ? 'Sending…' : 'Email me my todo list'}
        </button>
      </div>
      {state.status === 'sent' ? (
        <p className="tiny">
          Sent to <b>{state.receipt.to}</b> — check your inbox.
        </p>
      ) : null}
      {state.status === 'error' ? <p className="err">{state.error}</p> : null}
    </div>
  )
}

function formatSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB'
  return (n / (1024 * 1024)).toFixed(1) + ' MB'
}

function FilesPanel(props: { files: Slice<FileMeta[]>; actions: WelcomeActions }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="fp">
      <h3>Files</h3>
      <label className="drop">
        Drop a file or click
        <input
          ref={input}
          type="file"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) await props.actions.uploadFile(f)
            if (input.current) input.current.value = ''
          }}
        />
      </label>
      {props.files.error ? <p className="err">{props.files.error}</p> : null}
      {props.files.loading ? (
        <p className="empty">Loading…</p>
      ) : props.files.data.length === 0 ? (
        <p className="empty">No files yet. Upload one — this app holds the bytes.</p>
      ) : (
        <ul className="list">
          {props.files.data.map((f) => (
            <li key={f.name}>
              <a className="grow trunc" href={props.actions.fileHref(f.name)}>
                {f.name}
              </a>
              <span className="fsize">{formatSize(f.size)}</span>
              <button type="button" className="del" onClick={() => props.actions.deleteFile(f.name)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Connect() {
  const origin = launcherOrigin()
  return (
    <div className="fp connect">
      <div>
        <h3>Connect your data</h3>
        <p className="tiny">Link the tools you use. Every app can build on them.</p>
      </div>
      {origin ? (
        <a className="link" href={origin + '/#connectors'}>
          Open the Connectors page →
        </a>
      ) : (
        <span className="tiny">Open the Connectors tab on your Railcode home page.</span>
      )}
      <div className="logos">
        <span className="logo" title="Slack"><SlackMark /></span>
        <span className="logo" title="GitHub"><GitHubMark /></span>
        <span className="logo" title="Linear"><LinearMark /></span>
        <span className="logo" title="Stripe"><StripeMark /></span>
        <span className="logo" title="Sentry"><SentryMark /></span>
        <span className="logo" title="Resend"><ResendMark /></span>
        <span className="logo-more">+ more</span>
      </div>
    </div>
  )
}

function FeaturesTab(props: { todos: Slice<Todo[]>; files: Slice<FileMeta[]>; actions: WelcomeActions }) {
  return (
    <Section title="Every app ships with these.">
      <div className="feat">
        <Todos todos={props.todos} actions={props.actions} />
        <Chat ask={props.actions.ask} />
        <EmailPanel emailMyTodos={props.actions.emailMyTodos} />
        <FilesPanel files={props.files} actions={props.actions} />
        <Connect />
      </div>
    </Section>
  )
}

// ── Resources ────────────────────────────────────────────────────────────────
const RESOURCES: { title: string; line: ReactNode; href: string }[] = [
  { title: 'Docs', line: 'Complete Railcode documentation', href: 'https://docs.railcode.dev/docs' },
  { title: 'Quickstart', line: 'Zero to a live app in ten minutes.', href: 'https://docs.railcode.dev/docs/quickstart' },
  { title: 'SDK reference', line: 'For those who still look at the code', href: 'https://docs.railcode.dev/docs/reference/sdk' },
  { title: 'CLI reference', line: 'You can use the CLI to do anything you can do in the UI', href: 'https://docs.railcode.dev/docs/reference/cli' },
  { title: 'Examples', line: 'Real apps you can clone', href: 'https://github.com/Railcode-HQ/railcode-examples' },
  { title: 'For agents', line: 'The site, as your agent reads it.', href: 'https://railcode.dev/auth.md' },
  { title: 'Blog', line: "What we're building and why.", href: 'https://railcode.dev/blog' },
  { title: 'Talk to us', line: 'Speak directly to a founder', href: 'https://cal.com/yakko/railcode' },
]

function ResourcesTab() {
  return (
    <Section title="Keep building.">
      <div className="res">
        {RESOURCES.map((r) => (
          <a key={r.title} className="rc" href={r.href} target="_blank" rel="noopener">
            <div className="t">
              {r.title} <span className="arr">→</span>
            </div>
            <div className="d">{r.line}</div>
          </a>
        ))}
      </div>
    </Section>
  )
}

// ── Plans ────────────────────────────────────────────────────────────────────
function Caption(props: { title: string; plan: string; line: string }) {
  return (
    <div className="cap">
      <div className="k">
        {props.title} <span className="pl">{props.plan}</span>
      </div>
      <p className="one">{props.line}</p>
    </div>
  )
}

function PlansTab(props: { me: Me | null; night: boolean }) {
  const you = { name: props.me?.name || 'You', email: props.me?.email || 'you@example.com' }
  const origin = launcherOrigin()
  return (
    <Section
      title="Some of the features on our Paid plans"
      lead="We offer a generous free tier and no seat-based pricing on Team and Pro plans"
    >
      <div className="plan-feat">
        <div>
          <UsersConsole you={you} />
          <Caption title="User-level permissions" plan="Team" line="Decide per person what they can use and build on." />
        </div>
        <div>
          <RolesConsole you={you} />
          <Caption title="Role-based access control" plan="Pro" line="Growth gets PostHog and three BigQuery queries. Nobody else does." />
        </div>
        <div>
          <div className="shot slackshot">
            <img
              src={props.night ? '/ideas/slack-dark.jpg' : '/ideas/slack.jpg'}
              width="1000"
              height="470"
              alt="A Slack thread: a question to @Railcode, answered from Linear, then an email sent from the thread"
            />
          </div>
          <Caption title="Slack agents" plan="Pro" line="Mention @Railcode in a channel. It reads your connectors and answers there." />
        </div>
        <div>
          <LogsConsole you={you} />
          <Caption title="Logs" plan="7d → 1 month → 1 year" line="Everything is logged. Paid plans keep it for longer." />
        </div>
      </div>
      <div className="cta-row">
        <a className="btn" href={origin ? origin + '/admin/billing' : '#'}>
          Upgrade in Billing →
        </a>
      </div>
    </Section>
  )
}

// ── the page ─────────────────────────────────────────────────────────────────
export function Welcome(props: {
  appName: string
  me: Slice<Me | null>
  todos: Slice<Todo[]>
  files: Slice<FileMeta[]>
  actions: WelcomeActions
}) {
  const [night, toggleTheme] = useTheme()
  const [tab, go] = useTab()
  const first = firstNameOf(props.me.data)
  const dir = '~/' + props.appName
  const url = window.location.origin
  const [urlCopied, copyUrl] = useCopy(url)
  const bare = url.replace(/^https?:\/\//, '')
  const proto = url.slice(0, url.length - bare.length)

  return (
    <>
      <Sky night={night} />
      <div className="page">
        <header className="chrome">
          <span className="word">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--accent)" />
              <path
                d="M8 16V8h4.2a2.6 2.6 0 0 1 .9 5.05L16 16h-2.4l-2.5-2.7H10V16H8zm2-4.5h2.1a.9.9 0 1 0 0-1.8H10v1.8z"
                fill="var(--accent-fg)"
              />
            </svg>
            Railcode<span className="app">{props.appName}</span>
          </span>
          <div className="chrome-r">
            {props.me.data ? (
              <span className="me">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10" width="16" height="11" rx="2.5" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                Signed in as <b>{props.me.data.email}</b>
              </span>
            ) : null}
            <button type="button" className="ghost" onClick={toggleTheme} aria-label="Toggle theme">
              {night ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              )}
              Theme
            </button>
          </div>
        </header>

        <section className="hero">
          <h1>Your first app is live{first ? ', ' + first : ''}.</h1>
          <div className="urlbox">
            <code>
              <i>{proto}</i>
              {bare}
            </code>
            <button type="button" className={urlCopied ? 'ghost-btn sm copied' : 'ghost-btn sm'} onClick={copyUrl}>
              {urlCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="line">It's live but behind authentication. Try opening it in another browser.</p>
        </section>

        <div className="tabs-wrap">
          <nav className="tabs" role="tablist" aria-label="Sections">
            {TABS.map((t) => (
              <button key={t} type="button" className="tab" role="tab" aria-selected={t === tab} onClick={() => go(t)}>
                {TAB_LABEL[t]}
              </button>
            ))}
          </nav>
        </div>

        <main className="wrap">
          {tab === 'build' ? <BuildTab dir={dir} /> : null}
          {tab === 'features' ? <FeaturesTab todos={props.todos} files={props.files} actions={props.actions} /> : null}
          {tab === 'resources' ? <ResourcesTab /> : null}
          {tab === 'plans' ? <PlansTab me={props.me.data} night={night} /> : null}
        </main>
      </div>
    </>
  )
}

