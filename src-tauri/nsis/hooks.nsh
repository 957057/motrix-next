; The scoped hooks below replace Tauri's basename-only process check, which
; could terminate a different Rayburst installation.
!macroundef CheckIfAppIsRunning
!macro CheckIfAppIsRunning executableName productName
!macroend

; Run the new executable from NSIS-owned temporary storage. No installed file
; is replaced until the exact installation's processes have exited.
!macro RAYBURST_PREPARE_INSTALL
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File /oname=rayburst-maintenance.exe "${MAINBINARYSRCPATH}"
  nsExec::ExecToStack '"$PLUGINSDIR\rayburst-maintenance.exe" --prepare-install "$INSTDIR"'
  Pop $R0
  Pop $R1
  SetOutPath "$INSTDIR"
  ${If} $R0 != 0
    DetailPrint "$R1"
    Abort "Rayburst could not stop the installed processes. $R1"
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro RAYBURST_PREPARE_INSTALL
!macroend

; Rayburst Native Messaging registration and icon refresh.

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

  ; Flush Windows icon cache so updated icons appear immediately.
  ; ie4uinit.exe is a built-in Windows 10/11 system utility that
  ; soft-refreshes the shell icon display without requiring a reboot.
  ; This is the industry-standard approach used by Electron, VS Code,
  ; and other major desktop applications.
  nsExec::ExecToLog 'ie4uinit.exe -show'
!macroend

!macro RAYBURST_REMOVE_PROTOCOL scheme
  ReadRegStr $R0 HKCU "Software\Classes\${scheme}\shell\open\command" ""
  ${If} $R0 == '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
    DeleteRegKey HKCU "Software\Classes\${scheme}"
  ${EndIf}
  ReadRegStr $R0 HKCU "Software\Classes\${BUNDLEID}.${scheme}\shell\open\command" ""
  ${If} $R0 == '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
    DeleteRegKey HKCU "Software\Classes\${BUNDLEID}.${scheme}"
    DeleteRegValue HKCU "Software\${BUNDLEID}\Capabilities\URLAssociations" "${scheme}"
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro RAYBURST_PREPARE_INSTALL
  !insertmacro RAYBURST_REMOVE_PROTOCOL rayburst
  !insertmacro RAYBURST_REMOVE_PROTOCOL magnet
  !insertmacro RAYBURST_REMOVE_PROTOCOL ed2k
  !insertmacro RAYBURST_REMOVE_PROTOCOL thunder
  ReadRegStr $R0 HKCU "Software\${BUNDLEID}\Capabilities" "ApplicationIcon"
  ${If} $R0 == '"$INSTDIR\${MAINBINARYNAME}.exe",0'
    ClearErrors
    EnumRegValue $R1 HKCU "Software\${BUNDLEID}\Capabilities\URLAssociations" 0
    ${If} ${Errors}
      DeleteRegKey HKCU "Software\${BUNDLEID}\Capabilities"
      DeleteRegValue HKCU "Software\RegisteredApplications" "${BUNDLEID}"
    ${EndIf}
  ${EndIf}
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
