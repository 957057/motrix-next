# Code signing

Local Rayburst builds are not official signed releases. The default build omits
updater artifacts; macOS uses ad-hoc signing. No Apple notarization is configured.

## Tauri updater signatures

Tauri signs update packages with the private key corresponding to the public key
in `src-tauri/tauri.conf.json`. Release builds enable updater artifacts through
`src-tauri/tauri.release.conf.json`; the workflow reads `TAURI_SIGNING_PRIVATE_KEY`
and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` from repository secrets.

These signatures verify updater payloads. They do not establish a Windows or
macOS publisher identity. Keep the private key out of source control and logs;
changing the embedded public key is a distribution decision, not a branding edit.
See [Tauri's updater signing documentation](https://v2.tauri.app/plugin/updater/).

## Windows Authenticode

[SignPath Windows Release](../.github/workflows/sign-windows-release.yml) is a
separate manual workflow. Configure its service project and artifact rules for
Rayburst before running it:

| Type     | Name                                           | Purpose                            |
| -------- | ---------------------------------------------- | ---------------------------------- |
| Secret   | `SIGNPATH_API_TOKEN`                           | Signing service access             |
| Variable | `SIGNPATH_ORGANIZATION_ID`                     | SignPath organization              |
| Variable | `SIGNPATH_PROJECT_SLUG`                        | Project configured for Rayburst    |
| Variable | `SIGNPATH_RELEASE_ARTIFACT_CONFIGURATION_SLUG` | Rules matching Rayburst installers |

The workflow uses the `release-signing` policy. It resolves the latest published
stable and prerelease, downloads their x64/ARM64 NSIS installers and submits one
signing bundle. It has no version selector. Inspect the resolved tags and missing
asset report; do not assume every target was available.

After signing, it checks that each installer has a certificate whose subject
contains `CN=SignPath Foundation`, regenerates the Tauri `.sig` files from the
signed bytes, replaces the release assets and refreshes the channel JSON. The
current workflow checks the certificate subject, not the complete Authenticode
trust result. Inspect the final files with Windows `Get-AuthenticodeSignature`
and confirm `Status` is `Valid` before describing them as verified releases.

Never reuse an updater signature after changing installer bytes. A signing job
can affect both release channels; it is not a local build check. Follow
[Releasing](RELEASING.md) for release authorization, ordering and artifact checks.
