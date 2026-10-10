import type { DisasmInstruction } from "@hexora/shared";
import type { BinaryAnalysis } from "../binaryAnalysis";
import type { LoadedFile } from "../fileLoad";
import type { DisasmSliceState } from "../../components/DisasmTargetPicker";
import type { ShareableTab } from "../urlState";
import { DEFAULT_STRING_OPTIONS } from "../strings";

export interface FileUiState {
  tab: ShareableTab;
  jumpOffset?: number;
  hexFocus: { start: number; end: number } | null;
  hexSelection: { start: number; end: number } | null;
  stringMinLen: number;
  stringDedupe: boolean;
  disasmSlice: DisasmSliceState | null;
  disasmJumpOffset?: number;
  disasmInstructions: DisasmInstruction[];
  transformScope: "full" | "selection";
  diffPeerId: string | null;
  /** ディスクから選んだ比較ファイル（4 MiB 未満のみ UI 状態に保持） */
  diffPeerBase64: string | null;
  diffPeerName: string | null;
  diffOverlay: boolean;
  notes: string;
}

export interface FileSession {
  id: string;
  fileName: string;
  data: Uint8Array;
  buffer: ArrayBuffer;
  analysis: BinaryAnalysis;
  hashes: LoadedFile["hashes"];
  warnedLarge: boolean;
  ui: FileUiState;
  dirty: boolean;
}

export const defaultFileUi = (): FileUiState => ({
  tab: "overview",
  jumpOffset: undefined,
  hexFocus: null,
  hexSelection: null,
  stringMinLen: DEFAULT_STRING_OPTIONS.minLength,
  stringDedupe: DEFAULT_STRING_OPTIONS.dedupe,
  disasmSlice: null,
  disasmJumpOffset: undefined,
  disasmInstructions: [],
  transformScope: "full",
  diffPeerId: null,
  diffPeerBase64: null,
  diffPeerName: null,
  diffOverlay: false,
  notes: "",
});
