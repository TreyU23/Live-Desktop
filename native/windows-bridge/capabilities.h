#pragma once
#include <winrt/Windows.Data.Json.h>
#include <chrono>

extern thread_local std::chrono::steady_clock::time_point request_deadline;
bool supports_native_operation(winrt::hstring const& operation);
winrt::Windows::Data::Json::JsonObject native_dispatch(winrt::hstring const& operation,
    winrt::Windows::Data::Json::JsonObject const& arguments);
