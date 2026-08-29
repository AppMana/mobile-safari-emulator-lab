# Fixture provenance

The repository does not commit generated emulator assets or fixture binaries.
Build scripts fetch or generate exact inputs and verify SHA-256 checksums.

## Public build

`npm run build` fetches these files. They are included in the GitHub Pages artifact.

| File | Purpose | Source | SHA-256 |
| --- | --- | --- | --- |
| `240pee.nes` | NES 240p Test Suite | [christopherpow/nes-test-roms](https://github.com/christopherpow/nes-test-roms) | `228a370b32daacec4c95927aa18243a57be2d45d1d038479ba9d4bb19d05985e` |
| `240p-test-suite.gba` | GBA 240p Test Suite | [mechanize-work/gba-eval](https://github.com/mechanize-work/gba-eval) | `47844f7140738a06f8f3bc09780da3ab095539a250b870f614feed561d9d6f34` |
| `TETRADE_PSX.bin` | MIT-licensed PS1 homebrew | [Tetrade v1.0](https://github.com/Logan-Campbell/Tetrade/releases/tag/v1.0) | `2f41feba2023cbdcd9c1c3d4cfc3d8d1a7f1a2de0afea2e7a050b84640d6eaf8` |
| `dos-lab.zip` | generated DOS VGA animation | [`fixtures-src/dos-lab.asm`](fixtures-src/dos-lab.asm) | `75e719b7396b7fb54d7ffb442ccf7220d4e5cd9db938e6850e138a97e214f7f2` |

The DOS ZIP is deterministic and contains the checked-in source's 40-byte COM
program plus `AUTOEXEC.BAT`.

## Explicit local test set

`npm run fixtures:local` additionally fetches these checksum-pinned test inputs.
They are excluded from Git and from the normal Pages build.

| File | System | Source | SHA-256 |
| --- | --- | --- | --- |
| `happyflappy.prg` | Commodore 64 | [retrobrews/c64-games](https://github.com/retrobrews/c64-games) | `bb269e813f0fc648c643b0fc3bbbc9e47a2e342ce144ff73191d1ee3068ed41e` |
| `flappy_the_duck.bin` | Atari 2600 | [retrobrews/atari2600-games](https://github.com/retrobrews/atari2600-games) | `e6b0e6db04d459a12e3202d695ce015fe8f84a0e67f7d26c87cc086ab500cab0` |
| `blt.sfc` | SNES | [retrobrews/snes-games](https://github.com/retrobrews/snes-games) | `1f4004deb5981fa6115c1d3676add48d5437a3edb52a9203fbe14085fcb0b7ac` |
| `megaflappysis.bin` | Genesis | [retrobrews/md-games](https://github.com/retrobrews/md-games) | `7e428be1f4a337abd86ab35db9b10c755efb14aad7f62f701369481dd2d6357f` |
| `circus.zip` | Arcade | [MAME free ROMs](https://www.mamedev.org/roms/) | `27d3952dba171d50ef63a7a651e063f83830d2e07e4799dadcc5c42e0371d424` |

The MAME page permits non-commercial use of its listed ROMs and asks sites not to
mirror them. The script therefore downloads Circus from MAME for a local test and
does not rebundle it.
