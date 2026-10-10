import { useMemo } from "react";
import type { CfgGraph } from "@hexora/shared";
import { formatHex } from "../lib/format";

interface Props {
  graph: CfgGraph | null;
  label: string;
  onSelectOffset: (fileOffset: number) => void;
}

const NODE_W = 168;
const NODE_H = 56;
const GAP_X = 48;
const GAP_Y = 24;

function layoutLayers(graph: CfgGraph): Map<number, { x: number; y: number }> {
  const layers = new Map<number, number>();
  const incoming = new Map<number, number>();
  for (const b of graph.blocks) incoming.set(b.id, 0);
  for (const e of graph.edges) {
    incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
  }

  const queue: number[] = [graph.entryBlockId];
  layers.set(graph.entryBlockId, 0);
  const seen = new Set(queue);

  while (queue.length > 0) {
    const id = queue.shift()!;
    const layer = layers.get(id) ?? 0;
    for (const e of graph.edges.filter((x) => x.from === id)) {
      const next = Math.max(layers.get(e.to) ?? 0, layer + 1);
      layers.set(e.to, next);
      if (!seen.has(e.to)) {
        seen.add(e.to);
        queue.push(e.to);
      }
    }
  }

  for (const b of graph.blocks) {
    if (!layers.has(b.id)) layers.set(b.id, 0);
  }

  const byLayer = new Map<number, number[]>();
  for (const b of graph.blocks) {
    const L = layers.get(b.id) ?? 0;
    const arr = byLayer.get(L) ?? [];
    arr.push(b.id);
    byLayer.set(L, arr);
  }

  const pos = new Map<number, { x: number; y: number }>();
  for (const [layer, ids] of byLayer) {
    ids.sort((a, b) => a - b);
    ids.forEach((id, row) => {
      pos.set(id, {
        x: layer * (NODE_W + GAP_X),
        y: row * (NODE_H + GAP_Y),
      });
    });
  }
  return pos;
}

export function CfgPanel({ graph, label, onSelectOffset }: Props) {
  const layout = useMemo(() => (graph ? layoutLayers(graph) : null), [graph]);

  if (!graph || !layout || graph.blocks.length === 0) {
    return (
      <div className="glass-card hairline-inset p-4 text-fog-veil text-body-sm">
        Disasm タブでスライスを選び、命令がデコードされたら CFG を表示できます。
      </div>
    );
  }

  let maxX = 0;
  let maxY = 0;
  for (const p of layout.values()) {
    maxX = Math.max(maxX, p.x + NODE_W);
    maxY = Math.max(maxY, p.y + NODE_H);
  }

  const edgeColor = (kind: string) => {
    if (kind === "fallthrough") return "rgba(186,214,247,0.35)";
    if (kind === "call") return "rgba(120,200,255,0.7)";
    return "rgba(255,160,100,0.75)";
  };

  return (
    <div className="glass-card hairline-inset p-4 flex flex-col max-h-[520px]">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-aeonikpro text-heading-sm text-ice-highlight">CFG</h3>
        <span className="text-caption text-fog-veil truncate">
          {label} · {graph.blocks.length} blocks · {graph.edges.length} edges
        </span>
      </div>
      <div className="overflow-auto flex-1 border border-[rgba(186,215,247,0.08)] rounded-lg bg-[rgba(0,0,0,0.2)]">
        <svg
          width={maxX + 40}
          height={maxY + 40}
          className="min-w-full"
          role="img"
          aria-label="Control flow graph"
        >
          {graph.edges.map((e, i) => {
            const a = layout.get(e.from);
            const b = layout.get(e.to);
            if (!a || !b) return null;
            const x1 = a.x + NODE_W;
            const y1 = a.y + NODE_H / 2;
            const x2 = b.x;
            const y2 = b.y + NODE_H / 2;
            const mx = (x1 + x2) / 2;
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={edgeColor(e.kind)}
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
              />
            );
          })}
          <defs>
            <marker
              id="arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="rgba(186,214,247,0.5)" />
            </marker>
          </defs>
          {graph.blocks.map((b) => {
            const p = layout.get(b.id)!;
            const isEntry = b.id === graph.entryBlockId;
            return (
              <g
                key={b.id}
                transform={`translate(${p.x + 20},${p.y + 20})`}
                className="cursor-pointer"
                onClick={() => onSelectOffset(b.startFileOffset)}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={6}
                  fill={isEntry ? "rgba(80,140,255,0.15)" : "rgba(186,214,247,0.08)"}
                  stroke={isEntry ? "rgba(120,180,255,0.6)" : "rgba(186,214,247,0.2)"}
                />
                <text
                  x={8}
                  y={18}
                  className="fill-[#bae0f7] text-[10px] font-dotdigital"
                >
                  BB{b.id} · {b.instructionCount} insn
                </text>
                <text
                  x={8}
                  y={34}
                  className="fill-[#e8f0ff] text-[10px] font-dotdigital"
                >
                  {b.entryMnemonic} … {b.exitMnemonic}
                </text>
                <text
                  x={8}
                  y={48}
                  className="fill-[#8899aa] text-[9px] font-dotdigital"
                >
                  {formatHex(b.startFileOffset)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-caption text-fog-veil mt-2">
        色: オレンジ=jump · 青=call · 灰=fallthrough。ブロックをクリックで Hex へ。
      </p>
    </div>
  );
}
