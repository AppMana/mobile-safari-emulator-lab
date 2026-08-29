import type { LabApi } from "./types";

declare global {
  interface Window {
    coi?: Record<string, unknown>;
    __EMULATION_LAB__: LabApi;
    EJS_player: string;
    EJS_gameName: string;
    EJS_gameUrl: string | File;
    EJS_core: string;
    EJS_pathtodata: string;
    EJS_startOnLoaded: boolean;
    EJS_threads: boolean;
    EJS_biosUrl: string;
    EJS_color: string;
    EJS_backgroundColor: string;
    EJS_disableAutoLang: boolean;
    EJS_noAutoFocus: boolean;
    EJS_DEBUG_XX: boolean;
    EJS_ready: () => void;
    EJS_onGameStart: () => void;
    EJS_emulator?: {
      started?: boolean;
      failedToStart?: boolean;
      canvas?: HTMLCanvasElement;
      Module?: Record<string, unknown> & { AL?: { currentCtx?: { sources?: unknown[] } } };
      gameManager?: {
        getFrameNum: () => number;
        simulateInput: (player: number, button: number, value: number) => void;
      };
    };
  }
}

export {};
