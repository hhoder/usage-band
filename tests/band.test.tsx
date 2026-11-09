import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-band',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 80, scroll: { offset: 0, bodyRows: 6 }, view: {} },
} as const

test('progress band draws on every surface', async ($, on) => {
  const now = Date.parse('2026-11-09T00:00:00Z')
  on('clock.now', () => ({ value: now }))
  on('state.get', () => ({
    value: {
      value: [
        { kind: 'five_hour', percentUsed: 60, resetsAt: '2026-11-09T04:00:00Z' },
        { kind: 'seven_day', percentUsed: 10, resetsAt: '2026-11-12T00:00:00Z' },
      ],
      version: 1,
    },
  }))
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /^40%$/ }))?.text).toBe('40%')
    expect(await ui.find({ type: 'Text', text: /⚡/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /⏲4h0m/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /⏲3d0h/ })).toBeTruthy()
    await ui.unmount()
  }
})
