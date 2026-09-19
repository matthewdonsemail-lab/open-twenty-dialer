import { useEffect, useState } from 'react'
import * as api from './api'
import {
  Welcome,
  failed,
  pending,
  ready,
  type FileMeta,
  type Me,
  type Slice,
  type Todo,
  type WelcomeActions,
} from './panels'
import './styles.css'

export function App() {
  const [me, setMe] = useState<Slice<Me | null>>(pending(null))
  const [todos, setTodos] = useState<Slice<Todo[]>>(pending([]))
  const [files, setFiles] = useState<Slice<FileMeta[]>>(pending([]))

  // Three independent requests: the greeting, the todo list and the file list
  // each appear as their own answer lands, and each fails on its own.
  useEffect(() => {
    api.loadMe().then(
      (user) => setMe(ready(user)),
      (error: unknown) => setMe(failed(null, error)),
    )
    api.loadTodos().then(
      (rows) => setTodos(ready(rows)),
      (error: unknown) => setTodos(failed([], error)),
    )
    api.loadFiles().then(
      (rows) => setFiles(ready(rows)),
      (error: unknown) => setFiles(failed([], error)),
    )
  }, [])

  // Every todo write folds the row the worker answered with into the one
  // slice — nothing re-reads the whole list after a click.
  const actions: WelcomeActions = {
    addTodo: async (text) => {
      try {
        const created = await api.addTodo(text)
        setTodos((s) => ready([created, ...s.data]))
      } catch (error) {
        setTodos((s) => failed(s.data, error))
      }
    },
    toggleTodo: async (key) => {
      try {
        const updated = await api.toggleTodo(key)
        setTodos((s) => ready(s.data.map((t) => (t.key === key ? updated : t))))
      } catch (error) {
        setTodos((s) => failed(s.data, error))
      }
    },
    deleteTodo: async (key) => {
      try {
        await api.deleteTodo(key)
        setTodos((s) => ready(s.data.filter((t) => t.key !== key)))
      } catch (error) {
        setTodos((s) => failed(s.data, error))
      }
    },
    uploadFile: async (file) => {
      try {
        const meta = await api.uploadFile(file)
        // Re-uploading a name replaces its row instead of duplicating it.
        setFiles((s) => ready([meta, ...s.data.filter((f) => f.name !== meta.name)]))
      } catch (error) {
        setFiles((s) => failed(s.data, error))
      }
    },
    deleteFile: async (name) => {
      try {
        await api.deleteFile(name)
        setFiles((s) => ready(s.data.filter((f) => f.name !== name)))
      } catch (error) {
        setFiles((s) => failed(s.data, error))
      }
    },
    fileHref: api.fileHref,
    // The chat and email panels own their own request state — pass the calls through.
    ask: (question, onText) => api.ask(question, onText),
    emailMyTodos: () => api.emailMyTodos(),
  }

  return <Welcome appName="matthew-onboarding" me={me} todos={todos} files={files} actions={actions} />
}
