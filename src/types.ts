export type LabStatus = "idle" | "loading" | "ready" | "running" | "passed" | "failed";

export type Fixture = {
  file: string;
  title: string;
  source: string;
  sha256: string;
  bundled: boolean;
};

export type SystemDefinition = {
  id: string;
  name: string;
  era: string;
  core: string;
  extensions: string[];
  threads: boolean;
  description: string;
  fixture?: Fixture;
  notes?: string;
};

export type SmokeResult = {
  schemaVersion: 1;
  runId: string;
  systemId: string;
  systemName: string;
  core: string;
  fixture: string;
  status: "passed" | "failed";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  frameDelta: number;
  measuredFps: number;
  canvas: { width: number; height: number; nonBlank: boolean };
  audioState: string;
  crossOriginIsolated: boolean;
  sharedArrayBuffer: boolean;
  webgl2: boolean;
  userAgent: string;
  errors: string[];
};

export type LabApi = {
  schemaVersion: 1;
  status: LabStatus;
  systemId?: string;
  lastResult?: SmokeResult;
  errors: string[];
  capabilities: () => Record<string, unknown>;
  runSmokeTest: (sampleMs?: number) => Promise<SmokeResult>;
  simulateInput: (button: number, value?: number, player?: number) => void;
  exportResults: () => SmokeResult[];
};
