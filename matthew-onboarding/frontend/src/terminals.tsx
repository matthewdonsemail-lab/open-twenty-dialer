import { useEffect, useRef, useState } from 'react'
import { ClaudeMark } from './marks'

// The Claude Code window from railcode.dev's hero, with a Copy prompt button
// in its title bar. It types its prompt out once.

const START_DELAY = 300
const KEY_MIN = 10
const KEY_JITTER = 14

function useTypewriter(text: string): string {
  const [typed, setTyped] = useState('')
  const done = useRef(false)

  useEffect(() => {
    if (done.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done.current = true
      setTyped(text)
      return
    }
    let i = 0
    let timer = window.setTimeout(function step() {
      setTyped(text.slice(0, i))
      if (i >= text.length) {
        done.current = true
        return
      }
      i++
      timer = window.setTimeout(step, KEY_MIN + Math.random() * KEY_JITTER)
    }, START_DELAY)
    return () => window.clearTimeout(timer)
  }, [text])

  return typed
}

export function useCopy(text: string): [boolean, () => void] {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    const done = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, done)
    else done()
  }
  return [copied, copy]
}

export function ClaudeWindow(props: { prompt: string; dir: string }) {
  const typed = useTypewriter(props.prompt)
  const [copied, copy] = useCopy(props.prompt)
  return (
    <div className="terminal">
      <div className="term-bar">
        <div className="dots3">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
        <div className="term-title">claude</div>
        <button type="button" className={copied ? 'term-copy copied' : 'term-copy'} onClick={copy}>
          {copied ? 'Copied' : 'Copy prompt'}
        </button>
      </div>
      <div className="term-body">
        <div className="term-head">
          <ClaudeMark className="cc-logo" />
          <div className="head-lines">
            <div className="name">Claude Code</div>
            <div className="model">Opus 4.8 with high effort</div>
            <div className="cwd">{props.dir}</div>
          </div>
        </div>
        <div className="rule" />
        <div className="prompt-line">
          <span>❯</span>
          {/* A hidden copy of the finished prompt reserves the space so the
              window never grows a line mid-type. */}
          <span className="type-area">
            <span className="ghost-t" aria-hidden="true">
              {props.prompt}
              <span className="cursor" />
            </span>
            <span className="live">
              {typed}
              <span className="cursor" aria-hidden="true" />
            </span>
          </span>
        </div>
        <div className="rule" />
        <div className="shortcuts">? for shortcuts</div>
      </div>
    </div>
  )
}
