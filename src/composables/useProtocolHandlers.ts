/** @fileoverview Native association state and serialized user actions. */
import { computed, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { logger } from '@shared/logger'
import { getErrorMessage } from '@shared/utils/errorMessage'

export const protocolKeys = ['.torrent', 'magnet', 'ed2k', 'thunder', 'rayburst'] as const
export type ProtocolKey = (typeof protocolKeys)[number]
export interface AssociationStatus {
  state: 'current' | 'other' | 'unassigned' | 'unavailable' | 'error'
  handler: string | null
  error: string | null
  canChange: boolean
}
type ProtocolResult =
  | { kind: 'success' | 'unchanged' | 'manual' | 'cancelled' | 'query-failed' | 'ignored' }
  | { kind: 'failed'; reason: string }

function errorReason(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'Protocol' in error) return String(error.Protocol)
  return getErrorMessage(error)
}

export function useProtocolHandlers() {
  const status = ref<Partial<Record<ProtocolKey, AssociationStatus>>>({})
  const pending = ref<ProtocolKey | null>(null)
  const refreshing = ref(false)
  const busy = computed(() => refreshing.value || pending.value !== null)

  async function refreshProtocol(protocol: ProtocolKey): Promise<AssociationStatus> {
    try {
      const result = await invoke<AssociationStatus>('get_association_status', { protocol })
      status.value[protocol] = result
      return result
    } catch (error) {
      const reason = errorReason(error)
      logger.warn('Protocol.refresh', 'association query failed', { protocol, reason })
      const result: AssociationStatus = { state: 'error', handler: null, error: reason, canChange: true }
      status.value[protocol] = result
      return result
    }
  }

  async function refreshAll(): Promise<void> {
    if (busy.value) return
    refreshing.value = true
    try {
      await Promise.all(protocolKeys.map(refreshProtocol))
    } finally {
      refreshing.value = false
    }
  }

  async function setDefault(protocol: ProtocolKey): Promise<ProtocolResult> {
    if (busy.value || status.value[protocol]?.canChange === false) return { kind: 'ignored' }
    pending.value = protocol
    try {
      let failure: string | undefined
      try {
        await invoke('set_default_protocol_client', { protocol })
      } catch (error) {
        failure = errorReason(error)
        logger.debug('Protocol.change', 'operation returned an error', { protocol, reason: failure })
      }
      const actual = await refreshProtocol(protocol)
      if (failure === 'cancelled') return { kind: 'cancelled' }
      if (actual.state === 'current') return { kind: 'success' }
      if (failure === 'manual_change_required') return { kind: 'manual' }
      if (failure !== undefined) return { kind: 'failed', reason: failure }
      return { kind: actual.state === 'error' ? 'query-failed' : 'unchanged' }
    } finally {
      pending.value = null
    }
  }

  return { status: computed(() => status.value), pending: computed(() => pending.value), busy, refreshAll, setDefault }
}
