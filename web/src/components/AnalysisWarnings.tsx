import type { ParseIssue } from "@hexora/shared";

export function AnalysisWarnings({ issues }: { issues: ParseIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="glass-card hairline-inset p-4">
      <h3 className="font-aeonikpro text-heading-sm text-ice-highlight mb-2">
        Parse warnings
      </h3>
      <ul className="text-caption space-y-1 max-h-48 overflow-auto">
        {issues.map((i, idx) => (
          <li
            key={`${i.code}-${idx}`}
            className={
              i.severity === "error"
                ? "text-ember-glow"
                : i.heuristic
                  ? "text-blueprint-blue"
                  : "text-fog-veil"
            }
          >
            [{i.severity}] {i.code}: {i.message}
            {i.heuristic && " (heuristic)"}
          </li>
        ))}
      </ul>
    </div>
  );
}
