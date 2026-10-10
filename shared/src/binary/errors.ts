export type ParseSeverity = "error" | "warning" | "heuristic";

export class BinaryParseError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly offset?: number,
  ) {
    super(message);
    this.name = "BinaryParseError";
  }
}

export interface ParseIssue {
  severity: ParseSeverity;
  code: string;
  message: string;
  offset?: number;
  heuristic?: boolean;
}

export type ParseMode = "strict" | "lenient";
