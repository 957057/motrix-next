; Native integration for Rayburst installations.

!macro NSIS_HOOK_PREINSTALL
  nsExec::Exec 'taskkill /F /IM rayburst-engine.exe'
  nsExec::Exec 'taskkill /F /IM rayburst-browser-launcher.exe'
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Register the allowlisted, activation-only native messaging host.
  WriteRegStr SHCTX \
    "Software\Google\Chrome\NativeMessagingHosts\dev.aninsomniacy.rayburst.browser" \
    "" "$INSTDIR\native-messaging\manifests\chromium.json"
  WriteRegStr SHCTX \
    "Software\Microsoft\Edge\NativeMessagingHosts\dev.aninsomniacy.rayburst.browser" \
    "" "$INSTDIR\native-messaging\manifests\chromium.json"
  WriteRegStr SHCTX \
    "Software\Mozilla\NativeMessagingHosts\dev.aninsomniacy.rayburst.browser" \
    "" "$INSTDIR\native-messaging\manifests\firefox.json"

  ; Ask the Windows shell to refresh application icons.
  nsExec::ExecToLog 'ie4uinit.exe -show'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Remove only registrations that still belong to this installation.
  ReadRegStr $R0 SHCTX \
    "Software\Google\Chrome\NativeMessagingHosts\dev.aninsomniacy.rayburst.browser" ""
  ${If} $R0 == "$INSTDIR\native-messaging\manifests\chromium.json"
    DeleteRegKey SHCTX \
      "Software\Google\Chrome\NativeMessagingHosts\dev.aninsomniacy.rayburst.browser"
  ${EndIf}
  ReadRegStr $R0 SHCTX \
    "Software\Microsoft\Edge\NativeMessagingHosts\dev.aninsomniacy.rayburst.browser" ""
  ${If} $R0 == "$INSTDIR\native-messaging\manifests\chromium.json"
    DeleteRegKey SHCTX \
      "Software\Microsoft\Edge\NativeMessagingHosts\dev.aninsomniacy.rayburst.browser"
  ${EndIf}
  ReadRegStr $R0 SHCTX \
    "Software\Mozilla\NativeMessagingHosts\dev.aninsomniacy.rayburst.browser" ""
  ${If} $R0 == "$INSTDIR\native-messaging\manifests\firefox.json"
    DeleteRegKey SHCTX \
      "Software\Mozilla\NativeMessagingHosts\dev.aninsomniacy.rayburst.browser"
  ${EndIf}

  ; Runtime repair writes HKCU even for per-machine installs.
  ReadRegStr $R0 HKCU \
    "Software\Google\Chrome\NativeMessagingHosts\dev.aninsomniacy.rayburst.browser" ""
  ${If} $R0 == "$INSTDIR\native-messaging\manifests\chromium.json"
    DeleteRegKey HKCU \
      "Software\Google\Chrome\NativeMessagingHosts\dev.aninsomniacy.rayburst.browser"
  ${EndIf}
  ReadRegStr $R0 HKCU \
    "Software\Microsoft\Edge\NativeMessagingHosts\dev.aninsomniacy.rayburst.browser" ""
  ${If} $R0 == "$INSTDIR\native-messaging\manifests\chromium.json"
    DeleteRegKey HKCU \
      "Software\Microsoft\Edge\NativeMessagingHosts\dev.aninsomniacy.rayburst.browser"
  ${EndIf}
  ReadRegStr $R0 HKCU \
    "Software\Mozilla\NativeMessagingHosts\dev.aninsomniacy.rayburst.browser" ""
  ${If} $R0 == "$INSTDIR\native-messaging\manifests\firefox.json"
    DeleteRegKey HKCU \
      "Software\Mozilla\NativeMessagingHosts\dev.aninsomniacy.rayburst.browser"
  ${EndIf}
!macroend
