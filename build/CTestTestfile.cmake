# CMake generated Testfile for 
# Source directory: C:/Users/treyu/Personal Code/operatingSystemChatGPT/native
# Build directory: C:/Users/treyu/Personal Code/operatingSystemChatGPT/build
# 
# This file includes the relevant testing commands required for 
# testing this directory and lists subdirectories to be tested as well.
if(CTEST_CONFIGURATION_TYPE MATCHES "^([Dd][Ee][Bb][Uu][Gg])$")
  add_test([=[bridge-protocol]=] "C:/Users/treyu/Personal Code/operatingSystemChatGPT/build/Debug/live-desktop-windows-bridge.exe" "--self-test")
  set_tests_properties([=[bridge-protocol]=] PROPERTIES  _BACKTRACE_TRIPLES "C:/Users/treyu/Personal Code/operatingSystemChatGPT/native/CMakeLists.txt;36;add_test;C:/Users/treyu/Personal Code/operatingSystemChatGPT/native/CMakeLists.txt;0;")
elseif(CTEST_CONFIGURATION_TYPE MATCHES "^([Rr][Ee][Ll][Ee][Aa][Ss][Ee])$")
  add_test([=[bridge-protocol]=] "C:/Users/treyu/Personal Code/operatingSystemChatGPT/build/Release/live-desktop-windows-bridge.exe" "--self-test")
  set_tests_properties([=[bridge-protocol]=] PROPERTIES  _BACKTRACE_TRIPLES "C:/Users/treyu/Personal Code/operatingSystemChatGPT/native/CMakeLists.txt;36;add_test;C:/Users/treyu/Personal Code/operatingSystemChatGPT/native/CMakeLists.txt;0;")
elseif(CTEST_CONFIGURATION_TYPE MATCHES "^([Mm][Ii][Nn][Ss][Ii][Zz][Ee][Rr][Ee][Ll])$")
  add_test([=[bridge-protocol]=] "C:/Users/treyu/Personal Code/operatingSystemChatGPT/build/MinSizeRel/live-desktop-windows-bridge.exe" "--self-test")
  set_tests_properties([=[bridge-protocol]=] PROPERTIES  _BACKTRACE_TRIPLES "C:/Users/treyu/Personal Code/operatingSystemChatGPT/native/CMakeLists.txt;36;add_test;C:/Users/treyu/Personal Code/operatingSystemChatGPT/native/CMakeLists.txt;0;")
elseif(CTEST_CONFIGURATION_TYPE MATCHES "^([Rr][Ee][Ll][Ww][Ii][Tt][Hh][Dd][Ee][Bb][Ii][Nn][Ff][Oo])$")
  add_test([=[bridge-protocol]=] "C:/Users/treyu/Personal Code/operatingSystemChatGPT/build/RelWithDebInfo/live-desktop-windows-bridge.exe" "--self-test")
  set_tests_properties([=[bridge-protocol]=] PROPERTIES  _BACKTRACE_TRIPLES "C:/Users/treyu/Personal Code/operatingSystemChatGPT/native/CMakeLists.txt;36;add_test;C:/Users/treyu/Personal Code/operatingSystemChatGPT/native/CMakeLists.txt;0;")
else()
  add_test([=[bridge-protocol]=] NOT_AVAILABLE)
endif()
