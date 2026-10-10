#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <winhttp.h>
#include <iphlpapi.h>
#include <sddl.h>
#include <filesystem>
#include <iostream>
#include <string>
#include <vector>
#include <stdexcept>
#include <cwctype>

namespace fs = std::filesystem;
struct Handle {
    HANDLE value = nullptr;
    explicit Handle(HANDLE h = nullptr) : value(h) {}
    ~Handle() { if (value && value != INVALID_HANDLE_VALUE) CloseHandle(value); }
    Handle(const Handle&) = delete;
    Handle& operator=(const Handle&) = delete;
    Handle(Handle&& h) noexcept : value(h.value) { h.value = nullptr; }
    Handle& operator=(Handle&& h) noexcept {
        if (this != &h) { if (value && value != INVALID_HANDLE_VALUE) CloseHandle(value); value = h.value; h.value = nullptr; }
        return *this;
    }
};
void require(bool ok, const char* message) {
    if (!ok) throw std::runtime_error(std::string(message) + " (Windows error " + std::to_string(GetLastError()) + ")");
}
std::wstring env(const wchar_t* name) {
    DWORD size = GetEnvironmentVariableW(name, nullptr, 0);
    if (!size) return L"";
    std::wstring result(size, L'\0');
    GetEnvironmentVariableW(name, result.data(), size);
    result.resize(size - 1); return result;
}
std::wstring quote(const std::wstring& s) {
    std::wstring result = L"\"";
    size_t slashes = 0;
    for (wchar_t c : s) {
        if (c == L'\\') { ++slashes; continue; }
        result.append(slashes * (c == L'"' ? 2 : 1), L'\\'); slashes = 0;
        if (c == L'"') result += L'\\';
        result += c;
    }
    result.append(slashes * 2, L'\\'); return result + L"\"";
}
fs::path executable() {
    std::wstring buffer(32768, L'\0');
    DWORD n = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
    require(n && n < buffer.size(), "Cannot locate launcher"); buffer.resize(n); return buffer;
}
// Current-user-only kernel objects; workspace canonicalization makes alternate path spellings identical.
struct Objects {
    PSECURITY_DESCRIPTOR descriptor = nullptr;
    SECURITY_ATTRIBUTES security{sizeof(SECURITY_ATTRIBUTES), nullptr, FALSE};
    std::wstring prefix;
    Handle commands, instance, ready, restart, stop;
    Objects(const fs::path& root) {
        HANDLE tokenRaw = nullptr;
        require(OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &tokenRaw), "Cannot read current user");
        Handle token(tokenRaw);
        DWORD size = 0; GetTokenInformation(token.value, TokenUser, nullptr, 0, &size);
        std::vector<BYTE> buffer(size);
        require(GetTokenInformation(token.value, TokenUser, buffer.data(), size, &size), "Cannot read user SID");
        LPWSTR sidRaw = nullptr;
        require(ConvertSidToStringSidW(reinterpret_cast<TOKEN_USER*>(buffer.data())->User.Sid, &sidRaw), "Cannot encode user SID");
        std::wstring sid(sidRaw); LocalFree(sidRaw);
        std::wstring sddl = L"D:P(A;;GA;;;" + sid + L")";
        require(ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl.c_str(), SDDL_REVISION_1, &descriptor, nullptr), "Cannot secure lifecycle objects");
        security.lpSecurityDescriptor = descriptor;
        unsigned long long hash = 14695981039346656037ULL;
        for (wchar_t c : root.wstring()) { hash ^= static_cast<unsigned long long>(towlower(c)); hash *= 1099511628211ULL; }
        prefix = L"Global\\LiveDesktop." + sid + L"." + std::to_wstring(hash);
        commands = Handle(CreateMutexW(&security, FALSE, (prefix + L".commands").c_str()));
        instance = Handle(CreateMutexW(&security, FALSE, (prefix + L".instance").c_str()));
        ready = Handle(CreateEventW(&security, TRUE, FALSE, (prefix + L".ready").c_str()));
        restart = Handle(CreateEventW(&security, FALSE, FALSE, (prefix + L".restart").c_str()));
        stop = Handle(CreateEventW(&security, FALSE, FALSE, (prefix + L".stop").c_str()));
        require(commands.value && instance.value && ready.value && restart.value && stop.value, "Cannot create lifecycle objects");
    }
    ~Objects() { LocalFree(descriptor); }
    bool running() {
        DWORD result = WaitForSingleObject(instance.value, 0);
        if (result == WAIT_TIMEOUT) return true;
        require(result == WAIT_OBJECT_0 || result == WAIT_ABANDONED, "Cannot inspect supervisor");
        ReleaseMutex(instance.value); return false;
    }
};
struct MutexLock {
    HANDLE mutex;
    MutexLock(HANDLE h, DWORD timeout) : mutex(h) {
        DWORD r = WaitForSingleObject(h, timeout);
        require(r == WAIT_OBJECT_0 || r == WAIT_ABANDONED, "Another lifecycle command is still running");
    }
    ~MutexLock() { ReleaseMutex(mutex); }
};
void fileRequired(const fs::path& p) {
    if (!fs::is_regular_file(p)) throw std::runtime_error("Required prebuilt artifact is missing: " + p.string() + ". Run scripts/build-production.ps1.");
}
fs::path runtime(const fs::path& root, bool java) {
    if (java) {
        auto local = root / L".tools/jdk-21/bin/java.exe";
        if (fs::is_regular_file(local)) return local;
        auto home = env(L"JAVA_HOME");
        if (!home.empty() && fs::is_regular_file(fs::path(home) / L"bin/java.exe")) return fs::path(home) / L"bin/java.exe";
    }
    std::wstring buffer(32768, L'\0');
    DWORD n = SearchPathW(nullptr, java ? L"java.exe" : L"node.exe", nullptr, static_cast<DWORD>(buffer.size()), buffer.data(), nullptr);
    if (n && n < buffer.size()) { buffer.resize(n); return buffer; }
    if (!java) {
        auto bundled = fs::path(env(L"USERPROFILE")) / L".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe";
        if (fs::is_regular_file(bundled)) return bundled;
    }
    throw std::runtime_error(java ? "Java 21 is required." : "Node.js 20 or later is required.");
}
// Inspect listening sockets only: recently closed connections in TIME_WAIT must not block restart.
// The services' own binds remain authoritative if another listener races this preflight.
void portAvailable(unsigned short port) {
    for (ULONG family : {AF_INET, AF_INET6}) {
        DWORD size = 0;
        DWORD result = GetExtendedTcpTable(nullptr, &size, FALSE, family, TCP_TABLE_OWNER_PID_LISTENER, 0);
        require(result == ERROR_INSUFFICIENT_BUFFER, "Cannot inspect listening ports");
        std::vector<BYTE> buffer(size);
        result = GetExtendedTcpTable(buffer.data(), &size, FALSE, family, TCP_TABLE_OWNER_PID_LISTENER, 0);
        if (result == ERROR_INSUFFICIENT_BUFFER) {
            buffer.resize(size);
            result = GetExtendedTcpTable(buffer.data(), &size, FALSE, family, TCP_TABLE_OWNER_PID_LISTENER, 0);
        }
        require(result == NO_ERROR, "Cannot inspect listening ports");
        bool occupied = false;
        if (family == AF_INET) {
            auto table = reinterpret_cast<MIB_TCPTABLE_OWNER_PID*>(buffer.data());
            for (DWORD i = 0; i < table->dwNumEntries; ++i) occupied |= table->table[i].dwState == MIB_TCP_STATE_LISTEN && ntohs(static_cast<u_short>(table->table[i].dwLocalPort)) == port;
        } else {
            auto table = reinterpret_cast<MIB_TCP6TABLE_OWNER_PID*>(buffer.data());
            for (DWORD i = 0; i < table->dwNumEntries; ++i) occupied |= table->table[i].dwState == MIB_TCP_STATE_LISTEN && ntohs(static_cast<u_short>(table->table[i].dwLocalPort)) == port;
        }
        if (occupied) throw std::runtime_error("Port " + std::to_string(port) + " is occupied. Stop its owner explicitly; no existing process was killed.");
    }
}
Handle child(const fs::path& app, const std::vector<std::wstring>& args, const fs::path& cwd, HANDLE job, const fs::path& out, const fs::path& err) {
    SECURITY_ATTRIBUTES inheritable{sizeof(SECURITY_ATTRIBUTES), nullptr, TRUE};
    Handle output(CreateFileW(out.c_str(), FILE_APPEND_DATA, FILE_SHARE_READ | FILE_SHARE_WRITE, &inheritable, OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr));
    Handle error(CreateFileW(err.c_str(), FILE_APPEND_DATA, FILE_SHARE_READ | FILE_SHARE_WRITE, &inheritable, OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr));
    Handle input(CreateFileW(L"NUL", GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE, &inheritable, OPEN_EXISTING, 0, nullptr));
    require(output.value != INVALID_HANDLE_VALUE && error.value != INVALID_HANDLE_VALUE && input.value != INVALID_HANDLE_VALUE, "Cannot open service logs");
    SIZE_T bytes = 0; InitializeProcThreadAttributeList(nullptr, 1, 0, &bytes);
    std::vector<BYTE> attributes(bytes);
    auto list = reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(attributes.data());
    require(InitializeProcThreadAttributeList(list, 1, 0, &bytes), "Cannot initialize child handles");
    HANDLE inherited[] = {output.value, error.value, input.value};
    BOOL configured = UpdateProcThreadAttribute(list, 0, PROC_THREAD_ATTRIBUTE_HANDLE_LIST, inherited, sizeof(inherited), nullptr, nullptr);
    STARTUPINFOEXW startup{}; startup.StartupInfo.cb = sizeof(startup); startup.lpAttributeList = list;
    startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
    startup.StartupInfo.hStdOutput = output.value; startup.StartupInfo.hStdError = error.value; startup.StartupInfo.hStdInput = input.value;
    std::wstring command = quote(app.wstring()); for (const auto& arg : args) command += L" " + quote(arg);
    PROCESS_INFORMATION process{};
    BOOL created = configured && CreateProcessW(app.c_str(), command.data(), nullptr, nullptr, TRUE, CREATE_SUSPENDED | CREATE_NO_WINDOW | EXTENDED_STARTUPINFO_PRESENT, nullptr, cwd.c_str(), &startup.StartupInfo, &process);
    DeleteProcThreadAttributeList(list);
    require(created, "Cannot create service process");
    Handle h(process.hProcess), thread(process.hThread);
    if ((job && !AssignProcessToJobObject(job, h.value)) || ResumeThread(thread.value) == static_cast<DWORD>(-1)) {
        TerminateProcess(h.value, 1); throw std::runtime_error("Cannot assign/start owned service process.");
    }
    return h;
}
bool httpReady(INTERNET_PORT port, const wchar_t* path) {
    HINTERNET session = WinHttpOpen(L"LiveDesktopLauncher/1", WINHTTP_ACCESS_TYPE_NO_PROXY, nullptr, nullptr, 0);
    if (!session) return false;
    WinHttpSetTimeouts(session, 250, 250, 250, 250);
    HINTERNET connection = WinHttpConnect(session, L"127.0.0.1", port, 0);
    HINTERNET request = connection ? WinHttpOpenRequest(connection, L"GET", path, nullptr, nullptr, nullptr, 0) : nullptr;
    DWORD status = 0, size = sizeof(status);
    bool ok = request && WinHttpSendRequest(request, nullptr, 0, nullptr, 0, 0, 0) && WinHttpReceiveResponse(request, nullptr)
        && WinHttpQueryHeaders(request, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, nullptr, &status, &size, nullptr) && status == 200;
    if (request) WinHttpCloseHandle(request);
    if (connection) WinHttpCloseHandle(connection);
    WinHttpCloseHandle(session); return ok;
}
int supervise(const fs::path& root, Objects& objects) {
    if (objects.running()) return 0;
    MutexLock owner(objects.instance.value, 0);
    std::cout << "Supervisor PID " << GetCurrentProcessId() << std::endl;
    ResetEvent(objects.ready.value); ResetEvent(objects.stop.value); ResetEvent(objects.restart.value);
    for (;;) {
        ULONGLONG started = GetTickCount64();
        fileRequired(root / L"backend/target/live-desktop-backend.jar");
        fileRequired(root / L"frontend/dist/client/index.html");
        fileRequired(root / L"frontend/scripts/serve-production.mjs");
        fileRequired(root / L"native/build/Release/live-desktop-windows-bridge.exe");
        fileRequired(root / L"native/build/Release/live-desktop-credentials.dll");
        auto java = runtime(root, true), node = runtime(root, false);
        portAvailable(4317); portAvailable(4173);
        Handle job(CreateJobObjectW(nullptr, nullptr)); require(job.value != nullptr, "Cannot create service job");
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{}; limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        require(SetInformationJobObject(job.value, JobObjectExtendedLimitInformation, &limits, sizeof(limits)), "Cannot configure owned process cleanup");
        // Backend working directory preserves ../.env and ../data semantics.
        SetEnvironmentVariableW(L"WORKSPACE_ROOT", root.c_str());
        SetEnvironmentVariableW(L"HOST", L"127.0.0.1"); SetEnvironmentVariableW(L"PORT", L"4317");
        auto backend = child(java, {L"-jar", (root / L"backend/target/live-desktop-backend.jar").wstring()}, root / L"backend", job.value, root / L".backend-preview.out.log", root / L".backend-preview.err.log");
        auto frontend = child(node, {(root / L"frontend/scripts/serve-production.mjs").wstring()}, root / L"frontend", job.value, root / L".frontend-preview.out.log", root / L".frontend-preview.err.log");
        std::cout << "Backend PID " << GetProcessId(backend.value) << ", frontend PID " << GetProcessId(frontend.value) << std::endl;
        HANDLE waits[] = {objects.stop.value, objects.restart.value, backend.value, frontend.value};
        ULONGLONG deadline = GetTickCount64() + 60000;
        DWORD signal = WAIT_TIMEOUT;
        bool ready = false;
        while (GetTickCount64() < deadline) {
            signal = WaitForMultipleObjects(4, waits, FALSE, 100);
            if (signal != WAIT_TIMEOUT) break;
            if (httpReady(4317, L"/health") && httpReady(4173, L"/")) {
                ready = true;
                std::cout << "HTTP ready after " << (GetTickCount64() - started) << " ms" << std::endl;
                SetEvent(objects.ready.value); break;
            }
        }
        if (ready) signal = WaitForMultipleObjects(4, waits, FALSE, INFINITE);
        ResetEvent(objects.ready.value);
        // Give the dashboard response a brief chance to reach the browser before shutting its backend down.
        if (signal == WAIT_OBJECT_0 || signal == WAIT_OBJECT_0 + 1) Sleep(750);
        require(TerminateJobObject(job.value, 0), "Cannot stop owned processes");
        // Wait for every descendant, including the Windows bridge, before releasing ownership/restarting.
        ULONGLONG cleanupDeadline = GetTickCount64() + 10000;
        JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting{};
        do {
            require(QueryInformationJobObject(job.value, JobObjectBasicAccountingInformation, &accounting, sizeof(accounting), nullptr), "Cannot verify service cleanup");
            if (!accounting.ActiveProcesses) break;
            Sleep(50);
        } while (GetTickCount64() < cleanupDeadline);
        require(accounting.ActiveProcesses == 0, "Owned processes did not stop in time");
        // Windows can report a terminated process's listener briefly after job accounting reaches zero.
        ULONGLONG portsDeadline = GetTickCount64() + 5000;
        for (;;) {
            try { portAvailable(4317); portAvailable(4173); break; }
            catch (...) { if (GetTickCount64() >= portsDeadline) throw; Sleep(100); }
        }
        if (signal == WAIT_OBJECT_0) return 0;
        if (signal == WAIT_OBJECT_0 + 1) continue;
        throw std::runtime_error(ready ? "A service exited; the remaining owned processes were stopped. Check service logs." : "Services failed readiness within 60 seconds. Check service logs.");
    }
}
int wmain(int argc, wchar_t** argv) {
    try {
        std::wstring action = argc > 1 ? argv[1] : L"start";
        fs::path root = executable().parent_path().parent_path().parent_path().parent_path();
        bool requestOnly = false;
        for (int i = 2; i < argc; ++i) {
            if (std::wstring(argv[i]) == L"--root" && i + 1 < argc) root = argv[++i];
            else if (std::wstring(argv[i]) == L"--request") requestOnly = true;
            else throw std::runtime_error("Usage: live-desktop-launcher [start|restart|shutdown|status] [--root PATH] [--request]");
        }
        root = fs::canonical(root);
        WSADATA data{}; require(WSAStartup(MAKEWORD(2, 2), &data) == 0, "Cannot initialize network checks");
        Objects objects(root);
        if (action == L"--supervise") return supervise(root, objects);
        if (action != L"start" && action != L"restart" && action != L"shutdown" && action != L"status") throw std::runtime_error("Unknown lifecycle action.");
        MutexLock command(objects.commands.value, 70000);
        bool running = objects.running();
        if (action == L"status") {
            std::cout << (running ? (WaitForSingleObject(objects.ready.value, 0) == WAIT_OBJECT_0 ? "running\n" : "starting or stopping\n") : "stopped\n"); return running ? 0 : 2;
        }
        if (requestOnly && !running) throw std::runtime_error("Native supervisor is not running. Start Live Desktop with start.cmd.");
        if (action == L"shutdown") {
            if (running) { ResetEvent(objects.ready.value); SetEvent(objects.stop.value); }
            if (requestOnly || !running) return 0;
            MutexLock stopped(objects.instance.value, 15000); std::cout << "Live Desktop stopped.\n"; return 0;
        }
        if (requestOnly) {
            if (!running) throw std::runtime_error("Native supervisor is not running. Start Live Desktop with start.cmd.");
            if (action != L"restart") throw std::runtime_error("--request requires restart or shutdown.");
            ResetEvent(objects.ready.value); SetEvent(objects.restart.value); return 0;
        }
        Handle supervisor;
        if (!running) {
            ResetEvent(objects.ready.value);
            // Log supervisor failures, but inherit no unrelated caller handles.
            supervisor = child(executable(), {L"--supervise", L"--root", root.wstring()}, root, nullptr, root / L".launcher.log", root / L".launcher.log");
        } else if (action == L"restart") { ResetEvent(objects.ready.value); SetEvent(objects.restart.value); }
        ULONGLONG deadline = GetTickCount64() + 65000;
        while (GetTickCount64() < deadline) {
            if (WaitForSingleObject(objects.ready.value, 100) == WAIT_OBJECT_0) {
                std::cout << "Live Desktop ready. Dashboard: http://localhost:4173\n"; return 0;
            }
            if (supervisor.value && WaitForSingleObject(supervisor.value, 0) == WAIT_OBJECT_0) break;
            if (!supervisor.value && !objects.running()) break;
        }
        throw std::runtime_error("Live Desktop did not become ready. See .launcher.log and service logs.");
    } catch (const std::exception& e) { std::cerr << e.what() << '\n'; return 1; }
}
