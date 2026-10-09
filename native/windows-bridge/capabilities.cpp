#include <windows.h>
#include <tlhelp32.h>
#include <appmodel.h>
#include <powrprof.h>
#include <shellapi.h>
#include <dxgi.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Media.Control.h>
#include <winrt/Windows.Storage.Streams.h>
#include <winrt/Windows.Security.Cryptography.h>
#include "capabilities.h"
#include <algorithm>
#include <cwctype>
#include <set>
#include <string>
#include <thread>
#include <vector>

using namespace winrt;
using namespace Windows::Data::Json;
using namespace Windows::Media::Control;
using namespace std::chrono_literals;

namespace {
JsonValue text(std::wstring const& value) { return JsonValue::CreateStringValue(value); }
JsonValue number(double value) { return JsonValue::CreateNumberValue(value); }
JsonValue flag(bool value) { return JsonValue::CreateBooleanValue(value); }
std::wstring lower(std::wstring value) {
    std::transform(value.begin(), value.end(), value.begin(), [](wchar_t c) { return static_cast<wchar_t>(std::towlower(c)); });
    return value;
}
template<class T> auto await_native(T const& operation) {
    while (operation.Status() == Windows::Foundation::AsyncStatus::Started) {
        if (std::chrono::steady_clock::now() >= request_deadline) {
            operation.Cancel();
            throw hresult_error(HRESULT_FROM_WIN32(ERROR_TIMEOUT), L"Windows operation timed out.");
        }
        std::this_thread::sleep_for(2ms);
    }
    return operation.GetResults();
}
std::wstring registry_text(wchar_t const* key, wchar_t const* name) {
    DWORD size = 0;
    if (RegGetValueW(HKEY_LOCAL_MACHINE, key, name, RRF_RT_REG_SZ, nullptr, nullptr, &size) != ERROR_SUCCESS || size > 16384) return L"";
    std::vector<wchar_t> value(size / sizeof(wchar_t) + 1);
    if (RegGetValueW(HKEY_LOCAL_MACHINE, key, name, RRF_RT_REG_SZ, nullptr, value.data(), &size) != ERROR_SUCCESS) return L"";
    return value.data();
}
DWORD registry_number(wchar_t const* key, wchar_t const* name) {
    DWORD value = 0, size = sizeof(value);
    RegGetValueW(HKEY_LOCAL_MACHINE, key, name, RRF_RT_REG_DWORD, nullptr, &value, &size);
    return value;
}
std::wstring date_string(DWORD unix_seconds) {
    if (!unix_seconds) return L"";
    ULARGE_INTEGER ticks;
    ticks.QuadPart = (static_cast<ULONGLONG>(unix_seconds) + 11644473600ULL) * 10000000ULL;
    FILETIME ft{ticks.LowPart, ticks.HighPart};
    SYSTEMTIME st{};
    if (!FileTimeToSystemTime(&ft, &st)) return L"";
    wchar_t result[32];
    swprintf_s(result, L"%04u-%02u-%02uT%02u:%02u:%02uZ", st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, st.wSecond);
    return result;
}
JsonObject power_snapshot() {
    SYSTEM_POWER_STATUS status{};
    check_bool(GetSystemPowerStatus(&status));
    bool present = status.BatteryFlag != 255 && !(status.BatteryFlag & 128);
    JsonObject result;
    result.Insert(L"available", flag(present));
    result.Insert(L"percent", present && status.BatteryLifePercent <= 100 ? number(status.BatteryLifePercent) : JsonValue::CreateNullValue());
    result.Insert(L"detail", text(!present ? L"Desktop power" : (status.BatteryFlag & 8) ? L"Charging" : status.ACLineStatus == 0 ? L"Discharging" : L"Connected"));
    return result;
}
JsonObject static_snapshot() {
    constexpr auto version_key = L"SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion";
    constexpr auto bios_key = L"HARDWARE\\DESCRIPTION\\System\\BIOS";
    SYSTEM_INFO system{};
    GetNativeSystemInfo(&system);
    auto arch = system.wProcessorArchitecture == PROCESSOR_ARCHITECTURE_AMD64 ? L"64-bit" : system.wProcessorArchitecture == PROCESSOR_ARCHITECTURE_ARM64 ? L"ARM64" : L"32-bit";
    DWORD bytes = 0, cores = 0;
    GetLogicalProcessorInformationEx(RelationProcessorCore, nullptr, &bytes);
    std::vector<unsigned char> topology(bytes);
    if (bytes && GetLogicalProcessorInformationEx(RelationProcessorCore,
            reinterpret_cast<PSYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX>(topology.data()), &bytes)) {
        for (DWORD offset = 0; offset < bytes;) {
            auto record = reinterpret_cast<PSYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX>(topology.data() + offset);
            if (!record->Size || record->Size > bytes - offset) break;
            ++cores;
            offset += record->Size;
        }
    }
    DWORD logical = GetActiveProcessorCount(ALL_PROCESSOR_GROUPS);
    ULONGLONG memory_kb = 0;
    GetPhysicallyInstalledSystemMemory(&memory_kb);
    MEMORYSTATUSEX memory{sizeof(memory)};
    GlobalMemoryStatusEx(&memory);
    // Documented CallNtPowerInformation layout; not declared by the user-mode SDK headers.
    struct processor_power_info { ULONG Number, MaxMhz, CurrentMhz, MhzLimit, MaxIdleState, CurrentIdleState; };
    std::vector<processor_power_info> processor_power(logical);
    ULONG max_mhz = registry_number(L"HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0", L"~MHz");
    if (logical && CallNtPowerInformation(ProcessorInformation, nullptr, 0, processor_power.data(),
            static_cast<ULONG>(processor_power.size() * sizeof(processor_power_info))) == 0) {
        max_mhz = processor_power.front().MaxMhz;
    }
    JsonArray graphics;
    com_ptr<IDXGIFactory1> factory;
    if (SUCCEEDED(CreateDXGIFactory1(__uuidof(IDXGIFactory1), factory.put_void()))) {
        for (UINT i = 0; i < 16; ++i) {
            com_ptr<IDXGIAdapter1> adapter;
            if (FAILED(factory->EnumAdapters1(i, adapter.put()))) break;
            DXGI_ADAPTER_DESC1 description{};
            if (FAILED(adapter->GetDesc1(&description)) || (description.Flags & DXGI_ADAPTER_FLAG_SOFTWARE)) continue;
            JsonObject graphic;
            graphic.Insert(L"name", text(description.Description));
            LARGE_INTEGER driver{};
            std::wstring driver_version = L"Unavailable";
            if (SUCCEEDED(adapter->CheckInterfaceSupport(__uuidof(IDXGIDevice), &driver))) {
                driver_version = std::to_wstring(HIWORD(driver.HighPart)) + L"." + std::to_wstring(LOWORD(driver.HighPart))
                    + L"." + std::to_wstring(HIWORD(driver.LowPart)) + L"." + std::to_wstring(LOWORD(driver.LowPart));
            }
            graphic.Insert(L"driverVersion", text(driver_version));
            graphics.Append(graphic);
        }
    }
    JsonObject device;
    device.Insert(L"manufacturer", text(registry_text(bios_key, L"SystemManufacturer")));
    device.Insert(L"model", text(registry_text(bios_key, L"SystemProductName")));
    device.Insert(L"processorName", text(registry_text(L"HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0", L"ProcessorNameString")));
    device.Insert(L"processorCores", number(cores));
    device.Insert(L"processorLogicalProcessors", number(logical));
    device.Insert(L"maxClockMhz", number(max_mhz));
    device.Insert(L"installedMemoryBytes", number(static_cast<double>(memory_kb ? memory_kb * 1024 : memory.ullTotalPhys)));
    device.Insert(L"graphics", graphics);
    device.Insert(L"systemType", text(system.wProcessorArchitecture == PROCESSOR_ARCHITECTURE_AMD64 ? L"x64-based PC" : system.wProcessorArchitecture == PROCESSOR_ARCHITECTURE_ARM64 ? L"ARM64-based PC" : L"x86-based PC"));
    device.Insert(L"productId", text(registry_text(version_key, L"ProductId")));
    device.Insert(L"deviceId", text(registry_text(L"SOFTWARE\\Microsoft\\SQMClient", L"MachineId")));
    JsonObject windows;
    auto build = registry_text(version_key, L"CurrentBuildNumber");
    auto edition = registry_text(version_key, L"ProductName");
    if (!build.empty() && std::wcstoul(build.c_str(), nullptr, 10) >= 22000) {
        auto index = edition.find(L"Windows 10");
        if (index != std::wstring::npos) edition.replace(index, 10, L"Windows 11");
    }
    windows.Insert(L"edition", text(edition));
    windows.Insert(L"version", text(registry_text(version_key, L"DisplayVersion")));
    windows.Insert(L"osVersion", text(L"10.0." + build));
    windows.Insert(L"build", text(build + L"." + std::to_wstring(registry_number(version_key, L"UBR"))));
    windows.Insert(L"installedOn", text(date_string(registry_number(version_key, L"InstallDate"))));
    windows.Insert(L"architecture", text(arch));
    JsonObject result;
    result.Insert(L"device", device);
    result.Insert(L"windows", windows);
    return result;
}
JsonObject app_snapshot() {
    static std::set<std::wstring> const known{L"code", L"figma", L"msedge", L"chrome", L"excel", L"powerpnt", L"applemusic", L"slack", L"teams", L"phoneexperiencehost", L"crossdevice", L"crossdeviceservice"};
    HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snapshot == INVALID_HANDLE_VALUE) throw hresult_error(HRESULT_FROM_WIN32(GetLastError()), L"Process enumeration failed.");
    std::set<std::wstring> names;
    PROCESSENTRY32W entry{sizeof(entry)};
    if (Process32FirstW(snapshot, &entry)) do {
        auto name = lower(entry.szExeFile);
        if (name.ends_with(L".exe")) name.resize(name.size() - 4);
        if (known.contains(name)) names.insert(name);
    } while (Process32NextW(snapshot, &entry));
    CloseHandle(snapshot);
    JsonArray apps;
    for (auto const& name : names) apps.Append(text(name));
    UINT32 count = 0, size = 0;
    LONG package_result = GetPackagesByPackageFamily(L"Microsoft.YourPhone_8wekyb3d8bbwe", &count, nullptr, &size, nullptr);
    bool installed = package_result == ERROR_INSUFFICIENT_BUFFER && count > 0;
    JsonObject result;
    result.Insert(L"processes", apps);
    result.Insert(L"phoneLinkInstalled", flag(installed));
    result.Insert(L"phoneLinkRunning", flag(names.contains(L"phoneexperiencehost") || names.contains(L"crossdevice") || names.contains(L"crossdeviceservice")));
    return result;
}

GlobalSystemMediaTransportControlsSessionManager media_manager{nullptr};
JsonObject media_request(hstring const& operation, JsonObject const& arguments) {
    std::wstring provider(arguments.GetNamedString(L"provider"));
    if (provider != L"apple" && provider != L"spotify" && provider != L"music") throw hresult_invalid_argument(L"Unknown music provider.");
    std::wstring provider_name = provider == L"apple" ? L"Apple Music" : provider == L"spotify" ? L"Spotify" : L"Music";
    if (!media_manager) media_manager = await_native(GlobalSystemMediaTransportControlsSessionManager::RequestAsync());
    auto sessions = media_manager.GetSessions();
    GlobalSystemMediaTransportControlsSession matched{nullptr}, matched_playing{nullptr}, playing{nullptr}, apple{nullptr}, first{nullptr};
    for (auto const& session : sessions) {
        auto id = lower(std::wstring(session.SourceAppUserModelId()));
        bool is_apple = id.find(L"applemusic") != std::wstring::npos || id.find(L"appleinc") != std::wstring::npos;
        bool matches = provider == L"apple" ? is_apple : provider == L"spotify" && id.find(L"spotify") != std::wstring::npos;
        bool is_playing = session.GetPlaybackInfo().PlaybackStatus() == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
        if (!first) first = session;
        if (!apple && is_apple) apple = session;
        if (!matched && matches) matched = session;
        if (!matched_playing && matches && is_playing) matched_playing = session;
        if (!playing && is_playing) playing = session;
    }
    auto current = media_manager.GetCurrentSession();
    auto session = matched_playing ? matched_playing : playing ? playing : matched ? matched : provider == L"music" && apple ? apple : current ? current : first;
    JsonObject result;
    result.Insert(L"available", flag(session != nullptr));
    result.Insert(L"ready", flag(session != nullptr));
    result.Insert(L"playing", flag(false));
    result.Insert(L"title", text(L"Nothing playing"));
    result.Insert(L"artist", text(provider_name));
    result.Insert(L"album", text(L"Start a track in " + provider_name + L" or the web player"));
    result.Insert(L"artwork", text(L"/assets/album-cover.png"));
    result.Insert(L"elapsed", number(0));
    result.Insert(L"duration", number(0));
    result.Insert(L"shuffled", flag(false));
    result.Insert(L"detail", text(L"Start playback once, then Live Desktop can control it through Windows."));
    if (!session) return result;
    bool succeeded = true;
    if (operation == L"media.play") succeeded = await_native(session.TryPlayAsync());
    else if (operation == L"media.pause") succeeded = await_native(session.TryPauseAsync());
    else if (operation == L"media.next") succeeded = await_native(session.TrySkipNextAsync());
    else if (operation == L"media.previous") succeeded = await_native(session.TrySkipPreviousAsync());
    else if (operation == L"media.shuffle") {
        auto shuffle = session.GetPlaybackInfo().IsShuffleActive();
        succeeded = await_native(session.TryChangeShuffleActiveAsync(!(shuffle && shuffle.Value())));
    } else if (operation == L"media.mute") {
        INPUT keys[2]{};
        keys[0].type = keys[1].type = INPUT_KEYBOARD;
        keys[0].ki.wVk = keys[1].ki.wVk = VK_VOLUME_MUTE;
        keys[1].ki.dwFlags = KEYEVENTF_KEYUP;
        succeeded = SendInput(2, keys, sizeof(INPUT)) == 2;
    }
    if (operation != L"media.snapshot") std::this_thread::sleep_for(120ms);
    auto properties = await_native(session.TryGetMediaPropertiesAsync());
    auto playback = session.GetPlaybackInfo();
    auto timeline = session.GetTimelineProperties();
    result.Insert(L"source", JsonValue::CreateStringValue(session.SourceAppUserModelId()));
    result.Insert(L"playing", flag(playback.PlaybackStatus() == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing));
    auto status = playback.PlaybackStatus();
    result.Insert(L"status", text(status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing ? L"Playing" : status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused ? L"Paused" : status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Stopped ? L"Stopped" : L"Closed"));
    result.Insert(L"title", text(properties.Title().empty() ? L"Untitled track" : std::wstring(properties.Title())));
    result.Insert(L"artist", text(properties.Artist().empty() ? L"Unknown artist" : std::wstring(properties.Artist())));
    result.Insert(L"album", text(properties.AlbumTitle().empty() ? provider_name : std::wstring(properties.AlbumTitle())));
    result.Insert(L"elapsed", number(std::max(0.0, std::chrono::duration<double>(timeline.Position()).count())));
    result.Insert(L"duration", number(std::max(0.0, std::chrono::duration<double>(timeline.EndTime()).count())));
    auto shuffle = playback.IsShuffleActive();
    result.Insert(L"shuffled", flag(shuffle && shuffle.Value()));
    result.Insert(L"actionSucceeded", flag(succeeded));
    result.Insert(L"detail", text(succeeded ? L"Controlled locally through Windows media controls." : L"Windows media session rejected the action."));
    try {
        if (properties.Thumbnail()) {
            auto stream = await_native(properties.Thumbnail().OpenReadAsync());
            if (stream.Size() > 0 && stream.Size() <= 4 * 1024 * 1024) {
                auto content_type = std::wstring(stream.ContentType());
                if (content_type == L"image/jpeg" || content_type == L"image/png" || content_type == L"image/webp" || content_type == L"image/gif") {
                    Windows::Storage::Streams::Buffer buffer(static_cast<uint32_t>(stream.Size()));
                    auto loaded = await_native(stream.ReadAsync(buffer, buffer.Capacity(), Windows::Storage::Streams::InputStreamOptions::None));
                    auto encoded = Windows::Security::Cryptography::CryptographicBuffer::EncodeToBase64String(loaded);
                    result.Insert(L"artwork", text(L"data:" + content_type + L";base64," + std::wstring(encoded)));
                }
            }
            stream.Close();
        }
    } catch (...) { /* Artwork failure does not fail media control. */ }
    return result;
}
JsonObject open_uri(hstring const& operation, JsonObject const& arguments) {
    std::wstring uri(arguments.GetNamedString(L"uri"));
    static std::set<std::wstring> const allowed{L"ms-settings:network-wifi", L"ms-settings:bluetooth", L"ms-settings:quiethours", L"ms-settings:nightlight", L"ms-settings:privacy-microphone", L"ms-settings:batterysaver", L"ms-phone:"};
    if (uri.size() > 4096 || uri.find_first_of(L"\r\n\0", 0, 3) != std::wstring::npos) throw hresult_invalid_argument(L"Invalid URI.");
    if (operation == L"windows.openUri" && !allowed.contains(uri)) throw hresult_invalid_argument(L"Windows URI is not allowlisted.");
    if (operation == L"browser.openUrl" && !lower(uri).starts_with(L"http://") && !lower(uri).starts_with(L"https://")) throw hresult_invalid_argument(L"Only HTTP and HTTPS URLs are allowed.");
    SHELLEXECUTEINFOW info{sizeof(info)};
    info.fMask = SEE_MASK_NOASYNC | SEE_MASK_FLAG_NO_UI;
    info.lpVerb = L"open";
    info.lpFile = uri.c_str();
    info.nShow = SW_SHOWNORMAL;
    check_bool(ShellExecuteExW(&info));
    JsonObject result;
    result.Insert(L"opened", text(uri));
    return result;
}
}

bool supports_native_operation(hstring const& operation) {
    static std::set<std::wstring> const operations{L"power.snapshot", L"system.staticSnapshot", L"process.knownApps", L"phoneLink.snapshot",
        L"media.snapshot", L"media.play", L"media.pause", L"media.next", L"media.previous", L"media.shuffle", L"media.mute", L"windows.openUri", L"browser.openUrl"};
    return operations.contains(std::wstring(operation));
}
JsonObject native_dispatch(hstring const& operation, JsonObject const& arguments) {
    if (operation == L"power.snapshot") return power_snapshot();
    if (operation == L"system.staticSnapshot") return static_snapshot();
    if (operation == L"process.knownApps" || operation == L"phoneLink.snapshot") return app_snapshot();
    if (operation == L"windows.openUri" || operation == L"browser.openUrl") return open_uri(operation, arguments);
    if (std::wstring(operation).starts_with(L"media.")) {
        try { return media_request(operation, arguments); }
        catch (...) { media_manager = nullptr; throw; }
    }
    throw hresult_invalid_argument(L"Unknown operation.");
}
