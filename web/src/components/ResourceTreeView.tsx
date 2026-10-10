import type { PeResourceNode } from "@hexora/shared";

interface Props {
  nodes: PeResourceNode[];
  onSelect: (fileOffset: number) => void;
}

export function ResourceTreeView({ nodes, onSelect }: Props) {
  if (nodes.length === 0) return null;
  return (
    <ul className="text-caption font-dotdigital space-y-1 pl-2">
      {nodes.map((n) => (
        <TreeNode key={n.id} node={n} onSelect={onSelect} depth={0} />
      ))}
    </ul>
  );
}

function TreeNode({
  node,
  onSelect,
  depth,
}: {
  node: PeResourceNode;
  onSelect: (fileOffset: number) => void;
  depth: number;
}) {
  const hasChildren = node.children.length > 0;
  return (
    <li>
      {node.leaf?.fileOffset != null ? (
        <button
          type="button"
          className="text-frost-glow hover:underline"
          onClick={() => onSelect(node.leaf!.fileOffset!)}
        >
          {node.label}
          <span className="text-fog-veil ml-1">
            @ 0x{node.leaf.fileOffset.toString(16)}
          </span>
        </button>
      ) : (
        <span className={depth === 0 ? "text-moon-mist font-medium" : "text-fog-veil"}>
          {node.label}
        </span>
      )}
      {hasChildren && (
        <ul className="pl-4 border-l border-[rgba(186,215,247,0.08)] ml-1 mt-0.5">
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} onSelect={onSelect} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
