#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <winhttp.h>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <map>
#include <set>
#include <vector>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <deque>
#include <algorithm>
#include <cctype>

namespace fs = std::filesystem;
constexpr size_t maxHeaders = 32768, maxBody = 16 * 1024 * 1024;
struct Socket {
    SOCKET value;
    explicit Socket(SOCKET s) : value(s) {}
    ~Socket() { closesocket(value); }
};
struct Internet {
    HINTERNET value;
    explicit Internet(HINTERNET h) : value(h) {}
    ~Internet() { if (value) WinHttpCloseHandle(value); }
};
struct File {
    HANDLE value;
    explicit File(HANDLE h) : value(h) {}
    ~File() { if (value != INVALID_HANDLE_VALUE) CloseHandle(value); }
};
struct HttpError { int status; std::string message; };
std::string lower(std::string s) {
    for (char& c : s) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    return s;
}
std::string trim(std::string s) {
    auto a = s.find_first_not_of(" \t"), b = s.find_last_not_of(" \t");
    return a == std::string::npos ? "" : s.substr(a, b - a + 1);
}
std::wstring wide(const std::string& s) {
    int n = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, s.data(), static_cast<int>(s.size()), nullptr, 0);
    if (!n && !s.empty()) throw HttpError{400, "Invalid UTF-8"};
    std::wstring result(n, L'\0');
    MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, s.data(), static_cast<int>(s.size()), result.data(), n);
    return result;
}
std::string narrow(const std::wstring& s) {
    int n = WideCharToMultiByte(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), nullptr, 0, nullptr, nullptr);
    std::string result(n, '\0');
    WideCharToMultiByte(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), result.data(), n, nullptr, nullptr);
    return result;
}
void sendAll(SOCKET s, const char* data, size_t size) {
    while (size) {
        int n = send(s, data, static_cast<int>(std::min(size, size_t(65536))), 0);
        if (n <= 0) throw std::runtime_error("Client disconnected");
        data += n; size -= n;
    }
}
void sendAll(SOCKET s, const std::string& data) { sendAll(s, data.data(), data.size()); }
void response(SOCKET s, int status, const std::string& body, bool head = false) {
    sendAll(s, "HTTP/1.1 " + std::to_string(status) + " Response\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\nX-Content-Type-Options: nosniff\r\nContent-Length: " + std::to_string(body.size()) + "\r\n\r\n");
    if (!head) sendAll(s, body);
}
struct Reader {
    SOCKET socket;
    std::string buffer;
    void more() {
        char bytes[8192]; int n = recv(socket, bytes, sizeof(bytes), 0);
        if (n <= 0) throw HttpError{400, "Incomplete request or receive timeout"};
        buffer.append(bytes, n);
    }
    std::string line(size_t limit) {
        size_t end;
        while ((end = buffer.find("\r\n")) == std::string::npos) {
            if (buffer.size() > limit) throw HttpError{431, "Request headers too large"};
            more();
        }
        if (end > limit) throw HttpError{431, "Request headers too large"};
        auto result = buffer.substr(0, end); buffer.erase(0, end + 2); return result;
    }
    std::string bytes(size_t count) {
        while (buffer.size() < count) more();
        auto result = buffer.substr(0, count); buffer.erase(0, count); return result;
    }
};
size_t number(const std::string& s, int base) {
    if (s.empty() || !std::all_of(s.begin(), s.end(), [base](unsigned char c) { return base == 16 ? std::isxdigit(c) : std::isdigit(c); })) throw HttpError{400, "Invalid body length"};
    try {
        auto n = std::stoull(s, nullptr, base);
        if (n > maxBody) throw HttpError{413, "Request body exceeds 16 MiB"};
        return static_cast<size_t>(n);
    } catch (const std::exception&) { throw HttpError{413, "Request body exceeds 16 MiB"}; }
}
struct Request {
    std::string method, target, body;
    std::map<std::string, std::string> headers;
};
bool token(const std::string& s) {
    return !s.empty() && std::all_of(s.begin(), s.end(), [](unsigned char c) { return std::isalnum(c) || std::string("!#$%&'*+-.^_`|~").find(c) != std::string::npos; });
}
Request readRequest(SOCKET s) {
    Reader reader{s, {}}; Request req;
    auto first = reader.line(8192);
    auto a = first.find(' '), b = first.find(' ', a == std::string::npos ? 0 : a + 1);
    if (a == std::string::npos || b == std::string::npos || first.substr(b + 1) != "HTTP/1.1") throw HttpError{400, "HTTP/1.1 required"};
    req.method = first.substr(0, a); req.target = first.substr(a + 1, b - a - 1);
    if (!token(req.method) || req.target.empty() || req.target[0] != '/' || req.target.starts_with("//") || req.target.find('#') != std::string::npos
        || std::any_of(req.target.begin(), req.target.end(), [](unsigned char c) { return c <= 32 || c == 127; })) throw HttpError{400, "Invalid request target"};
    size_t total = first.size();
    for (;;) {
        auto line = reader.line(maxHeaders); total += line.size() + 2;
        if (total > maxHeaders) throw HttpError{431, "Request headers too large"};
        if (line.empty()) break;
        auto colon = line.find(':');
        if (colon == std::string::npos || !token(line.substr(0, colon))) throw HttpError{400, "Invalid header"};
        auto name = lower(line.substr(0, colon)), value = trim(line.substr(colon + 1));
        if (std::any_of(value.begin(), value.end(), [](unsigned char c) { return (c < 32 && c != '\t') || c == 127; })) throw HttpError{400, "Invalid header value"};
        if (req.headers.contains(name)) throw HttpError{400, "Duplicate headers unsupported"};
        req.headers[name] = value;
    }
    if (req.headers["host"] != "localhost:4173" && req.headers["host"] != "127.0.0.1:4173") throw HttpError{403, "Local access only"};
    if (req.headers.contains("origin") && req.headers["origin"] != "http://localhost:4173" && req.headers["origin"] != "http://127.0.0.1:4173") throw HttpError{403, "Local access only"};
    if (req.headers.contains("transfer-encoding") && req.headers.contains("content-length")) throw HttpError{400, "Ambiguous request framing"};
    if (req.headers.contains("expect")) {
        if (lower(req.headers["expect"]) != "100-continue") throw HttpError{417, "Unsupported expectation"};
        sendAll(s, "HTTP/1.1 100 Continue\r\n\r\n");
    }
    if (req.headers.contains("transfer-encoding")) {
        if (lower(req.headers["transfer-encoding"]) != "chunked") throw HttpError{400, "Unsupported transfer encoding"};
        for (;;) {
            auto length = reader.line(128);
            size_t n = number(length.substr(0, length.find(';')), 16);
            if (!n) { if (!reader.line(2).empty()) throw HttpError{400, "Request trailers unsupported"}; break; }
            if (n > maxBody - req.body.size()) throw HttpError{413, "Request body exceeds 16 MiB"};
            req.body += reader.bytes(n);
            if (reader.bytes(2) != "\r\n") throw HttpError{400, "Invalid chunk framing"};
        }
    } else if (req.headers.contains("content-length")) req.body = reader.bytes(number(req.headers["content-length"], 10));
    return req;
}
std::set<std::string> hopHeaders(const std::map<std::string, std::string>& headers) {
    std::set<std::string> result{"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"};
    auto it = headers.find("connection");
    if (it != headers.end()) {
        size_t start = 0;
        do { auto end = it->second.find(',', start); result.insert(lower(trim(it->second.substr(start, end - start)))); if (end == std::string::npos) break; start = end + 1; } while (true);
    }
    return result;
}
void proxy(SOCKET socket, const Request& req) {
    Internet session(WinHttpOpen(L"LiveDesktopHost/1", WINHTTP_ACCESS_TYPE_NO_PROXY, nullptr, nullptr, 0));
    if (!session.value) throw HttpError{502, "Unable to initialize API proxy"};
    WinHttpSetTimeouts(session.value, 2000, 2000, 120000, 120000);
    Internet connection(WinHttpConnect(session.value, L"127.0.0.1", 4317, 0));
    auto method = wide(req.method), target = wide(req.target);
    Internet request(connection.value ? WinHttpOpenRequest(connection.value, method.c_str(), target.c_str(), nullptr, nullptr, nullptr, WINHTTP_FLAG_ESCAPE_DISABLE) : nullptr);
    if (!request.value) throw HttpError{502, "Unable to connect API proxy"};
    DWORD disabled = WINHTTP_DISABLE_REDIRECTS | WINHTTP_DISABLE_COOKIES | WINHTTP_DISABLE_AUTHENTICATION;
    if (!WinHttpSetOption(request.value, WINHTTP_OPTION_DISABLE_FEATURE, &disabled, sizeof(disabled))) throw HttpError{502, "Unable to configure API proxy"};
    std::string headers; auto hop = hopHeaders(req.headers);
    for (const auto& [name, value] : req.headers) {
        if (!hop.contains(name) && name != "host" && name != "content-length" && name != "expect") headers += name + ": " + value + "\r\n";
    }
    auto wh = wide(headers);
    if (!WinHttpSendRequest(request.value, wh.c_str(), static_cast<DWORD>(wh.size()), req.body.empty() ? nullptr : const_cast<char*>(req.body.data()), static_cast<DWORD>(req.body.size()), static_cast<DWORD>(req.body.size()), 0)
        || !WinHttpReceiveResponse(request.value, nullptr)) throw HttpError{502, "Backend unavailable at 127.0.0.1:4317; check .backend-preview.err.log"};
    DWORD status = 0, size = sizeof(status);
    if (!WinHttpQueryHeaders(request.value, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, nullptr, &status, &size, nullptr)) throw HttpError{502, "Invalid backend response"};
    size = 0; WinHttpQueryHeaders(request.value, WINHTTP_QUERY_RAW_HEADERS_CRLF, nullptr, nullptr, &size, nullptr);
    if (size > 65536) throw HttpError{502, "Backend headers too large"};
    std::wstring raw(size / sizeof(wchar_t), L'\0');
    if (!WinHttpQueryHeaders(request.value, WINHTTP_QUERY_RAW_HEADERS_CRLF, nullptr, raw.data(), &size, nullptr)) throw HttpError{502, "Cannot read backend headers"};
    auto text = narrow(raw); std::vector<std::pair<std::string, std::string>> responseHeaders;
    std::map<std::string, std::string> lookup;
    auto start = text.find("\r\n") + 2;
    for (;;) {
        auto end = text.find("\r\n", start);
        if (end == std::string::npos || end == start) break;
        auto line = text.substr(start, end - start); auto colon = line.find(':');
        if (colon != std::string::npos) { auto name = lower(line.substr(0, colon)), value = trim(line.substr(colon + 1)); responseHeaders.emplace_back(name, value); lookup[name] = value; }
        start = end + 2;
    }
    hop = hopHeaders(lookup);
    // WinHTTP decodes transfer framing. Close-delimited streaming avoids buffering large API responses.
    std::string outgoing = "HTTP/1.1 " + std::to_string(status) + " Response\r\nConnection: close\r\n";
    for (const auto& [name, value] : responseHeaders) if (!hop.contains(name) && name != "content-length") outgoing += name + ": " + value + "\r\n";
    if (req.method == "HEAD" && lookup.contains("content-length")) outgoing += "content-length: " + lookup["content-length"] + "\r\n";
    sendAll(socket, outgoing + "\r\n");
    if (req.method == "HEAD") return;
    char buffer[65536]; DWORD read = 0;
    // Once headers have been sent, an upstream error closes the connection, never sends a second response.
    while (WinHttpReadData(request.value, buffer, sizeof(buffer), &read) && read) sendAll(socket, buffer, read);
}
std::string decode(std::string path) {
    std::string result;
    for (size_t i = 0; i < path.size(); ++i) {
        unsigned char c = static_cast<unsigned char>(path[i]);
        if (c == '%') {
            if (i + 2 >= path.size() || !std::isxdigit(static_cast<unsigned char>(path[i + 1])) || !std::isxdigit(static_cast<unsigned char>(path[i + 2]))) throw HttpError{400, "Invalid URL encoding"};
            c = static_cast<unsigned char>(std::stoul(path.substr(i + 1, 2), nullptr, 16)); i += 2;
        }
        if (c < 32 || c == 127 || c == '\\' || c == ':') throw HttpError{400, "Invalid path"};
        result += static_cast<char>(c);
    }
    size_t start = 0;
    do {
        auto end = result.find('/', start); auto part = result.substr(start, end - start);
        if (part == "." || part == ".." || (!part.empty() && (part.back() == '.' || part.back() == ' '))) throw HttpError{400, "Invalid path component"};
        if (end == std::string::npos) break; start = end + 1;
    } while (true);
    return result;
}
bool inside(const fs::path& root, const fs::path& target) {
    auto a = root.begin(), b = target.begin();
    for (; a != root.end(); ++a, ++b) if (b == target.end() || _wcsicmp(a->c_str(), b->c_str()) != 0) return false;
    return true;
}
void serve(SOCKET socket, const Request& req, const fs::path& root) {
    auto path = req.target.substr(0, req.target.find('?'));
    // Validate encoding before forwarding, and require canonical API route spelling.
    auto decoded = decode(path);
    if (path == "/health" || path == "/api" || path.starts_with("/api/")) { proxy(socket, req); return; }
    if (req.method != "GET" && req.method != "HEAD") { response(socket, 405, "Method not allowed"); return; }
    if (path == "/_live/ready") { response(socket, 200, "live-desktop-host/1", req.method == "HEAD"); return; }
    fs::path target = root / fs::path(wide(decoded.substr(1)));
    target = fs::weakly_canonical(target);
    if (!inside(root, target)) { response(socket, 403, "Path outside frontend"); return; }
    if (!fs::is_regular_file(target)) {
        if (target.has_extension()) { response(socket, 404, "Asset not found"); return; }
        target = fs::canonical(root / L"index.html");
        if (!inside(root, target)) { response(socket, 403, "Path outside frontend"); return; }
    }
    File file(CreateFileW(target.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_FLAG_SEQUENTIAL_SCAN, nullptr));
    if (file.value == INVALID_HANDLE_VALUE) { response(socket, 500, "Unable to read frontend asset"); return; }
    // Check the opened handle as well as the path: a junction change must not race confinement.
    std::wstring finalPath(32768, L'\0');
    DWORD length = GetFinalPathNameByHandleW(file.value, finalPath.data(), static_cast<DWORD>(finalPath.size()), FILE_NAME_NORMALIZED);
    if (!length || length >= finalPath.size()) { response(socket, 500, "Unable to resolve frontend asset"); return; }
    finalPath.resize(length);
    if (finalPath.starts_with(L"\\\\?\\UNC\\")) finalPath = L"\\\\" + finalPath.substr(8);
    else if (finalPath.starts_with(L"\\\\?\\")) finalPath.erase(0, 4);
    if (!inside(root, fs::path(finalPath))) { response(socket, 403, "Path outside frontend"); return; }
    LARGE_INTEGER fileSize{};
    if (!GetFileSizeEx(file.value, &fileSize)) { response(socket, 500, "Unable to inspect frontend asset"); return; }
    static const std::map<std::string, std::string> types{{".html", "text/html; charset=utf-8"}, {".js", "text/javascript; charset=utf-8"}, {".css", "text/css; charset=utf-8"}, {".json", "application/json"}, {".svg", "image/svg+xml"}, {".png", "image/png"}, {".jpg", "image/jpeg"}, {".jpeg", "image/jpeg"}, {".webp", "image/webp"}, {".ico", "image/x-icon"}, {".woff2", "font/woff2"}};
    auto ext = lower(target.extension().string()), type = types.contains(ext) ? types.at(ext) : "application/octet-stream";
    sendAll(socket, "HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Type: " + type + "\r\nContent-Length: " + std::to_string(fileSize.QuadPart) + "\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\n\r\n");
    if (req.method == "HEAD") return;
    char buffer[65536]; DWORD read = 0;
    while (ReadFile(file.value, buffer, sizeof(buffer), &read, nullptr) && read) sendAll(socket, buffer, read);
}
int wmain(int argc, wchar_t** argv) {
    try {
        if (argc != 3 || std::wstring(argv[1]) != L"--root") throw std::runtime_error("Usage: live-desktop-host --root WORKSPACE");
        auto root = fs::canonical(fs::path(argv[2]) / L"frontend/dist/client");
        if (!fs::is_regular_file(root / L"index.html") || !inside(root, fs::canonical(root / L"index.html"))) throw std::runtime_error("Missing or invalid frontend/dist/client/index.html; rebuild production artifacts");
        WSADATA data{}; if (WSAStartup(MAKEWORD(2, 2), &data)) throw std::runtime_error("Cannot initialize native host network");
        Socket listener(::socket(AF_INET, SOCK_STREAM, IPPROTO_TCP));
        BOOL exclusive = TRUE;
        setsockopt(listener.value, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, reinterpret_cast<char*>(&exclusive), sizeof(exclusive));
        sockaddr_in address{}; address.sin_family = AF_INET; address.sin_port = htons(4173); address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
        if (bind(listener.value, reinterpret_cast<sockaddr*>(&address), sizeof(address)) || listen(listener.value, SOMAXCONN)) throw std::runtime_error("Cannot bind 127.0.0.1:4173 (socket error " + std::to_string(WSAGetLastError()) + "); stop the existing listener explicitly");
        std::mutex mutex; std::condition_variable available; std::deque<SOCKET> queue;
        // Fixed worker count and bounded queue prevent unbounded threads and memory growth.
        for (int i = 0; i < 16; ++i) std::thread([&] {
            for (;;) {
                SOCKET accepted;
                { std::unique_lock lock(mutex); available.wait(lock, [&] { return !queue.empty(); }); accepted = queue.front(); queue.pop_front(); }
                Socket client(accepted);
                DWORD timeout = 10000;
                setsockopt(accepted, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<char*>(&timeout), sizeof(timeout));
                setsockopt(accepted, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<char*>(&timeout), sizeof(timeout));
                try { auto req = readRequest(accepted); serve(accepted, req, root); }
                catch (const HttpError& e) { try { response(accepted, e.status, e.message); } catch (...) {} }
                catch (...) { /* Socket closes on disconnect or file read failure. */ }
            }
        }).detach();
        std::cout << "Native frontend listening at http://127.0.0.1:4173; API proxy -> 127.0.0.1:4317" << std::endl;
        for (;;) {
            SOCKET accepted = accept(listener.value, nullptr, nullptr);
            if (accepted == INVALID_SOCKET) { std::cerr << "Native host accept failed: " << WSAGetLastError() << std::endl; ExitProcess(1); }
            { std::lock_guard lock(mutex); if (queue.size() >= 64) { closesocket(accepted); continue; } queue.push_back(accepted); }
            available.notify_one();
        }
    } catch (const std::exception& e) { std::cerr << e.what() << '\n'; return 1; }
}
