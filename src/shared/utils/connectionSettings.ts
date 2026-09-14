import type { AppConfig } from '@shared/types'

export function buildConnectionsForm(config: AppConfig) {
  return {
    autoSubmitFromExtension: config.autoSubmitFromExtension,
    silentAutoSubmitFromExtension: config.silentAutoSubmitFromExtension,
    extensionApiPort: config.extensionApiPort,
    extensionApiSecret: config.extensionApiSecret,
    rpcListenPort: config.rpcListenPort,
    rpcSecret: config.rpcSecret,
    allowRemoteAccess: config.allowRemoteAccess,
  }
}

export type ConnectionsForm = ReturnType<typeof buildConnectionsForm>

export function buildConnectionsSystemConfig(form: ConnectionsForm) {
  return {
    'rpc-listen-port': String(form.rpcListenPort),
    'rpc-secret': form.rpcSecret,
    'allow-remote-access': String(form.allowRemoteAccess),
  }
}

export function needsConnectionRestart(next: ConnectionsForm, previous: Partial<AppConfig>) {
  return (
    next.rpcListenPort !== previous.rpcListenPort ||
    next.rpcSecret !== previous.rpcSecret ||
    next.allowRemoteAccess !== previous.allowRemoteAccess
  )
}
