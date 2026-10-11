# Dashboard performance and further C++ migration assessment

Historical assessment: implementation decisions and current measurements are in [PERFORMANCE_RESULTS.md](PERFORMANCE_RESULTS.md).

Assessment date: October 9, 2026 (America/Chicago). Source baseline: `ec99bce`, “Replacing the Node Startup Path.” Recommendations below are proposals, not implemented performance improvements.

## Recommendation

Keep React for the dashboard and Java for application policy, profiles, approvals, persistence, and network integrations. Prioritize independent widget loading, lower request volume, targeted state reads, and cached native observations. Optimize the existing C++ bridge and host. Separately benchmark Java startup improvements, then a GraalVM executable if necessary. A broad C++ rewrite is not supported by the measurements collected here.

Moving another small service out of Java will not remove JVM startup or its baseline memory allocation while the other Java services remain. C++ can also make responsiveness worse if more work is placed on the already serialized bridge request path.

## Current execution paths

- Production: `start.cmd` -> C++ launcher/supervisor -> Java packaged backend plus C++ HTTP frontend host. No Maven, Vite, Node, or PowerShell is started by this production path.
- Browser: React/JavaScript and a third-party music iframe -> C++ host -> Java API. Browser JavaScript is not Java; converting backend code does not reduce React rendering work.
- Windows integrations: Java adapters -> one process-owned named pipe -> C++/WinRT worker. Radios, media, battery, static system information, process/package detection, and allowlisted launching are already native.
- Credentials: Java -> in-process JNI DPAPI DLL. This avoids sending plaintext credentials through the bridge.
- Still Java: dynamic system metrics through platform APIs, Phone Link metadata parsing, OpenAI/CalDAV networking, recurrence expansion, state storage, profiles, approval decisions, and API response shaping.

Source anchors: `native/launcher/main.cpp:211`, `native/host/main.cpp:157`, `backend/src/main/java/com/localassistant/os/service/WindowsBridgeClient.java:43`, `frontend/src/App.jsx:1138`.

## Measurements and their limits

The existing workspace launch record in `.startup-metrics.jsonl` reports:

| Stage | Elapsed milliseconds |
| --- | ---: |
| Native host ready | 250 |
| Backend ready | 7,765 |
| Proxied health ready | 7,796 |
| All service checks ready | 7,812 |
| Launcher command complete | 7,875 |

The matching backend log reports Spring initialization of 5.726 seconds, with the process running for 7.134 seconds at that message. These are saved measurements from the existing run, not a new cold-start benchmark. No restart was performed during this assessment. The native host is already available well before Java; further frontend-server startup optimization has little opportunity to shorten overall service readiness in this sample.

A fresh approximately 10-second observation, without injecting requests, returned:

| Process | Working set, MiB | Private bytes, MiB | CPU seconds gained |
| --- | ---: | ---: | ---: |
| Java backend | 129.70 | 243.61 | 0.00 |
| Native frontend host | 11.65 | 6.11 | 0.00 |
| Native supervisor | 9.11 | 1.65 | 0.00 |
| Native Windows bridge | 20.70 | 2.92 | 0.00 |

This is a short quiet observation at process-accounting resolution, not an active-dashboard CPU profile. Working set and private bytes are different measures and must not be added together. Browser/iframe memory is excluded. JVM inspection separately showed approximately 30.6 MiB used heap, 51 MiB committed heap, and 53.1 MiB used metaspace. The roughly 2 GiB maximum heap is a ceiling, not current consumption.

Warm HTTP probes used a reused .NET HttpClient, fully consumed response bodies, and issued GET requests only. Initial screening used one warm-up plus five measured requests per endpoint on each port. Because results varied, a second pass alternated direct/proxied requests and reversed their order on successive iterations:

| Route | Direct median / sample p95, ms | Native proxy median / sample p95, ms |
| --- | ---: | ---: |
| `/health` | 2.08 / 2.43 | 4.77 / 6.55 |
| `/api/system` | 7.22 / 7.99 | 9.91 / 10.55 |
| Apple media snapshot | 2.31 / 2.64 | 5.01 / 5.69 |

Each cell represents 20 warm requests; p95 is the 19th sorted sample, not a production latency guarantee. Median gaps were about 2.7 ms in this pass. First-pass proxy media timing was much higher, demonstrating why a small unpaired sample is insufficient to attribute delay to the host. Media response bodies were only 315 bytes, so these timings do not establish performance with active artwork. Other direct first-pass medians: apps 37.87 ms, Phone Link 25.78 ms, actions 11.58 ms, memories 9.28 ms, conversation summaries 11.16 ms. Current saved state was only 20,857 bytes.

No browser rendering trace, interaction latency measurement, sustained CPU/allocation profile, fresh calendar-network measurement, hardware mutation, or synthetic large-history benchmark was performed. Source findings below establish repeated work and dependency problems; they do not prove those paths dominate CPU time under the user's workload.

## Highest-value dashboard changes

### 1. Publish each widget as its request finishes

`App.jsx:1138` awaits `Promise.allSettled` for ten requests before applying any of their results. A calendar request can therefore delay displaying system data, history, approvals, and health that have already arrived. `api()` has no built-in deadline and the refresh loop has no in-flight guard.

Apply each result independently, with per-widget errors and loading state. Keep calendar outside the core loading dependency. Add read cancellation/deadlines, stale-response protection, and at most one pending refresh per resource. Ensure cancelled or late requests cannot update a different profile. Do not automatically replay state-changing requests.

Expected effect: earlier useful dashboard content and less apparent freezing. This is a JavaScript scheduling change; C++ does not solve the dependency barrier.

### 2. Reduce polling and isolate frequently changing state

`App.jsx:1203` schedules ten requests every 15 seconds, Phone Link every five seconds, and media every five seconds. Nominally this is 64 requests/minute per mounted dashboard, excluding startup/manual refreshes; Phone Link alone receives 16 because it appears in both refresh paths. Browser background throttling may alter actual counts.

Remove duplicated Phone Link refreshes. Refresh histories, memories, settings, and lifecycle state on relevant changes or at a much slower reconciliation cadence. Poll only useful visible data; pause/back off when the document is hidden, while preserving playback. Avoid overlapping refreshes and back off after failures. Keep fast-changing media state local to its widget and compare values before replacing state. Use a React profile before adding blanket memoization.

Expected effect: fewer HTTP requests, native scans, JSON copies, and browser updates. A bounded event stream can be considered later, but the current host has 16 blocking workers: long-lived connections must not consume the pool without a hosting design change.

### 3. Eliminate whole-state serialization for small reads

`StateStore.java:62` deep-copies the entire profile state by serializing and parsing it through Gson. Actions, memories, and conversation summaries each trigger this independently. The summary endpoint copies full message history before returning only titles/counts. Mutations also rewrite the complete pretty-printed state under a service-wide synchronized lock.

Add targeted immutable reads and conversation summaries directly from the stored model, with defensive copies of mutable collections. Use profile-scoped synchronization and pagination. Keep durable writes for approvals/actions; do not trade away correctness through indiscriminate write debouncing. If history growth justifies it, compare incremental database storage with the current file format.

Expected effect: less allocation and CPU work as history grows, reduced lock contention, smaller responses. Current state is small, so large present-day gains are unproven. Translating the same full-copy algorithm into C++ preserves its scaling problem and adds transfer costs.

### 4. Improve calendar and assistant network use in Java

`ICloudCalendarService.java:57` holds a service-wide synchronized lock across fetching. Each cache miss repeats principal/home/collection discovery and then fetches calendars sequentially. Individual HTTP requests allow 30 seconds; multiple requests can extend total time further. The cache holds one date per profile, so changing dates can discard useful cached work.

Cache account discovery separately; maintain bounded profile/date caches and one refresh per key; serve previous data with an explicit refreshing/stale state; move network work outside global locks. Revalidate discoveries after account changes and bound calendar-fetch concurrency. Preserve recurrence/timezone semantics.

`OpenAiAgent.java:93` creates a new HTTP SDK client on every reply. Investigate bounded profile-scoped client reuse, invalidated/closed on credential changes, profile deletion, and shutdown. Stream assistant output for earlier feedback if the UI/API contract is updated. C++ cannot remove remote model inference or calendar network latency.

## C++ work worth doing next

| Candidate | Concrete change | Dashboard effect and caveat | Priority |
| --- | --- | --- | --- |
| Media observations, already C++ | Cache metadata/artwork by session and change events; send lightweight playback updates; serve artwork through a bounded cache with an opaque versioned ID | Avoid repeated image reads, base64 encoding, pipe/HTTP copying, and browser parsing | High when music is active |
| Process/package observations, already C++ | Share short-lived snapshots between `process.knownApps` and `phoneLink.snapshot`; invalidate on refresh/appropriate events | Avoid duplicate Toolhelp process scans | Medium |
| Native bridge scheduling | Measure queue wait separately from execution; keep slow artwork work away from control commands; add overall request deadlines and bounded work | Protect radio/media button responsiveness during slow reads | High before expanding bridge scope |
| Native HTTP host | Reuse suitable WinHTTP sessions/connections; evaluate browser keep-alive; immutable caching for content-hashed JS/CSS and validators for other assets | Lower per-request overhead and reload traffic; measured warm proxy overhead is currently small | Medium |
| Phone Link metadata parser, currently Java | First parse companion data once and cache by modification time; move to C++ only if later profiles show material remaining cost | Could consolidate local Windows observation, but parsing is not yet demonstrated CPU-heavy | Low/conditional |
| Dynamic system sampler, currently Java/platform APIs | Consider one bounded native sampler only if measured duplicate sampling or JNI/Java overhead warrants it | Could share timestamps/snapshots; more bridge traffic may instead increase delay | Low/conditional |

The native media code (`capabilities.cpp:248`) opens and encodes the thumbnail on each snapshot, allowing up to 4 MiB of source artwork. At the limit, base64 alone is approximately 5.33 MiB per response; every five seconds would carry about 64 MiB/minute before other JSON overhead. This is a configured worst case, not observed traffic. Cache both content and its transfer representation; merely caching encoding while resending the full data URL misses much of the benefit.

`WindowsBridgeClient.request()` is synchronized and uses a single I/O executor. Its 15-second timeout starts after entering the synchronized method, so callers can also wait for earlier calls before their own timeout begins. The native server is likewise serialized. Adding more C++ operations without improving scheduling can create longer queues. Do not simply remove synchronization from an uncorrelated single-stream protocol. Retain parent ownership, request validation, bounded resources, profile approvals, and the no-replay rule for mutations.

The host currently sets `Connection: close`, creates a WinHTTP session per proxy request, and sends `Cache-Control: no-cache` for all static assets without a validator/304 path. Retain URL confinement, Host/Origin checks, request framing limits, streaming, and correct profile/auth isolation when optimizing connection reuse.

## Frontend payload and rendering

The current built client includes approximately 362 KiB JavaScript and 46 KiB CSS. Four PNGs total approximately 3.31 MiB: album cover 1.57 MiB, iPhone image 0.93 MiB, alternate phone image 0.39 MiB, and avatar 0.41 MiB. These are file sizes, not a claim that every file loads on every screen.

Resize/compress images for actual rendered dimensions, provide appropriate modern image formats, and make caching effective. Lazy-load infrequently used views if the bundle profile supports it. The music iframe at `App.jsx:1513` uses eager loading and remains mounted offscreen. Defer its first mount until needed, then keep it mounted once playback begins so navigation does not interrupt audio. Measure third-party iframe CPU/network separately from application work.

A C++/WebAssembly module is appropriate only for a demonstrated compute kernel, such as future local signal/image processing or a large parser. Current UI work is chiefly DOM/rendering, fetching, and state management. Workers can move computation off the main thread, but cannot directly manipulate the DOM, and WebAssembly adds loading/initialization/transfer costs. There is no measured kernel here that justifies it. A native C++ UI would be a product rewrite, with web music embeds still needing a browser engine.

## Startup options, in order

1. **Extracted Spring Boot deployment plus application CDS on Java 21.** The launcher already avoids build tools. Move the build/package pipeline to a tested extracted layout, train a class-data archive using isolated non-secret test data, and launch with that archive. Regenerate for relevant app/JDK changes. Keep readiness and packaging-manifest validation. This targets class loading/startup; it is not a steady-state endpoint optimization.
2. **Spring AOT on the JVM.** Benchmark generated initialization against the current application. Validate configuration and bean-selection restrictions. User dashboard profiles are application data and should remain runtime-selectable. Avoid global lazy initialization that merely moves startup cost into the first click.
3. **Optional Java 25+ comparison.** Spring's JVM AOT-cache path requires Java 25+; Java 21 uses CDS. This is a separate runtime upgrade experiment, not a flag to apply to the current Java 21 installation.
4. **GraalVM native executable prototype.** Potentially remove JVM startup/JIT and reduce memory without translating application policy to C++. Validate OpenAI SDK, both Jackson generations/Gson, ical4j recurrence/timezones, resources/reflection, TLS, management APIs, JNI DPAPI, and pipe/process behavior. Expect more build and compatibility work; startup benefit and runtime throughput must both be measured.
5. **Full C++ backend only if the above fails explicit goals.** It offers the most freedom to reduce runtime footprint but requires replacing HTTP/validation, persistence, calendar semantics, SDK integration, profile isolation, and approvals. Moving only selected methods will not recover the JVM baseline. Estimated speedups are unavailable without a prototype.

Native warm-up currently runs asynchronously from `SystemService` construction; do not assume it blocks startup synchronously. Measure contention before moving it later, and count any increased delay to the first system control. Measure browser-shell readiness separately from backend readiness so a faster launch metric does not conceal slower first use.

Spring's official documentation supports extracted deployment, CDS, and AOT as separate mechanisms: [efficient deployment](https://docs.spring.io/spring-boot/reference/packaging/efficient.html), [CDS and JVM AOT cache](https://docs.spring.io/spring-boot/reference/packaging/aot-cache.html), [Spring AOT](https://docs.spring.io/spring-boot/reference/packaging/aot.html). These rolling references currently describe 4.1.1; this project is 4.1.0, so verify build commands against the pinned version. [GraalVM reachability metadata](https://www.graalvm.org/latest/reference-manual/native-image/metadata/) covers dynamic/JNI access. Browser references: [off-main-thread work](https://web.dev/articles/off-main-thread), [WebAssembly performance tradeoffs](https://web.dev/articles/webassembly-performance-patterns-for-web-apps).

## Old Java support and actual bloat

No alternate PowerShell integration provider, automatic old-provider fallback, or legacy lifecycle script was found in production source. Setup/build/development PowerShell remains outside the production request path. The native path is mandatory.

`WindowsSystemControlService`, `WindowsMediaSessionService`, `WindowsCredentialProtection`, and `WindowsBridgeClient` are active adapters, transport, caching, and response handling. Their six packaged class files total 27,022 bytes uncompressed (26.4 KiB), 12,534 bytes compressed. This is code size, not heap cost, and excludes shared dependencies and the broader `SystemService`. Removing these would break the current architecture; it would not eliminate a redundant worker. Live process inspection found one backend and one bridge.

Java still has fallback response shaping: unavailable media/radio responses and generic system details when native details fail. These are cheap error handling or baseline values; they do not run a second Windows inspection engine. Existing DPAPI record compatibility uses the current native decryptor. Default-profile environment-key fallback and browser legacy-key migration are compatibility behavior, not parallel runtime services.

The substantial footprint is the active platform/dependency stack:

| Item | Observed size/cost | Interpretation |
| --- | ---: | --- |
| Packaged backend JAR | 83.75 MiB | Disk/distribution footprint |
| Nested OpenAI core JAR | 50.43 MiB | Largest single dependency; not all eagerly loaded or resident |
| Project-local Java directory | 327.89 MiB | Full on-disk installation; a trimmed runtime may reduce package size |
| Four native EXE/DLL artifacts | About 1.10 MiB combined | Excludes build intermediates and OS-provided libraries |
| Java working set / private bytes | 129.70 / 243.61 MiB | Current active backend, not legacy-support overhead |

The package also contains Jackson 2 and 3, Gson, and Kotlin libraries. Some are transitive SDK/framework requirements; do not delete them merely because multiple serializers appear. Investigate a slimmer OpenAI integration only if distribution size is a priority, retaining retry, error, streaming, and tool-call semantics. It is not justified to claim a 50 MiB RAM saving from removing a 50 MiB JAR. A trimmed Java runtime principally reduces installation size; benchmark startup separately.

## Suggested delivery and acceptance sequence

1. Capture browser first paint, first useful widgets, all widgets ready, and click-to-confirmed-result; record backend route timings, bridge queue/execution, allocations/GC, and process CPU over active and hidden-dashboard periods. Use synthetic isolated histories at multiple sizes and active music with artwork.
2. Ship independent widget loading, controlled polling, targeted state reads, and one-pass Phone Link parsing. Test delayed calendar responses, overlapping refreshes, hidden tabs, profile switches, mutation durability, and growing histories.
3. Ship bounded native observation/artwork caches and measure control latency while slow reads run. Keep playback continuity and cache invalidation correct after sleep/resume/session changes.
4. Benchmark extracted deployment/CDS and Spring AOT with repeated fresh processes, separating warm OS-cache launches from cold-machine launches. Report median/tail timing and memory together with first useful browser content. Do not count reused-instance starts as fresh launches.
5. Pursue GraalVM only against explicit startup/memory targets left unmet. Keep a temporary build-time comparison during the experiment, then select one production path and remove superseded setup instructions/providers.

This assessment adds documentation only. No application code, configuration, running services, credentials, or hardware settings were changed. Existing test reports were inspected; build/test suites were not rerun for this documentation-only change.
