# Windows controls

Current behavior is defined by `SystemService`, `WindowsSystemControlService`, `ActionService` and native `capabilities.cpp`. Java owns profile approvals; C++ executes Windows calls. No shell fallback exists.

| Control | Behavior |
| --- | --- |
| Wi-Fi, Bluetooth | Direct WinRT radio change where available/permitted; result confirms observed state |
| Focus | Open `ms-settings:quiethours` |
| Night light | Open `ms-settings:nightlight` |
| Mic privacy | Open `ms-settings:privacy-microphone` |
| Battery saver | Open `ms-settings:batterysaver` (page availability varies by device/Windows) |

The four Settings shortcuts advertise `direct: false`. Their results confirm a URI opened, not a toggle changed. First use requires profile approval; matching later uses reuse exact-URI scope. Radio approvals cover the displayed reusable on/off scope. Bridge failures report failure and never automatically replay mutations; refresh unknown state before retrying.

This application implements no direct Focus/Night light/privacy/saver setter. Audio mute, gamma changes and power-plan selection are different operations and must not stand in for those controls. Native execution is allowlisted; it exposes no arbitrary registry editing or shell command.

Regression tests verify shortcut URIs, capability flags, approval reuse and honest failure behavior. Mocks do not establish visible Settings pages or hardware mutation. [Validation](VALIDATION.md). For Windows URI definitions, see [Microsoft's Settings reference](https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-settings).
