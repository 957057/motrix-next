import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { settingsCatalog } from '@shared/settingsCatalog'
import messages from '@shared/locales/en-US/messages.json'

describe('Settings search destinations', () => {
  it('resolves every localized result to a real field anchor', () => {
    const files: Record<string, string> = {
      general: 'General',
      downloads: 'Downloads',
      network: 'Network',
      bt: 'BitTorrent',
      ed2k: 'Ed2k',
      connections: 'Connections',
      advanced: 'Advanced',
    }
    const seen = new Set<string>()
    for (const item of settingsCatalog) {
      const [group, key] = item.key.split('.')
      expect((messages as Record<string, Record<string, string>>)[group]?.[key], item.key).toBeTruthy()
      expect(seen.has(item.key), item.key).toBe(false)
      seen.add(item.key)
      const source = readFileSync(`src/components/preference/${files[item.category]}.vue`, 'utf8')
      expect(source, item.key).toContain(`setting-key="${item.key}"`)
    }
  })
})
