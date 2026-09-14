import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref, toRaw } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { inspectTorrent } from '@/api/aria2'
import { createBatchItem } from '@shared/utils/batchHelpers'
import type { BatchItem, TorrentInspection } from '@shared/types'
import { chooseTorrentFile, resolveTorrentItem, resolveUnresolvedItems } from '../useAddTaskFileOps'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
vi.mock('@/api/aria2', () => ({ inspectTorrent: vi.fn() }))
vi.mock('@shared/logger', () => ({ logger: { error: vi.fn(), debug: vi.fn() } }))

const t = (key: string) => key
const inspection: TorrentInspection = {
  name: 'Release',
  mode: 'single',
  infoHashV1: 'a'.repeat(40),
  infoHashV2: '',
  totalLength: '100',
  files: [{ index: '1', path: 'Release.iso', length: '100' }],
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('Torrent file resolution', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(inspectTorrent).mockResolvedValue(inspection)
  })

  it('shares one request across dialog opening, batch updates and reactive identities', async () => {
    const response = deferred<number[]>()
    vi.mocked(invoke).mockReturnValue(response.promise)
    const item = reactive(createBatchItem('torrent', 'https://example.test/release.torrent'))
    const opening = resolveUnresolvedItems([item], t)
    const appending = resolveUnresolvedItems([item], t)
    const retrying = resolveTorrentItem(toRaw(item), t)
    expect(invoke).toHaveBeenCalledOnce()

    response.resolve([100, 101])
    await Promise.all([opening, appending, retrying])
    expect(inspectTorrent).toHaveBeenCalledOnce()
    expect(inspectTorrent).toHaveBeenCalledWith({ torrent: 'ZGU=' })
    expect(item.inspectionState).toBe('ready')
    expect(item.selectedFileIndices).toEqual([1])
  })

  it('keeps inspection in the same operation when retry is requested during parsing', async () => {
    const parsing = deferred<TorrentInspection>()
    vi.mocked(invoke).mockResolvedValue([100, 101])
    vi.mocked(inspectTorrent).mockReturnValue(parsing.promise)
    const item = createBatchItem('torrent', 'C:\\Downloads\\release.torrent')
    const first = resolveTorrentItem(item, t)
    await flushPromises()
    expect(item.inspectionState).toBe('inspecting')
    expect(resolveTorrentItem(item, t)).toBe(first)
    expect(invoke).toHaveBeenCalledOnce()
    parsing.resolve(inspection)
    await first
  })

  it('does not parse failed downloads and permits one fresh request on retry', async () => {
    vi.mocked(invoke).mockRejectedValueOnce({ Io: 'Connection refused' })
    const item = createBatchItem('torrent', 'http://localhost:8080/release.torrent')
    await resolveTorrentItem(item, t)
    expect(item.error).toBe('task.file-load-failed')
    expect(item.inspectionState).toBe('failed')
    expect(inspectTorrent).not.toHaveBeenCalled()

    const response = deferred<number[]>()
    vi.mocked(invoke).mockReturnValue(response.promise)
    const retry = resolveTorrentItem(item, t)
    expect(item.error).toBeUndefined()
    expect(item.inspectionState).toBe('reading')
    expect(resolveTorrentItem(item, t)).toBe(retry)
    response.resolve([100, 101])
    await retry
    expect(invoke).toHaveBeenCalledTimes(2)
    expect(item.status).toBe('pending')
    expect(item.inspectionState).toBe('ready')
  })

  it.each([
    ['invalidMetainfo', 'task.error-bencode-parse'],
    ['torrentTooLarge', 'task.torrent-too-large'],
  ])('distinguishes native inspection failure %s from a read failure', async (kind, message) => {
    vi.mocked(invoke).mockResolvedValue([100, 101])
    vi.mocked(inspectTorrent).mockRejectedValue({ TorrentInspection: { kind } })
    const item = createBatchItem('torrent', 'C:\\Downloads\\release.torrent')
    await resolveTorrentItem(item, t)
    expect(item.error).toBe(message)
    expect(item.torrentMeta).toBeUndefined()
    expect(item.selectedFileIndices).toBeUndefined()
  })

  it('keeps credentials independent for different entries with the same URL', async () => {
    vi.mocked(invoke).mockResolvedValue([100, 101])
    const url = 'https://example.test/release.torrent?token=a%2Fb'
    const first = createBatchItem('torrent', url)
    const second = createBatchItem('torrent', url)
    first.browserContext = {
      cookie: 'session=first',
      userAgent: 'Browser/1.0',
      referer: 'https://example.test/downloads',
      requestHeaders: [{ name: 'Accept-Language', value: 'en-US' }],
    }
    second.browserContext = { cookie: 'session=second' }
    await resolveUnresolvedItems([first, second], t, 'http://127.0.0.1:9000')
    expect(invoke).toHaveBeenCalledTimes(2)
    expect(invoke).toHaveBeenNthCalledWith(1, 'fetch_remote_bytes', {
      url,
      proxy: 'http://127.0.0.1:9000',
      referer: 'https://example.test/downloads',
      cookie: 'session=first',
      userAgent: 'Browser/1.0',
      requestHeaders: [{ name: 'Accept-Language', value: 'en-US' }],
    })
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      'fetch_remote_bytes',
      expect.objectContaining({ cookie: 'session=second' }),
    )
  })

  it('shows selected local files before their reads complete and shares work with the batch watcher', async () => {
    const response = deferred<number[]>()
    vi.mocked(open).mockResolvedValue(['C:\\Downloads\\release.torrent'])
    vi.mocked(invoke).mockReturnValue(response.promise)
    const batch = ref<BatchItem[]>([])
    const selectedBatchIndex = ref(0)
    const choosing = chooseTorrentFile({
      t,
      batch,
      fileItems: computed(() => batch.value),
      selectedBatchIndex,
      setPendingBatch: (items) => {
        batch.value = items
      },
      showWarning: vi.fn(),
    })
    await flushPromises()
    expect(batch.value).toHaveLength(1)
    expect(batch.value[0].inspectionState).toBe('reading')
    const watcher = resolveUnresolvedItems(batch.value, t)
    expect(invoke).toHaveBeenCalledOnce()
    response.resolve([100, 101])
    await Promise.all([choosing, watcher])
    expect(batch.value[0].inspectionState).toBe('ready')
  })
})
