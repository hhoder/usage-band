import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface } from 'claude-code'

import type { Limit } from '../types'

// Bar design borrowed from sirmalloc/ccstatusline (Block/Weekly Usage):
// remaining-bar colored by level, plus a time cursor showing how much of the window has passed.

const limits = atom({ plugin: 'usage-band', key: 'limits' } as const, [] as Limit[])

const WINDOWS: Record<string, { name: string; ms?: number }> = {
  five_hour: { name: '5h', ms: 5 * 3600_000 },
  seven_day: { name: '7d', ms: 7 * 86400_000 },
  spend_limit: { name: '$' },
}

// Unknown kinds (e.g. a per-model weekly window): shorten "seven_day_fable" -> "7d-fable"
function shortName(kind: string): string {
  return kind.replace('five_hour', '5h').replace('seven_day', '7d').replace(/_/g, '-')
}

type Row = {
  name: string
  left: number
  elapsed?: number
  until: string
  color: 'success' | 'warning' | 'error'
  fast: boolean
}

function untilText(ms: number): string {
  if (!(ms > 0)) return 'now'
  const m = Math.round(ms / 60000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  if (d > 0) return `${d}d${h}h`
  if (h > 0) return `${h}h${m % 60}m`
  return `${m}m`
}

function rows(list: readonly Limit[], now: number): Row[] {
  return list.map(l => {
    const w = WINDOWS[l.kind] ?? { name: shortName(l.kind), ms: l.kind.startsWith('seven_day') ? 7 * 86400_000 : undefined }
    const left = Math.max(0, Math.min(100, Math.round(100 - l.percentUsed)))
    const toReset = l.resetsAt ? Date.parse(l.resetsAt) - now : NaN
    const elapsed =
      w.ms && toReset > 0 ? Math.max(0, Math.min(100, Math.round(100 - (toReset / w.ms) * 100))) : undefined
    return {
      name: w.name,
      left,
      elapsed,
      until: Number.isNaN(toReset) ? '' : untilText(toReset),
      color: left > 50 ? 'success' : left > 20 ? 'warning' : 'error',
      fast: elapsed !== undefined && l.percentUsed > elapsed + 10,
    }
  })
}

function statusText(rs: Row[]): string {
  return rs.map(r => `${r.name} ${r.left}%${r.until ? ` ⏲${r.until}` : ''}`).join(' · ')
}

// Terminal: character bar, │ is the time cursor
function textBar(r: Row, width = 10): string {
  const filled = Math.round((r.left / 100) * width)
  const cells: string[] = Array.from({ length: width }, (_, i) => (i < filled ? '█' : '·'))
  if (r.elapsed !== undefined) {
    cells[Math.min(width - 1, Math.round(((100 - r.elapsed) / 100) * width))] = '│'
  }
  return cells.join('')
}

// One-line text version with character bars, for footers and command output
function textLine(rs: Row[]): string {
  return rs
    .map(r => `${r.name} ${textBar(r)} ${r.left}%${r.until ? ` ⏲${r.until}` : ''}${r.fast ? ' ⚡' : ''}`)
    .join('   ')
}

// Desktop app only: true when the session draws on any surface other than the terminal
async function inApp($: EngineInterface): Promise<boolean> {
  return (await $.session.surfaces()).some(s => s !== 'terminal')
}

async function refresh($: EngineInterface, list?: readonly Limit[]) {
  const got = list ?? (await $.session.usage()).rateLimits
  await update($, limits, () => got.map((l: Limit) => ({ ...l })))
  const text = statusText(rows(got, await $.clock.now()))
  $.ui.status((await inApp($)) ? text || undefined : undefined)
}

const PANE = 'usage-band'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command.register({ name: 'usage-raw', description: 'Show raw rate-limit windows' })
    await $.command.register({ name: 'usage-pane', description: 'Open the usage pane' })
    await refresh($)
    return r
  })

  on('command.run', { command: 'usage-pane' }, async $ => {
    const { isPlaced } = await $.ui.open({ id: PANE, title: 'Usage' })
    await refresh($)
    if (isPlaced) return { text: 'Usage pane opened.' }
    const line = textLine(rows(await read($, limits), await $.clock.now()))
    return { text: line || 'No usage data yet — send a message.' }
  })

  // Side pane (only via /usage-pane): same one-line character bars as the band
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    const rs = rows(await read($, limits), await $.clock.now())
    if (rs.length === 0) return <Text dimColor>No usage data yet — send a message.</Text>

    return <Text>{textLine(rs)}</Text>
  })

  on('command.run', { command: 'usage-raw' }, async $ => {
    const got = (await $.session.usage()).rateLimits
    await refresh($, got)
    return { text: got.length ? JSON.stringify(got, null, 2) : 'No rate-limit data yet' }
  })

  on('session.measure', async ($, e, next) => {
    await refresh($, e.rateLimits)
    return next(e)
  })

  // Footer under each main reply, desktop app only (skipped in a terminal-only session).
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    await refresh($)
    if (e.agentId !== undefined || !(await inApp($))) return r
    const line = textLine(rows(await read($, limits), await $.clock.now()))
    return line ? { ...r, text: line } : r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, limits)
    if (e.surface === 'terminal' || e.props.hasSurvey || list.length === 0) return next(e)

    const rs = rows(list, await $.clock.now())
    const { Text } = $.ui.resolve(e)

    return <Text>{textLine(rs)}</Text>
  })
}
