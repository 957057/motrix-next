import { describe, expect, it } from 'vitest'
import { buildAdvancedForm, transformAdvancedForStore } from '../useAdvancedPreference'
import { createDefaultAppConfig } from '@shared/utils/configHydration'

describe('Advanced preference ownership', () => {
  it('persists clipboard switches without owning connection settings', () => {
    const form = buildAdvancedForm(createDefaultAppConfig())
    expect(form).not.toHaveProperty('rpcListenPort')
    expect(form).not.toHaveProperty('rpcSecret')
    expect(form).not.toHaveProperty('allowRemoteAccess')
    const stored = transformAdvancedForStore({ ...form, clipboardSftp: false })
    expect(stored.clipboard).toMatchObject({ sftp: false })
    expect(stored).not.toHaveProperty('clipboardSftp')
    expect(stored).not.toHaveProperty('proxy')
    expect(stored).not.toHaveProperty('connectTimeout')
  })
})
