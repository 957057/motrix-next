import { invoke } from '@tauri-apps/api/core'
import { useDialog } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useEngineStore } from '@/stores/engine'
import { usePreferenceStore } from '@/stores/preference'
import { usePreferenceForm } from './usePreferenceForm'
import {
  buildConnectionsForm,
  buildConnectionsSystemConfig,
  needsConnectionRestart,
} from '@shared/utils/connectionSettings'

export function useConnectionsPreference() {
  const preferences = usePreferenceStore()
  const engine = useEngineStore()
  const dialog = useDialog()
  const { t } = useI18n()

  async function applyRuntime(restart: boolean, port: number) {
    // Persistence refreshes the cache asynchronously; service binding must await it.
    await invoke('refresh_runtime_config')
    if (restart) {
      const result = await engine.restart('settingsChange')
      if (result.phase !== 'running') throw new Error('Download engine did not become ready')
      // Native port recovery may have selected and persisted different ports.
      if (!(await preferences.reloadPreferenceFromDisk())) throw new Error('Cannot read applied connection settings')
      port = preferences.config.extensionApiPort
    }
    const activePort = await invoke<number>('apply_http_api', { port })
    if (activePort !== preferences.config.extensionApiPort) {
      if (!(await preferences.updateAndSave({ extensionApiPort: activePort }))) {
        throw new Error('Cannot persist the active extension API port')
      }
    }
  }

  return usePreferenceForm({
    buildForm: () => buildConnectionsForm(preferences.config),
    buildSystemConfig: buildConnectionsSystemConfig,
    beforeSave: async (candidate) => {
      const previous = preferences.config
      const notices: string[] = []
      if (
        (!candidate.rpcSecret && previous.rpcSecret) ||
        (!candidate.extensionApiSecret && previous.extensionApiSecret)
      ) {
        notices.push(t('preferences.connection-auth-disabled'))
      }
      if (needsConnectionRestart(candidate, previous)) notices.push(t('preferences.engine-restart-confirm'))
      if (candidate.extensionApiPort !== previous.extensionApiPort) {
        notices.push(t('preferences.extension-api-port-confirm', { port: candidate.extensionApiPort }))
      }
      if (!notices.length) return true
      return new Promise<boolean>((resolve) => {
        dialog.warning({
          title: t('preferences.connections'),
          content: notices.join('\n\n'),
          positiveText: t('preferences.save'),
          negativeText: t('app.cancel'),
          maskClosable: false,
          onPositiveClick: () => resolve(true),
          onNegativeClick: () => resolve(false),
          onClose: () => resolve(false),
        })
      })
    },
    afterSave: async (candidate, previous) => {
      await applyRuntime(needsConnectionRestart(candidate, previous), candidate.extensionApiPort)
    },
    afterRollback: async (previous, attempted) => {
      await applyRuntime(needsConnectionRestart(attempted, previous), previous.extensionApiPort!)
      if (
        preferences.config.rpcListenPort !== previous.rpcListenPort ||
        preferences.config.extensionApiPort !== previous.extensionApiPort
      ) {
        throw new Error('Port recovery changed the restored connection settings')
      }
    },
    saveFeedback: () => ({
      success: t('preferences.save-success-message'),
      restored: t('preferences.connections-restored'),
      rollbackFailed: t('preferences.connections-restore-failed'),
    }),
  })
}
