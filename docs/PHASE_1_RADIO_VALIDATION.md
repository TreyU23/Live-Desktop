# Phase 1 radio bridge validation

Historical Phase 1 record: the optional-provider setup below describes October 7 only and is superseded by the [native-only migration](WINDOWS_NATIVE_MIGRATION.md). Do not use the former provider environment variable; both native artifacts are now required. Original measurements are preserved, not relabeled as results for the expanded bridge.

Recorded October 7, 2026 on the development Windows machine. These measurements cover the radio worker, not full application startup, Maven, Spring, or frontend readiness.

## Installed toolchain

- Visual Studio Build Tools 2022: 17.14.41.
- MSVC compiler: 19.44.35229.0, toolset directory 14.44.35207.
- Windows SDK: 10.0.26100.0.
- Bundled CMake: 3.31.6-msvc6.
- Installation completed successfully; no reboot was requested.

The native build script discovers bundled CMake via `vswhere`. It requires no global PATH change and builds x64 Release using Visual Studio 2022.

## Verification

- `scripts/build-windows-bridge.ps1`: Release compile/link passed; CTest protocol self-test passed (1/1).
- `scripts/test-windows-bridge.ps1`: three launches with ten radio snapshots each passed. Unsupported protocol versions and unregistered operations were rejected. No radio changes dispatched.
- Java targeted bridge and action suite: 16 tests passed, no failures or skips. This includes the live Java-to-native pipe test, two clean launches, repeated radio snapshots, unknown-operation rejection, and continued health after rejection.
- After radio enumeration caching changed, the seven Java bridge tests were rerun against the rebuilt executable and passed without skips.
- The prior full backend suite passed 29 tests before adding the new live bridge test. A full suite with the added test has not been rerun in this validation step.

## Measurements

Each provider was started three times, and each process served ten read-only snapshots. Native launch timing includes `Start-Process`, pipe connection, health, two protocol-rejection checks, and the first radio snapshot. PowerShell timing includes process creation and the first snapshot. This is a short, sequential development benchmark with OS caches warm; it is not a controlled machine-cold benchmark or a P95 estimate.

| Provider | Run | Launch to first snapshot (ms) | Mean subsequent nine snapshots (ms) |
|---|---:|---:|---:|
| C++ native | 1 | 483.58 | 1.94 |
| C++ native | 2 | 148.64 | 1.81 |
| C++ native | 3 | 160.82 | 2.05 |
| PowerShell | 1 | 1039.72 | 4.94 |
| PowerShell | 2 | 668.06 | 4.50 |
| PowerShell | 3 | 694.26 | 4.06 |

Median launch-to-first-snapshot was 160.82 ms native versus 694.26 ms PowerShell. Mean subsequent-query latency across runs was about 1.94 ms native versus 4.50 ms PowerShell. Neither provider toggled a radio.

The native process retains live radio handles between queries and refreshes enumeration after 30 seconds or an error. The Java service still caches successful snapshots for 30 seconds. Changes in radio state are read through the retained handles when queried; adapter additions/removals can require both cache intervals to expire.

## Remaining rollout gates

The default provider remains PowerShell. The native executable is available under `native/build/Release` and can be explicitly selected using `WINDOWS_RADIO_PROVIDER=native` before starting/restarting the backend.

Before changing the default and removing PowerShell radio code, validate:

- Approved Wi-Fi and Bluetooth on/off transitions, including Windows state verification.
- Actual Windows permission/policy denial.
- Unexpected bridge termination and recovery on the next request.
- Sleep/resume and hardware adapter removal/arrival.
- Pipe ACL and wrong-client PID rejection under separate clients/users.

Native compilation, protocol rejection, clean relaunch, and read-only snapshots are confirmed. Those results do not establish the remaining mutation, security-boundary, or lifecycle behaviors.
