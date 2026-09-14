/** Advanced settings own diagnostics, rendering, and clipboard behavior. */
import type { AppConfig } from '@shared/types'

export interface AdvancedForm {
  [key: string]: unknown
  logLevel: AppConfig['logLevel']
  aria2LogLevel: AppConfig['aria2LogLevel']
  tempFilesDir: string
  hardwareRendering: boolean
  clipboardEnable: boolean
  clipboardHttp: boolean
  clipboardSftp: boolean
  clipboardMagnet: boolean
  clipboardEd2k: boolean
  clipboardThunder: boolean
  clipboardBtHash: boolean
}

export function buildAdvancedForm(config: AppConfig): AdvancedForm {
  return {
    logLevel: config.logLevel,
    aria2LogLevel: config.aria2LogLevel,
    tempFilesDir: config.tempFilesDir,
    hardwareRendering: config.hardwareRendering,
    clipboardEnable: config.clipboard.enable,
    clipboardHttp: config.clipboard.http,
    clipboardSftp: config.clipboard.sftp,
    clipboardMagnet: config.clipboard.magnet,
    clipboardEd2k: config.clipboard.ed2k,
    clipboardThunder: config.clipboard.thunder,
    clipboardBtHash: config.clipboard.btHash,
  }
}

export function transformAdvancedForStore(form: AdvancedForm): Partial<AppConfig> {
  const {
    clipboardEnable,
    clipboardHttp,
    clipboardSftp,
    clipboardMagnet,
    clipboardEd2k,
    clipboardThunder,
    clipboardBtHash,
    ...rest
  } = form
  return {
    ...rest,
    clipboard: {
      enable: clipboardEnable,
      http: clipboardHttp,
      sftp: clipboardSftp,
      magnet: clipboardMagnet,
      ed2k: clipboardEd2k,
      thunder: clipboardThunder,
      btHash: clipboardBtHash,
    },
  }
}
