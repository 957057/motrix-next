/**
 * @fileoverview Pure functions for the BitTorrent preference tab.
 *
 * Manages BT-specific config: auto-download content, encryption,
 * connection, discovery, seeding, max peers, and tracker management. Key business logic:
 * - btAutoDownloadContent ↔ pauseMetadata
 * - Tracker comma ↔ newline format conversion
 *
 * Tracker source URL validation (isValidTrackerSourceUrl) is co-located
 * here since it is only used in the BT tab's tracker source management.
 */
import type { AppConfig, BtEncryptionMode } from '@shared/types'
import { DEFAULT_APP_CONFIG as D } from '@shared/constants'
import { PORT_RECOVERY_RANGE_END, PORT_RECOVERY_RANGE_START } from '@shared/constants'
import { convertCommaToLine, convertLineToComma, generateRandomInt } from '@shared/utils'
import { isValidOptionalIpAddress } from '@shared/utils/ipAddress'

// ── URL Validation ──────────────────────────────────────────────────

/**
 * Validates whether a string is a valid HTTP/HTTPS URL suitable for use as a
 * tracker source. Custom tracker sources are fetched over HTTP, so only
 * HTTP-based protocols are accepted.
 */
export function isValidTrackerSourceUrl(input: string): boolean {
  const trimmed = input.trim()
  if (!trimmed) return false
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

// ── Types ───────────────────────────────────────────────────────────

export interface BtForm {
  [key: string]: unknown
  btAutoDownloadContent: boolean
  btEncryption: BtEncryptionMode
  btDhtEnabled: boolean
  btPeerExchangeEnabled: boolean
  btLocalPeerDiscoveryEnabled: boolean
  btMaxPeers: number
  listenPort: number
  btExternalIp: string
  btExternalPort: number
  sharingMode: 'stop-by-condition' | 'manual-stop'
  shareRatio: number
  shareTime: number
  btPeerBlocklistEnabled: boolean
  btPeerBlocklistUrl: string
  btPeerBlocklistAutoSync: boolean
  btPeerBlocklistSyncIntervalHours: number
  trackerSource: string[]
  customTrackerUrls: string[]
  btTracker: string
  btTrackerAutoSync: boolean
  btTrackerSyncIntervalHours: number
  lastSyncTrackerTime: number
}

// ── Pure Functions ──────────────────────────────────────────────────

/**
 * Builds the BT form state from the preference store config.
 * Maps pauseMetadata into btAutoDownloadContent.
 */
export function buildBtForm(config: AppConfig): BtForm {
  const pauseMetadata = config.pauseMetadata ?? D.pauseMetadata
  const btAutoDownloadContent = !pauseMetadata

  return {
    btAutoDownloadContent,
    btEncryption: config.btEncryption ?? D.btEncryption,
    btDhtEnabled: config.btDhtEnabled ?? D.btDhtEnabled,
    btPeerExchangeEnabled: config.btPeerExchangeEnabled ?? D.btPeerExchangeEnabled,
    btLocalPeerDiscoveryEnabled: config.btLocalPeerDiscoveryEnabled ?? D.btLocalPeerDiscoveryEnabled,
    btMaxPeers: config.btMaxPeers ?? D.btMaxPeers,
    listenPort: Number(config.listenPort ?? D.listenPort),
    btExternalIp: config.btExternalIp ?? D.btExternalIp,
    btExternalPort: Number(config.btExternalPort ?? D.btExternalPort),
    sharingMode: (config.keepSharing ?? D.keepSharing) ? 'manual-stop' : 'stop-by-condition',
    shareRatio: config.shareRatio ?? D.shareRatio,
    shareTime: config.shareTime ?? D.shareTime,
    btPeerBlocklistEnabled: config.btPeerBlocklistEnabled ?? D.btPeerBlocklistEnabled,
    btPeerBlocklistUrl: config.btPeerBlocklistUrl ?? D.btPeerBlocklistUrl,
    btPeerBlocklistAutoSync: config.btPeerBlocklistAutoSync ?? D.btPeerBlocklistAutoSync,
    btPeerBlocklistSyncIntervalHours: Number(
      config.btPeerBlocklistSyncIntervalHours ?? D.btPeerBlocklistSyncIntervalHours,
    ),
    trackerSource: config.trackerSource ?? [...D.trackerSource],
    customTrackerUrls: config.customTrackerUrls ?? [...D.customTrackerUrls],
    btTracker: convertCommaToLine(config.btTracker ?? D.btTracker),
    btTrackerAutoSync: config.btTrackerAutoSync ?? D.btTrackerAutoSync,
    btTrackerSyncIntervalHours: Number(config.btTrackerSyncIntervalHours ?? D.btTrackerSyncIntervalHours),
    lastSyncTrackerTime: config.lastSyncTrackerTime ?? D.lastSyncTrackerTime,
  }
}

/**
 * Converts the BT form into aria2 system config key-value pairs.
 * Handles btAutoDownloadContent → pause-metadata.
 *
 * IMPORTANT: force-save is intentionally excluded from global config.
 * It must only be set per-download on BT tasks to prevent aria2 from
 * re-downloading completed HTTP tasks on restart.
 */
export function buildBtSystemConfig(f: BtForm): Record<string, string> {
  const autoContent = !!f.btAutoDownloadContent
  const keepSharing = f.sharingMode === 'manual-stop'
  return {
    'detach-share-only': 'true',
    'seed-ratio': keepSharing ? '0' : String(f.shareRatio),
    'seed-time': keepSharing ? '' : String(f.shareTime),
    'keep-sharing': String(keepSharing),
    'bt-max-peers': String(f.btMaxPeers),
    'listen-port': String(f.listenPort),
    'bt-external-ip': f.btExternalIp.trim(),
    'bt-external-port': String(f.btExternalPort),
    'bt-encryption': f.btEncryption,
    'enable-dht': String(!!f.btDhtEnabled),
    'enable-peer-exchange': String(!!f.btPeerExchangeEnabled),
    'bt-enable-lpd': String(!!f.btLocalPeerDiscoveryEnabled),
    'pause-metadata': String(!autoContent),
    'bt-tracker': convertLineToComma(f.btTracker),
  }
}

export function validateBtEndpoint(f: BtForm): string | null {
  if (!Number.isInteger(f.listenPort) || f.listenPort < 1024 || f.listenPort > 65535) {
    return 'preferences.bt-port-unavailable'
  }
  if (!isValidOptionalIpAddress(f.btExternalIp)) {
    return 'preferences.bt-external-ip-invalid'
  }
  if (!Number.isInteger(f.btExternalPort) || f.btExternalPort < 0 || f.btExternalPort > 65535) {
    return 'preferences.bt-external-port-invalid'
  }
  return null
}

export function randomBtPort(): number {
  return generateRandomInt(PORT_RECOVERY_RANGE_START, PORT_RECOVERY_RANGE_END + 1)
}

/**
 * Transforms the BT form for store persistence.
 * Expands btAutoDownloadContent back into pauseMetadata.
 * Converts tracker newline format back to comma-separated for storage.
 */
export function transformBtForStore(f: BtForm): Partial<AppConfig> {
  const data = { ...f } as Partial<AppConfig> & Record<string, unknown>

  delete data.btAutoDownloadContent
  delete data.sharingMode

  if (f.btAutoDownloadContent) {
    data.pauseMetadata = false
  } else {
    data.pauseMetadata = true
  }

  data.btTracker = convertLineToComma(f.btTracker)
  data.keepSharing = f.sharingMode === 'manual-stop'

  return data
}
