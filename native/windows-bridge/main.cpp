#include <windows.h>
#include <sddl.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Data.Json.h>
#include <winrt/Windows.Devices.Radios.h>
#include <chrono>
#include <iostream>
#include <string>
#include <thread>
#include <vector>
#include "capabilities.h"

using namespace winrt;
using namespace Windows::Data::Json;
using namespace Windows::Devices::Radios;
using namespace std::chrono_literals;
thread_local std::chrono::steady_clock::time_point request_deadline;
Windows::Foundation::Collections::IVectorView<Radio> cached_radios{nullptr};
std::chrono::steady_clock::time_point enumeration_time;

struct owned_handle {
    HANDLE value = INVALID_HANDLE_VALUE;
    explicit owned_handle(HANDLE h) : value(h) {}
    ~owned_handle() { if (value != INVALID_HANDLE_VALUE && value != nullptr) CloseHandle(value); }
    owned_handle(owned_handle const&) = delete;
    owned_handle& operator=(owned_handle const&) = delete;
};

JsonValue str(std::string const& value) { return JsonValue::CreateStringValue(to_hstring(value)); }
JsonValue boolean(bool value) { return JsonValue::CreateBooleanValue(value); }

template<class T> auto await_operation(T const& operation) {
    while (operation.Status() == Windows::Foundation::AsyncStatus::Started) {
        if (std::chrono::steady_clock::now() >= request_deadline) {
            operation.Cancel();
            throw hresult_error(HRESULT_FROM_WIN32(ERROR_TIMEOUT), L"Windows radio operation timed out.");
        }
        std::this_thread::sleep_for(10ms);
    }
    return operation.GetResults();
}

std::string state_name(RadioState state) {
    switch (state) {
    case RadioState::On: return "On";
    case RadioState::Off: return "Off";
    case RadioState::Disabled: return "Disabled";
    default: return "Unknown";
    }
}

JsonObject radio_state(Radio const& radio) {
    JsonObject value;
    value.Insert(L"available", boolean(radio != nullptr));
    value.Insert(L"enabled", boolean(radio && radio.State() == RadioState::On));
    value.Insert(L"state", str(radio ? state_name(radio.State()) : "Unavailable"));
    return value;
}

JsonObject dispatch(JsonObject const& request) {
    if (request.GetNamedNumber(L"protocolVersion") != 1) throw hresult_invalid_argument(L"Unsupported protocol version.");
    auto operation = request.GetNamedString(L"operation");
    auto arguments = request.GetNamedObject(L"arguments");
    JsonObject result;
    if (operation == L"bridge.health" || operation == L"bridge.capabilities") {
        result.Insert(L"status", str("ok"));
        JsonArray capabilities;
        for (auto const& item : {"bridge.health", "bridge.capabilities", "radio.snapshot", "radio.set"}) capabilities.Append(str(item));
        for (auto const& item : {"power.snapshot", "system.staticSnapshot", "process.knownApps", "phoneLink.snapshot", "media.snapshot", "media.play", "media.pause", "media.next", "media.previous", "media.shuffle", "media.mute", "windows.openUri", "browser.openUrl"}) capabilities.Append(str(item));
        result.Insert(L"operations", capabilities);
        return result;
    }
    if (supports_native_operation(operation)) return native_dispatch(operation, arguments);
    if (operation != L"radio.snapshot" && operation != L"radio.set") throw hresult_invalid_argument(L"Unknown operation.");
    // Keep live Radio handles warm, as the previous PowerShell worker did. State() remains live.
    // Bound enumeration caching so adapters added after launch are discovered too.
    if (!cached_radios || std::chrono::steady_clock::now() - enumeration_time >= 30s) {
        cached_radios = await_operation(Radio::GetRadiosAsync());
        enumeration_time = std::chrono::steady_clock::now();
    }
    auto radios = cached_radios;
    Radio wifi{nullptr}, bluetooth{nullptr};
    for (auto const& radio : radios) {
        if (!wifi && radio.Kind() == RadioKind::WiFi) wifi = radio;
        if (!bluetooth && radio.Kind() == RadioKind::Bluetooth) bluetooth = radio;
    }
    if (operation == L"radio.snapshot") {
        result.Insert(L"available", boolean(true));
        result.Insert(L"wifi", radio_state(wifi));
        result.Insert(L"bluetooth", radio_state(bluetooth));
        return result;
    }
    auto control = arguments.GetNamedString(L"control");
    if (control != L"wifi" && control != L"bluetooth") throw hresult_invalid_argument(L"Unknown radio control.");
    bool enabled = arguments.GetNamedBoolean(L"enabled");
    auto radio = control == L"wifi" ? wifi : bluetooth;
    if (!radio) throw hresult_error(HRESULT_FROM_WIN32(ERROR_NOT_FOUND), L"Requested radio is unavailable.");
    if (await_operation(Radio::RequestAccessAsync()) != RadioAccessStatus::Allowed)
        throw hresult_access_denied(L"Windows denied radio access.");
    auto target = enabled ? RadioState::On : RadioState::Off;
    if (await_operation(radio.SetStateAsync(target)) != RadioAccessStatus::Allowed)
        throw hresult_access_denied(L"Windows rejected the radio change.");
    auto deadline = std::chrono::steady_clock::now() + 1500ms;
    while (radio.State() != target && std::chrono::steady_clock::now() < deadline) std::this_thread::sleep_for(25ms);
    if (radio.State() != target) throw hresult_error(HRESULT_FROM_WIN32(ERROR_TIMEOUT), L"Radio did not reach the requested state.");
    result = radio_state(radio);
    result.Insert(L"control", JsonValue::CreateStringValue(control));
    result.Insert(L"status", str("completed"));
    return result;
}

std::string process_request(std::string const& input) {
    request_deadline = std::chrono::steady_clock::now() + 9s;
    JsonObject response;
    response.Insert(L"protocolVersion", JsonValue::CreateNumberValue(1));
    response.Insert(L"requestId", str(""));
    try {
        auto request = JsonObject::Parse(to_hstring(input));
        auto id = request.GetNamedString(L"requestId");
        if (id.empty() || id.size() > 64) throw hresult_invalid_argument(L"Invalid request ID.");
        response.Insert(L"requestId", JsonValue::CreateStringValue(id));
        response.Insert(L"result", dispatch(request));
        response.Insert(L"ok", boolean(true));
    } catch (hresult_error const& error) {
        cached_radios = nullptr;
        response.Insert(L"ok", boolean(false));
        JsonObject detail;
        auto hr = error.code();
        detail.Insert(L"code", str(hr == E_ACCESSDENIED ? "ACCESS_DENIED" : hr == HRESULT_FROM_WIN32(ERROR_TIMEOUT) ? "TIMEOUT" : hr == HRESULT_FROM_WIN32(ERROR_NOT_FOUND) ? "RADIO_UNAVAILABLE" : hr == E_INVALIDARG ? "INVALID_REQUEST" : "WINDOWS_ERROR"));
        detail.Insert(L"message", JsonValue::CreateStringValue(error.message()));
        response.Insert(L"error", detail);
    }
    return to_string(response.Stringify()) + "\n";
}

// Java owns this bridge and chooses an unpredictable per-process pipe name.
// ACL restricts access to the current user; peer PID further restricts it to the parent backend.
int wmain(int argc, wchar_t** argv) {
    try {
        if (argc == 2 && std::wstring(argv[1]) == L"--self-test") {
            init_apartment(apartment_type::multi_threaded);
            for (auto const& sample : {
                R"({"protocolVersion":1,"requestId":"test","operation":"bridge.health","arguments":{}})",
                R"({"protocolVersion":2,"requestId":"test","operation":"bridge.health","arguments":{}})",
                R"({"protocolVersion":1,"requestId":"test","operation":"unknown","arguments":{}})"}) {
                auto result = JsonObject::Parse(to_hstring(process_request(sample)));
                bool expected = std::string(sample).find("\"protocolVersion\":1") != std::string::npos
                    && std::string(sample).find("bridge.health") != std::string::npos;
                if (result.GetNamedBoolean(L"ok") != expected || result.GetNamedString(L"requestId") != L"test") return 1;
            }
            if (JsonObject::Parse(to_hstring(process_request("invalid json"))).GetNamedBoolean(L"ok")) return 1;
            std::cout << "Bridge protocol tests passed (no radio operations).\n";
            return 0;
        }
        if (argc != 5 || std::wstring(argv[1]) != L"--pipe" || std::wstring(argv[3]) != L"--parent-pid") return 2;
        std::wstring pipe_name = argv[2];
        if (!pipe_name.starts_with(L"\\\\.\\pipe\\LiveDesktop.WindowsBridge.") || pipe_name.size() > 200) return 2;
        auto parent_pid = static_cast<DWORD>(std::stoul(argv[4]));
        owned_handle parent(OpenProcess(SYNCHRONIZE, FALSE, parent_pid));
        if (!parent.value) return 3;
        // Exit even if a stalled client or OS call prevents the pipe loop from progressing.
        std::thread([h = parent.value] { WaitForSingleObject(h, INFINITE); ExitProcess(0); }).detach();
        owned_handle token(nullptr);
        if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token.value)) return 3;
        DWORD size = 0;
        GetTokenInformation(token.value, TokenUser, nullptr, 0, &size);
        std::vector<unsigned char> info(size);
        if (!GetTokenInformation(token.value, TokenUser, info.data(), size, &size)) return 3;
        LPWSTR sid = nullptr;
        if (!ConvertSidToStringSidW(reinterpret_cast<TOKEN_USER*>(info.data())->User.Sid, &sid)) return 3;
        std::wstring sddl = L"D:P(A;;GA;;;" + std::wstring(sid) + L")";
        LocalFree(sid);
        PSECURITY_DESCRIPTOR descriptor = nullptr;
        if (!ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl.c_str(), SDDL_REVISION_1, &descriptor, nullptr)) return 3;
        SECURITY_ATTRIBUTES security{sizeof(SECURITY_ATTRIBUTES), descriptor, FALSE};
        owned_handle pipe(CreateNamedPipeW(pipe_name.c_str(), PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE,
            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS, 1, 65536, 65536, 0, &security));
        LocalFree(descriptor);
        if (pipe.value == INVALID_HANDLE_VALUE) return 3;
        init_apartment(apartment_type::multi_threaded);
        while (WaitForSingleObject(parent.value, 0) == WAIT_TIMEOUT) {
            if (!ConnectNamedPipe(pipe.value, nullptr) && GetLastError() != ERROR_PIPE_CONNECTED) break;
            ULONG peer = 0;
            if (!GetNamedPipeClientProcessId(pipe.value, &peer) || peer != parent_pid) {
                DisconnectNamedPipe(pipe.value);
                continue;
            }
            std::string input;
            char byte;
            DWORD transferred;
            while (ReadFile(pipe.value, &byte, 1, &transferred, nullptr) && transferred == 1) {
                if (byte != '\n') {
                    input += byte;
                    if (input.size() > 16384) break;
                    continue;
                }
                auto output = process_request(input);
                input.clear();
                if (output.size() > 8 * 1024 * 1024) break;
                size_t sent = 0;
                while (sent < output.size()) {
                    DWORD chunk = static_cast<DWORD>(std::min<size_t>(65536, output.size() - sent));
                    if (!WriteFile(pipe.value, output.data() + sent, chunk, &transferred, nullptr) || !transferred) break;
                    sent += transferred;
                }
                if (sent != output.size()) break;
            }
            DisconnectNamedPipe(pipe.value);
        }
        return 0;
    } catch (...) {
        // Do not emit request bodies or secrets to stderr.
        std::cerr << "Windows bridge initialization failed.\n";
        return 3;
    }
}
