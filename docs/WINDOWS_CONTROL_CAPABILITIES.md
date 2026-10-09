# Remaining Windows controls: native capability audit

Reviewed October 8, 2026 against current source and Microsoft documentation. The fallback requested for unsupported direct toggles is already implemented: approved Settings actions use `WindowsSystemControlService.open` -> shared `WindowsBridgeClient` -> C++ `windows.openUri` -> `ShellExecuteExW`. Java retains approval/profile policy, not OS launch execution. No PowerShell or Java-launched Explorer helper is involved.

| Dashboard control | Direct-control finding | Retained native behavior |
| --- | --- | --- |
| Night light | No supported general-purpose Night light on/off API found for this desktop app. Gamma-ramp manipulation is not the Windows Night light setting. | Open `ms-settings:nightlight` through C++ |
| Battery saver | Documented `EnergySaverStatus` is read-only. Power scheme APIs change plans, not the same consumer saver toggle. No supported equivalent setter found in the reviewed APIs. | Open `ms-settings:batterysaver` through C++ |
| Focus | Focus-session start/deactivate APIs exist but are Limited Access Features requiring Microsoft-issued access. Sessions are not an unrestricted Focus Assist/Do Not Disturb switch. | Retain `ms-settings:quiethours` through C++ |
| Microphone privacy | Audio endpoint mute is a different operation from Windows microphone privacy/consent. No equivalent ordinary-app global privacy setter identified. | Open `ms-settings:privacy-microphone` through C++ |

These findings are scoped to supported public APIs usable by this unpackaged application, not a claim that private APIs, enterprise management, or reverse-engineered methods do not exist. Changing language cannot remove OS permission/API restrictions. No undocumented CloudStore edits, threshold/power-plan substitutions, gamma tricks, consent overrides, or Settings UI automation were added. Battery saver Settings availability depends on the device/Windows version; Microsoft documents the URI for battery-equipped devices.

The existing action result reports the URI opened, not a verified on/off state. Controls remain `direct: false`. Exact-URI profile approvals are unchanged: first use waits for approval, subsequent matching uses execute immediately. Bridge failure reports failure rather than retrying or falling back to a shell.

## Sources

- [Microsoft Settings URI reference](https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-settings): supported Settings launch targets, not direct setting mutation.
- [SetDeviceGammaRamp](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-setdevicegammaramp): Microsoft discourages gamma manipulation and recommends directing users to Night light.
- [PowerManager.EnergySaverStatus](https://learn.microsoft.com/en-us/uwp/api/windows.system.power.powermanager.energysaverstatus?view=winrt-26100): getter-only status API.
- [PowerSetActiveScheme](https://learn.microsoft.com/en-us/windows/win32/api/powersetting/nf-powersetting-powersetactivescheme): active power plan operation.
- [FocusSessionManager](https://learn.microsoft.com/en-us/uwp/api/windows.ui.shell.focussessionmanager?view=winrt-26100): limited-access start/deactivate requirements.
- [IAudioEndpointVolume.SetMute](https://learn.microsoft.com/en-us/windows/win32/api/endpointvolume/nf-endpointvolume-iaudioendpointvolume-setmute): endpoint mute, not OS privacy policy.

## Regression coverage

Tests verify all four shortcut URIs delegate to the native bridge, are not advertised as direct toggles, fail honestly on a bridge error, and launch only after approval while retaining exact-URI reusable approval behavior. These mock-based tests do not open Settings, change hardware/privacy state, or establish visible OS-page behavior. Native URI launch implementation was already present; this audit adds tests/documentation, not a new production control or a native rebuild requirement.

The full backend suite passed 34 tests on October 8, 2026, with zero failures, errors, or skips. Diff whitespace checks passed. No restart was needed because production code did not change.
