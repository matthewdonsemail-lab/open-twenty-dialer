import { Hono } from 'hono'
import { ctx, db, email, files, llm } from '@railcode/sdk'

// The welcome app's worker. Everything platform-side comes from @railcode/sdk:
// the verified caller (ctx.user), this app's own store (db), file storage
// (files), transactional email (email) and the LLM gateway (llm) — the last
// two enabled by the ratified 'email: true' / 'llm: true' in manifest.yaml.
// The frontend never talks to the platform directly: it fetches THESE routes,
// and every write answers with the row it changed so the client can patch one
// row instead of re-reading the world.

interface Todo {
  text: string
  done: boolean
  updatedAt: string
}

const app = new Hono()

// ── identity ─────────────────────────────────────────────────────────────────
app.get('/api/me', (c) => c.json({ user: ctx.user }))

// ── todos: this app's own database ───────────────────────────────────────────
app.get('/api/todos', async (c) => {
  const rows = await db.collection<Todo>('todos').query().orderBy('updatedAt', 'desc').page(1, 50)
  return c.json(rows.map((r) => ({ key: r.key, ...r.value })))
})

app.post('/api/todos', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { text?: unknown }
  const text = String(body.text ?? '').slice(0, 280).trim()
  if (!text) return c.json({ error: 'empty' }, 400)
  const key = crypto.randomUUID()
  const value = await db.collection<Todo>('todos').put(key, {
    text,
    done: false,
    updatedAt: new Date().toISOString(),
  })
  return c.json({ key, ...value }, 201)
})

app.patch('/api/todos/:key', async (c) => {
  const key = c.req.param('key')
  const todos = db.collection<Todo>('todos')
  const current = await todos.get(key)
  if (!current) return c.json({ error: 'not found' }, 404)
  const value = await todos.put(key, {
    ...current,
    done: !current.done,
    updatedAt: new Date().toISOString(),
  })
  return c.json({ key, ...value })
})

app.delete('/api/todos/:key', async (c) => {
  await db.collection('todos').delete(c.req.param('key'))
  return c.body(null, 204)
})

// ── files: the worker holds the bytes ────────────────────────────────────────
app.get('/api/files', async (c) => c.json(await files.list()))

app.post('/api/files', async (c) => {
  const name = c.req.query('name')
  if (!name) return c.json({ error: 'name required' }, 400)
  const bytes = await c.req.arrayBuffer()
  const contentType = c.req.header('content-type') || 'application/octet-stream'
  // files.put returns the stored metadata — hand it straight back.
  return c.json(await files.put(name, bytes, contentType), 201)
})

app.get('/api/files/:name', async (c) => {
  const stored = await files.get(c.req.param('name'))
  if (!stored) return c.json({ error: 'not found' }, 404)
  return stored
})

app.delete('/api/files/:name', async (c) => {
  await files.delete(c.req.param('name'))
  return c.body(null, 204)
})

// ── email: send the caller their own todo list ───────────────────────────────
app.post('/api/email', async (c) => {
  const user = ctx.user
  if (!user) return c.json({ error: 'no signed-in caller' }, 401)
  const rows = await db.collection<Todo>('todos').query().orderBy('updatedAt', 'desc').page(1, 50)
  const lines = rows.map((r) => (r.value.done ? '[x] ' : '[ ] ') + r.value.text)
  const sent = await email.send({
    to: user.email,
    subject: 'Your todo list, from your first Railcode app',
    text:
      'Hi ' + user.name + ',\n\n' +
      (lines.length ? lines.join('\n') : '(nothing yet — add a todo in the app)') +
      '\n\nSent by your first Railcode app with email.send().',
  })
  return c.json({ to: user.email, status: sent.status })
})

// ── chat: hand the todo list to an LLM ───────────────────────────────────────
//
// On Railcode cloud the railcode/* aliases run on the org's managed credit with
// zero setup. Elsewhere (self-hosted, or managed models disabled) that call
// fails, so fall back to the org's default configured provider before giving up.
const CHAT_MODEL = 'railcode/sonnet-4.5'

app.post('/api/chat', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { question?: unknown }
  const question = String(body.question ?? '').slice(0, 2000).trim()
  if (!question) return c.json({ error: 'empty' }, 400)

  const rows = await db.collection<Todo>('todos').query().orderBy('updatedAt', 'desc').page(1, 100)
  const system =
    'You are the assistant built into the caller\'s first Railcode app. ' +
    'Their todo list, newest first, as JSON: ' +
    JSON.stringify(rows.map((r) => ({ text: r.value.text, done: r.value.done }))) +
    '. Answer the question briefly and concretely, in plain text.'

  // Relay the gateway's stream untouched: parsing it here would cost ~20x a
  // pass-through, and the frontend reads the ndjson lines itself.
  const relay = (upstream: Response) =>
    new Response(upstream.body, { headers: { 'content-type': 'application/x-ndjson' } })
  try {
    return relay(await llm.streamRaw(question, { model: CHAT_MODEL, system }))
  } catch {
    try {
      return relay(await llm.streamRaw(question, { system }))
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      return c.json(
        { error: 'No LLM answered. An org admin can connect a provider from the dashboard. (' + detail + ')' },
        502,
      )
    }
  }
})

export default app
