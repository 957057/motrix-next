/** Search metadata only. Configuration ownership remains in the preference forms. */
export const settingsCatalog: ReadonlyArray<{
  key: string
  category: string
  platforms?: string[]
  updates?: boolean
}> = [
  {
    key: 'preferences.appearance',
    category: 'general',
  },
  {
    key: 'preferences.color-scheme',
    category: 'general',
  },
  {
    key: 'preferences.custom-color-scheme',
    category: 'general',
  },
  {
    key: 'preferences.task-card-mode',
    category: 'general',
  },
  {
    key: 'preferences.reduce-motion',
    category: 'general',
  },
  {
    key: 'preferences.sidebar-task-counts',
    category: 'general',
  },
  {
    key: 'preferences.dock-badge-speed',
    category: 'general',
    platforms: ['macos'],
  },
  {
    key: 'preferences.select-language',
    category: 'general',
  },
  {
    key: 'preferences.open-at-login',
    category: 'general',
  },
  {
    key: 'preferences.auto-hide-window',
    category: 'general',
  },
  {
    key: 'preferences.keep-window-state',
    category: 'general',
  },
  {
    key: 'preferences.auto-resume-all',
    category: 'general',
  },
  {
    key: 'preferences.minimize-to-tray-on-close',
    category: 'general',
  },
  {
    key: 'preferences.hide-dock-on-minimize',
    category: 'general',
    platforms: ['macos'],
  },
  {
    key: 'preferences.tray-speedometer',
    category: 'general',
    platforms: ['macos', 'linux'],
  },
  {
    key: 'preferences.show-progress-bar',
    category: 'general',
  },
  {
    key: 'preferences.lightweight-mode',
    category: 'general',
  },
  {
    key: 'preferences.auto-check-update',
    category: 'general',
    updates: true,
  },
  {
    key: 'preferences.check-frequency',
    category: 'general',
    updates: true,
  },
  {
    key: 'preferences.update-channel',
    category: 'general',
    updates: true,
  },
  {
    key: 'preferences.last-check-update-time',
    category: 'general',
    updates: true,
  },
  {
    key: 'preferences.default-path',
    category: 'downloads',
  },
  {
    key: 'preferences.file-timestamp',
    category: 'downloads',
  },
  {
    key: 'preferences.file-category-save',
    category: 'downloads',
  },
  {
    key: 'preferences.media-select-before-download',
    category: 'downloads',
  },
  {
    key: 'preferences.media-default-format',
    category: 'downloads',
  },
  {
    key: 'preferences.max-concurrent-downloads',
    category: 'downloads',
  },
  {
    key: 'preferences.stream-max-connections',
    category: 'downloads',
  },
  {
    key: 'preferences.sharing-mode',
    category: 'downloads',
  },
  {
    key: 'preferences.share-ratio',
    category: 'downloads',
  },
  {
    key: 'preferences.max-tries',
    category: 'downloads',
  },
  {
    key: 'preferences.retry-wait',
    category: 'downloads',
  },
  {
    key: 'preferences.continue',
    category: 'downloads',
  },
  {
    key: 'app.speedometer-enable-limit',
    category: 'downloads',
  },
  {
    key: 'preferences.speed-schedule-enabled',
    category: 'downloads',
  },
  {
    key: 'preferences.schedule-from',
    category: 'downloads',
  },
  {
    key: 'preferences.schedule-to',
    category: 'downloads',
  },
  {
    key: 'preferences.schedule-days',
    category: 'downloads',
  },
  {
    key: 'preferences.transfer-speed-upload',
    category: 'downloads',
  },
  {
    key: 'preferences.transfer-speed-download',
    category: 'downloads',
  },
  {
    key: 'preferences.new-task-show-downloading',
    category: 'downloads',
  },
  {
    key: 'preferences.file-deletion-mode',
    category: 'downloads',
  },
  {
    key: 'preferences.no-confirm-before-delete-task',
    category: 'downloads',
  },
  {
    key: 'preferences.task-completed-notify',
    category: 'downloads',
  },
  {
    key: 'preferences.shutdown-when-complete',
    category: 'downloads',
  },
  {
    key: 'preferences.keep-awake',
    category: 'downloads',
  },
  {
    key: 'preferences.delete-torrent-after-complete',
    category: 'downloads',
  },
  {
    key: 'preferences.auto-delete-stale-records',
    category: 'downloads',
  },
  {
    key: 'preferences.clear-completed-on-exit',
    category: 'downloads',
  },
  {
    key: 'preferences.completed-record-retention',
    category: 'downloads',
  },
  {
    key: 'preferences.completed-record-retention-custom-days',
    category: 'downloads',
  },
  {
    key: 'task.use-proxy',
    category: 'network',
  },
  {
    key: 'preferences.proxy-server',
    category: 'network',
  },
  {
    key: 'preferences.proxy-username',
    category: 'network',
  },
  {
    key: 'preferences.proxy-password',
    category: 'network',
  },
  {
    key: 'preferences.proxy-bypass',
    category: 'network',
  },
  {
    key: 'preferences.proxy-scope',
    category: 'network',
  },
  {
    key: 'preferences.port-conflict-recovery-enable',
    category: 'network',
  },
  {
    key: 'preferences.port-conflict-recovery-range',
    category: 'network',
  },
  {
    key: 'preferences.port-conflict-recovery-apply-to',
    category: 'network',
  },
  {
    key: 'preferences.mock-user-agent',
    category: 'network',
  },
  {
    key: 'preferences.ua-saved',
    category: 'network',
  },
  {
    key: 'preferences.connect-timeout',
    category: 'network',
  },
  {
    key: 'preferences.timeout',
    category: 'network',
  },
  {
    key: 'preferences.file-allocation',
    category: 'network',
  },
  {
    key: 'preferences.magnet-file-selection',
    category: 'bt',
  },
  {
    key: 'preferences.bt-encryption',
    category: 'bt',
  },
  {
    key: 'preferences.bt-transport',
    category: 'bt',
  },
  {
    key: 'preferences.bt-first-last-piece-first',
    category: 'bt',
  },
  {
    key: 'preferences.bt-max-peers',
    category: 'bt',
  },
  {
    key: 'preferences.bt-max-connections',
    category: 'bt',
  },
  {
    key: 'preferences.bt-max-uploads',
    category: 'bt',
  },
  {
    key: 'preferences.bt-max-uploads-per-torrent',
    category: 'bt',
  },
  {
    key: 'preferences.bt-rate-limit-overhead',
    category: 'bt',
  },
  {
    key: 'preferences.bt-port',
    category: 'bt',
  },
  {
    key: 'preferences.bt-external-ip',
    category: 'bt',
  },
  {
    key: 'preferences.bt-external-port',
    category: 'bt',
  },
  {
    key: 'preferences.bt-peer-exchange',
    category: 'bt',
  },
  {
    key: 'preferences.bt-local-peer-discovery',
    category: 'bt',
  },
  {
    key: 'preferences.bt-dht',
    category: 'bt',
  },
  {
    key: 'preferences.bt-anonymous-mode',
    category: 'bt',
  },
  {
    key: 'preferences.bt-user-agent',
    category: 'bt',
  },
  {
    key: 'preferences.bt-peer-id-prefix',
    category: 'bt',
  },
  {
    key: 'preferences.bt-peer-blocklist-enable',
    category: 'bt',
  },
  {
    key: 'preferences.bt-peer-blocklist-url',
    category: 'bt',
  },
  {
    key: 'preferences.bt-blocklist-scope',
    category: 'bt',
  },
  {
    key: 'preferences.auto-sync',
    category: 'bt',
  },
  {
    key: 'preferences.sync-frequency',
    category: 'bt',
  },
  {
    key: 'preferences.bt-tracker-source-preset',
    category: 'bt',
  },
  {
    key: 'preferences.bt-tracker-source-custom',
    category: 'bt',
  },
  {
    key: 'preferences.bt-tracker-content',
    category: 'bt',
  },
  {
    key: 'preferences.ed2k-search-keyword',
    category: 'ed2k',
  },
  {
    key: 'preferences.ed2k-search-type',
    category: 'ed2k',
  },
  {
    key: 'preferences.ed2k-search-min-sources',
    category: 'ed2k',
  },
  {
    key: 'preferences.ed2k-search-timeout',
    category: 'ed2k',
  },
  {
    key: 'preferences.ed2k-listen-port',
    category: 'ed2k',
  },
  {
    key: 'preferences.ed2k-udp-listen-port',
    category: 'ed2k',
  },
  {
    key: 'preferences.ed2k-upload-slots',
    category: 'ed2k',
  },
  {
    key: 'preferences.ed2k-max-connections',
    category: 'ed2k',
  },
  {
    key: 'preferences.ed2k-preview-priority',
    category: 'ed2k',
  },
  {
    key: 'preferences.ed2k-server-met-url',
    category: 'ed2k',
  },
  {
    key: 'preferences.ed2k-nodes-dat-url',
    category: 'ed2k',
  },
  {
    key: 'preferences.ed2k-server',
    category: 'ed2k',
  },
  {
    key: 'preferences.auto-submit-from-extension',
    category: 'connections',
  },
  {
    key: 'preferences.silent-auto-submit-from-extension',
    category: 'connections',
  },
  {
    key: 'preferences.extension-api-port',
    category: 'connections',
  },
  {
    key: 'preferences.extension-api-secret',
    category: 'connections',
  },
  {
    key: 'preferences.rpc-listen-port',
    category: 'connections',
  },
  {
    key: 'preferences.rpc-secret',
    category: 'connections',
  },
  {
    key: 'preferences.allow-remote-access',
    category: 'connections',
  },
  {
    key: 'preferences.engine-maintenance',
    category: 'advanced',
  },
  {
    key: 'preferences.temp-files-dir',
    category: 'advanced',
  },
  {
    key: 'preferences.aria2-conf-path',
    category: 'advanced',
  },
  {
    key: 'preferences.engine-state-path',
    category: 'advanced',
  },
  {
    key: 'preferences.log-path',
    category: 'advanced',
  },
  {
    key: 'preferences.log-level',
    category: 'advanced',
  },
  {
    key: 'preferences.hardware-rendering',
    category: 'advanced',
    platforms: ['linux'],
  },
  {
    key: 'preferences.history-section',
    category: 'advanced',
  },
  {
    key: 'preferences.configuration-section',
    category: 'advanced',
  },
  {
    key: 'preferences.settings-backup',
    category: 'advanced',
  },
  {
    key: 'preferences.clipboard-auto-detect',
    category: 'advanced',
  },
]
