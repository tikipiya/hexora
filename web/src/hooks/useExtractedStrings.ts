import { useEffect, useState } from "react";
import {
  DEFAULT_STRING_OPTIONS,
  extractStringsAsync,
  type ExtractedString,
  type StringExtractOptions,
} from "../lib/strings";

export function useExtractedStrings(
  data: Uint8Array | null,
  options: StringExtractOptions = DEFAULT_STRING_OPTIONS,
) {
  const [strings, setStrings] = useState<ExtractedString[]>([]);
  const [scanning, setScanning] = useState(false);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    if (!data) {
      setStrings([]);
      setTruncated(false);
      return;
    }

    let cancelled = false;
    setScanning(true);
    setStrings([]);

    void extractStringsAsync(data, options, (partial) => {
      if (!cancelled) setStrings(partial);
    }).then((result) => {
      if (cancelled) return;
      setStrings(result.strings);
      setTruncated(result.truncated);
      setScanning(false);
    });

    return () => {
      cancelled = true;
    };
  }, [data, options.minLength, options.maxResults, options.dedupe, options.encodings.join(",")]);

  return { strings, scanning, truncated };
}
