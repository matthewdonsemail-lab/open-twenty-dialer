import type { ReactNode } from 'react'
import { BigQueryMark, GitHubMark, PostHogMark, StripeMark } from './marks'

// The admin console, drawn the way it is: the sidebar on the shell, the page
// floating beside it. Three pictures of what paid plans unlock — Users, Roles &
// permissions, and the audit logs — with the signed-in person in the first row.
// Nothing here is interactive: it's a picture of software, so the controls are
// spans, and nothing joins the tab order.

interface You {
  name: string
  email: string
}

const GROUPS: { label: string; pages: string[] }[] = [
  { label: 'Access', pages: ['Users', 'Roles & permissions'] },
  { label: 'Integrations', pages: ['Connectors', 'Data sources', 'LLM gateway'] },
  { label: 'Deployments', pages: [] },
  { label: 'Audit logs', pages: ['AI & Agents', 'Connectors', 'Data sources', 'Email'] },
  { label: 'Settings', pages: [] },
]

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

function Shell(props: {
  you: You
  group: string
  page: string
  crumb: string
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="frame">
      <div className="adm">
        <aside className="aside">
          <div className="aw">
            <span className="amark" />
            Railcode
          </div>
          <div className="aorg">Admin</div>
          <div className="an link">↗ Apps homepage</div>
          <div className="an">Home</div>
          <div className="an">Billing</div>
          {GROUPS.map((g) => {
            const open = g.label === 'Access' || g.label === 'Integrations' || g.label === props.group
            return (
              <div key={g.label}>
                <div className="an grp">
                  {g.label}
                  <span className="car">{open ? '⌄' : '›'}</span>
                </div>
                {open
                  ? g.pages.map((p) => (
                      <div key={p} className={g.label === props.group && p === props.page ? 'an sub on' : 'an sub'}>
                        {p}
                      </div>
                    ))
                  : null}
              </div>
            )
          })}
          <div className="auser">
            <span className="aav">{initials(props.you.name)}</span>
            <span>
              <b>{props.you.name}</b>
              <i>{props.you.email}</i>
            </span>
          </div>
        </aside>
        <div className="apanel">
          <div className="acrumb">{props.crumb}</div>
          <div className="abody">
            <h1>{props.title}</h1>
            <p className="asub">{props.subtitle}</p>
            {props.children}
          </div>
        </div>
      </div>
    </div>
  )
}

function Person(props: { name: string; email: string }) {
  return (
    <span className="aperson">
      <span className="aav">{initials(props.name)}</span>
      <span>
        <b>{props.name}</b>
        <i>{props.email}</i>
      </span>
    </span>
  )
}

export function UsersConsole(props: { you: You }) {
  return (
    <Shell
      you={props.you}
      group="Access"
      page="Users"
      crumb="Users"
      title="Users"
      subtitle="People, invites, and the domains that can join your organization."
    >
      <div className="atbl">
        <table>
          <tbody>
            <tr>
              <th>Person</th>
              <th>System role</th>
              <th>Org roles</th>
              <th>Direct grants</th>
              <th />
            </tr>
            <tr>
              <td><Person name={props.you.name} email={props.you.email} /></td>
              <td><span className="rb owner">Owner</span></td>
              <td><span className="chip">Admins</span></td>
              <td><span className="dim">—</span></td>
              <td className="dots">⋯</td>
            </tr>
            <tr>
              <td><Person name="Maya Ford" email="maya@example.com" /></td>
              <td><span className="rb">Builder</span></td>
              <td><span className="chip">Growth</span></td>
              <td>
                <span className="chip"><PostHogMark />PostHog</span>
                <span className="chip"><StripeMark />Stripe</span>
              </td>
              <td className="dots">⋯</td>
            </tr>
            <tr>
              <td><Person name="Rosa Tavares" email="rosa@example.com" /></td>
              <td><span className="rb viewer">Viewer</span></td>
              <td><span className="dim">—</span></td>
              <td><span className="chip">2 apps</span></td>
              <td className="dots">⋯</td>
            </tr>
            <tr>
              <td><Person name="Sam Ortiz" email="sam@example.com" /></td>
              <td><span className="rb">Builder</span></td>
              <td><span className="chip">Finance</span></td>
              <td><span className="chip"><GitHubMark />GitHub</span></td>
              <td className="dots">⋯</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Shell>
  )
}

export function RolesConsole(props: { you: You }) {
  return (
    <Shell
      you={props.you}
      group="Access"
      page="Roles & permissions"
      crumb="Roles & permissions"
      title="Roles & permissions"
      subtitle="Org-defined roles and what each one can reach."
    >
      <div className="atbl">
        <table>
          <tbody>
            <tr>
              <th>Role</th>
              <th>Type</th>
              <th>People</th>
              <th>Permissions</th>
              <th />
            </tr>
            <tr>
              <td><b>Everyone</b></td>
              <td><span className="chip sys">System</span></td>
              <td>8</td>
              <td><span className="chip">View granted apps</span></td>
              <td className="dots">⋯</td>
            </tr>
            <tr>
              <td><b>Growth</b></td>
              <td><span className="chip">Custom</span></td>
              <td>3</td>
              <td>
                <span className="chip"><PostHogMark />PostHog</span>
                <span className="chip"><BigQueryMark />BigQuery · 3 queries</span>
                <span className="chip">Customer 360</span>
              </td>
              <td className="dots">⋯</td>
            </tr>
            <tr>
              <td><b>Finance</b></td>
              <td><span className="chip">Custom</span></td>
              <td>2</td>
              <td>
                <span className="chip"><StripeMark />Stripe</span>
                <span className="chip"><BigQueryMark />BigQuery · 1 query</span>
              </td>
              <td className="dots">⋯</td>
            </tr>
            <tr>
              <td><b>Admins</b></td>
              <td><span className="chip sys">System</span></td>
              <td>2</td>
              <td><span className="chip all">Everything</span></td>
              <td className="dots">⋯</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Shell>
  )
}

const LOG_ROWS: [string, string, string, string, 'ok' | 'er', string][] = [
  ['09:41:02', 'crm', 'sonnet-4.5', '1,204', 'ok', '1.8s'],
  ['09:40:51', 'customer-360', 'opus-4.8', '6,318', 'ok', '4.2s'],
  ['09:40:12', 'report', 'sonnet-4.5', '842', 'ok', '0.9s'],
  ['09:38:47', 'artifacts', 'sonnet-4.5', '0', 'er', '0.1s'],
  ['09:37:30', 'crm', 'sonnet-4.5', '1,511', 'ok', '2.1s'],
  ['09:35:04', 'welcome', 'sonnet-4.5', '396', 'ok', '1.2s'],
]

export function LogsConsole(props: { you: You }) {
  return (
    <Shell
      you={props.you}
      group="Audit logs"
      page="AI & Agents"
      crumb="Audit logs / AI & Agents"
      title="AI & Agents logs"
      subtitle="Every model call your apps and agents made through the gateway."
    >
      <div className="atbl">
        <table>
          <tbody>
            <tr>
              <th>Time</th>
              <th>App</th>
              <th>Model</th>
              <th>Tokens</th>
              <th>Status</th>
              <th>Duration</th>
            </tr>
            {LOG_ROWS.map((r) => (
              <tr key={r[0]}>
                <td className="mono">{r[0]}</td>
                <td>{r[1]}</td>
                <td className="mono">{r[2]}</td>
                <td className="mono">{r[3]}</td>
                <td><span className={'st ' + r[4]}>{r[4] === 'ok' ? '200' : '429'}</span></td>
                <td className="mono">{r[5]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  )
}
