// The frontend talks to the Hono worker over /api. Every call maps to one worker
// route, which calls @railcode/sdk server-side. Nothing here touches the platform
// directly — the worker is the only place with credentials and ctx.user.
import type { ChatAnswer, EmailReceipt, FileMeta, Me, Todo } from './panels'

// For calls that answer with JSON…
async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) throw new Error((await res.text()) || res.statusText)
  return (await res.json()) as T
}

// …and for the 204s, which have no body but can still fail.
async function noContent(path: string, init: RequestInit): Promise<void> {
  const res = await fetch(path, init)
  if (!res.ok) throw new Error((await res.text()) || res.statusText)
}

// ── reads, fired in parallel on mount ────────────────────────────────────────
export const loadMe = () => json<{ user: Me | null }>('/api/me').then((r) => r.user)
export const loadTodos = () => json<Todo[]>('/api/todos')
export const loadFiles = () => json<FileMeta[]>('/api/files')

// ── writes: each answers with just what it changed ───────────────────────────
export const addTodo = (text: string) =>
  json<Todo>('/api/todos', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  })

export const toggleTodo = (key: string) =>
  json<Todo>('/api/todos/' + encodeURIComponent(key), { method: 'PATCH' })

export const deleteTodo = (key: string) =>
  noContent('/api/todos/' + encodeURIComponent(key), { method: 'DELETE' })

export const uploadFile = (file: File) =>
  json<FileMeta>('/api/files?name=' + encodeURIComponent(file.name), {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
  })

export const deleteFile = (name: string) =>
  noContent('/api/files/' + encodeURIComponent(name), { method: 'DELETE' })

export const fileHref = (name: string) => '/api/files/' + encodeURIComponent(name)

// ── email: the worker mails the caller their own todo list ───────────────────
export const emailMyTodos = () => json<EmailReceipt>('/api/email', { method: 'POST' })

// ── chat: the worker streams the LLM's answer over the todos ─────────────────
// The worker relays the gateway's ndjson untouched: one JSON object per line,
// `{ type: 'text', text }` pieces, then a `done` frame with the model.
export async function ask(question: string, onText: (text: string) => void): Promise<ChatAnswer> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  if (!res.ok || !res.body) throw new Error((await res.text()) || res.statusText)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let model = ''
  const take = (line: string) => {
    if (!line.trim()) return
    const ev = JSON.parse(line) as { type: string; text?: string; model?: string; message?: string }
    if (ev.type === 'text' && ev.text) {
      text += ev.text
      onText(text)
    } else if (ev.type === 'done') {
      model = ev.model ?? ''
      // a gateway that buffers hands the whole answer over on the done frame
      if (!text && ev.text) {
        text = ev.text
        onText(text)
      }
    } else if (ev.type === 'error') {
      throw new Error(ev.message || 'The model returned an error.')
    }
  }
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl = buffer.indexOf('\n')
    while (nl !== -1) {
      take(buffer.slice(0, nl))
      buffer = buffer.slice(nl + 1)
      nl = buffer.indexOf('\n')
    }
  }
  take(buffer + decoder.decode())
  return { text, model }
}
