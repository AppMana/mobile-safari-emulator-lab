# PS1 Lab fixture

This fixture is adapted from the MPL-2.0 `beginner/hello` example in the
official [PSn00bSDK v0.24](https://github.com/Lameguy64/PSn00bSDK/tree/v0.24/examples/beginner/hello).
It draws identifying text and an animated tile through the emulated PlayStation
GPU without requiring a proprietary BIOS.

The checked-in `ps1-lab.exe` was built with the official v0.24 Linux package:

```sh
export PATH=/path/to/PSn00bSDK-0.24-Linux/bin:$PATH
cmake -S fixtures-src/ps1-lab -B /tmp/ps1-lab-build -G Ninja \
  -DCMAKE_TOOLCHAIN_FILE=/path/to/PSn00bSDK-0.24-Linux/lib/libpsn00b/cmake/sdk.cmake
cmake --build /tmp/ps1-lab-build
```

Expected SHA-256:

```text
74b1d679d7bae3860e9ef3756279705375c53d85bf47c4914dff08e01e38b687  ps1-lab.exe
```
