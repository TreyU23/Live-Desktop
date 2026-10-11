#include <windows.h>
#include <wincrypt.h>
#include <jni.h>
#include <vector>

extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_localassistant_os_service_WindowsCredentialProtection_crypt(JNIEnv* env, jclass, jbyteArray input, jboolean protect) {
    auto fail = [&] { env->ThrowNew(env->FindClass("java/io/IOException"), "Windows credential protection failed."); };
    if (!input) { fail(); return nullptr; }
    jsize length = env->GetArrayLength(input);
    if (length <= 0 || length > 65536) { fail(); return nullptr; }
    try {
        std::vector<unsigned char> bytes(static_cast<size_t>(length));
        env->GetByteArrayRegion(input, 0, length, reinterpret_cast<jbyte*>(bytes.data()));
        if (env->ExceptionCheck()) { SecureZeroMemory(bytes.data(), bytes.size()); return nullptr; }
        DATA_BLOB source{static_cast<DWORD>(length), bytes.data()}, output{};
        BOOL success = protect
            ? CryptProtectData(&source, nullptr, nullptr, nullptr, nullptr, CRYPTPROTECT_UI_FORBIDDEN, &output)
            : CryptUnprotectData(&source, nullptr, nullptr, nullptr, nullptr, CRYPTPROTECT_UI_FORBIDDEN, &output);
        SecureZeroMemory(bytes.data(), bytes.size());
        if (!success) { fail(); return nullptr; }
        jbyteArray result = nullptr;
        if (output.cbData <= 65536) {
            result = env->NewByteArray(static_cast<jsize>(output.cbData));
            if (result) env->SetByteArrayRegion(result, 0, static_cast<jsize>(output.cbData), reinterpret_cast<jbyte*>(output.pbData));
        }
        SecureZeroMemory(output.pbData, output.cbData);
        LocalFree(output.pbData);
        if (!result && !env->ExceptionCheck()) fail();
        return result;
    } catch (...) { fail(); return nullptr; }
}
