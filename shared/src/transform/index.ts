export {
  analyzeSingleByteXor,
  analyzeRepeatingXor,
  xorWithKey,
  type XorCandidate,
} from "./xor.ts";
export { scanEncodings, tryDecodeAt, type EncodingHit, type EncodingKind } from "./encoding.ts";
export { scanCompression, type CompressionHit, type CompressionKind } from "./compression.ts";
export {
  carveFiles,
  CARVE_SIGNATURES,
  estimateCarveLength,
  type CarvedArtifact,
} from "./carving.ts";
export { shannonEntropy } from "./entropy.ts";
