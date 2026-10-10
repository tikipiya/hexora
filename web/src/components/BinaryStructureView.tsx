import type { BinaryAnalysis } from "../lib/binaryAnalysis";

interface Props {
  analysis: BinaryAnalysis;
  onSelectOffset: (offset: number) => void;
}

export function BinaryStructureView({ analysis, onSelectOffset }: Props) {
  if (analysis.kind === "pe" && analysis.pe) {
    const pe = analysis.pe;
    return (
      <div className="glass-card hairline-inset p-4 space-y-4 max-h-[70vh] overflow-auto">
        <h3 className="font-aeonikpro text-heading-sm text-ice-highlight">PE Structure</h3>
        <HeaderGrid
          rows={[
            ["Machine", pe.coff.machineName],
            ["ImageBase", `0x${pe.imageBase.toString(16)}`],
            ["Entry RVA", `0x${pe.entryPointRva.toString(16)}`],
            ["Entry VA", `0x${(pe.imageBase + BigInt(pe.entryPointRva)).toString(16)}`],
            ["Subsystem", pe.subsystemName],
            ["Sections", String(pe.sections.length)],
          ]}
        />
        <SectionTable
          title="Sections"
          columns={["Name", "RVA", "VSz", "Raw", "RawSz", "Perms"]}
          rows={pe.sections.map((s) => [
            s.name,
            `0x${s.virtualAddress.toString(16)}`,
            String(s.virtualSize),
            `0x${s.pointerToRawData.toString(16)}`,
            String(s.sizeOfRawData),
            s.permissions,
          ])}
          onCellClick={(row) => onSelectOffset(pe.sections[row]!.pointerToRawData)}
        />
        <SectionTable
          title="Data directories"
          columns={["Name", "RVA", "Size", "File", "OK"]}
          rows={pe.dataDirectories
            .filter((d) => d.rva !== 0 || d.size !== 0)
            .map((d) => [
              d.name,
              `0x${d.rva.toString(16)}`,
              String(d.size),
              d.fileOffset !== null ? `0x${d.fileOffset.toString(16)}` : "—",
              d.valid ? "yes" : "no",
            ])}
          onCellClick={(row) => {
            const d = pe.dataDirectories.filter((x) => x.rva || x.size)[row];
            if (d?.fileOffset != null) onSelectOffset(d.fileOffset);
          }}
        />
        {pe.imports.length > 0 && (
          <div>
            <h4 className="text-moon-mist text-body-sm font-medium mb-2">Imports</h4>
            <ul className="text-caption font-dotdigital space-y-2">
              {pe.imports.map((imp) => (
                <li key={imp.dll}>
                  <span className="text-frost-glow">{imp.dll}</span>
                  <span className="text-fog-veil ml-2">({imp.functions.length} thunks)</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {pe.exports.length > 0 && (
          <SectionTable
            title={`Exports (${pe.exports.length})`}
            columns={["Name", "Ordinal", "RVA"]}
            rows={pe.exports.slice(0, 200).map((e) => [
              e.name ?? "(ordinal)",
              String(e.ordinal),
              `0x${e.rva.toString(16)}`,
            ])}
          />
        )}
      </div>
    );
  }

  if (analysis.kind === "elf" && analysis.elf) {
    const elf = analysis.elf;
    return (
      <div className="glass-card hairline-inset p-4 space-y-4 max-h-[70vh] overflow-auto">
        <h3 className="font-aeonikpro text-heading-sm text-ice-highlight">ELF Structure</h3>
        <HeaderGrid
          rows={[
            ["Class", `ELF${elf.header.class}`],
            ["Endian", elf.header.endian],
            ["Type", elf.header.typeName],
            ["Machine", elf.header.machineName],
            ["Entry", `0x${elf.header.entry.toString(16)}`],
            ["Interpreter", elf.interpreter ?? "—"],
          ]}
        />
        <SectionTable
          title="Program headers (PT_LOAD highlighted)"
          columns={["Type", "Offset", "VAddr", "FileSz", "MemSz"]}
          rows={elf.programHeaders.map((p) => [
            p.typeName,
            `0x${p.offset.toString(16)}`,
            `0x${p.vaddr.toString(16)}`,
            String(p.filesz),
            String(p.memsz),
          ])}
          onCellClick={(row) => {
            const p = elf.programHeaders[row]!;
            if (p.type === 1) onSelectOffset(Number(p.offset));
          }}
        />
        <SectionTable
          title="Sections"
          columns={["Name", "Type", "Addr", "Offset", "Size", "BSS"]}
          rows={elf.sectionHeaders.map((s) => [
            s.name,
            s.typeName,
            `0x${s.addr.toString(16)}`,
            s.isNobits ? "—" : `0x${s.offset.toString(16)}`,
            String(s.size),
            s.isNobits ? "yes" : "",
          ])}
          onCellClick={(row) => {
            const s = elf.sectionHeaders[row]!;
            if (!s.isNobits) onSelectOffset(Number(s.offset));
          }}
        />
        {elf.symbols.length > 0 && (
          <SectionTable
            title={`Symbols (${elf.symbols.length})`}
            columns={["Name", "Value", "Size", "Bind", "Type", "Sec"]}
            rows={elf.symbols.slice(0, 300).map((s) => [
              s.name,
              `0x${s.value.toString(16)}`,
              String(s.size),
              s.bind,
              s.type,
              s.sectionName ?? String(s.shndx),
            ])}
          />
        )}
      </div>
    );
  }

  return (
    <div className="glass-card hairline-inset p-4 text-fog-veil text-body-sm">
      Unknown or unsupported format — raw hex view only.
    </div>
  );
}

function HeaderGrid({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-fog-veil">{k}</dt>
          <dd className="text-frost-glow font-dotdigital">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionTable({
  title,
  columns,
  rows,
  onCellClick,
}: {
  title: string;
  columns: string[];
  rows: string[][];
  onCellClick?: (rowIndex: number) => void;
}) {
  return (
    <div>
      <h4 className="text-moon-mist text-body-sm font-medium mb-2">{title}</h4>
      <table className="w-full text-caption font-dotdigital">
        <thead className="text-fog-veil">
          <tr>
            {columns.map((c) => (
              <th key={c} className="text-left py-1 pr-2">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="py-1 pr-2 text-moon-mist">
                  {ci === 0 && onCellClick ? (
                    <button type="button" className="hover:text-frost-glow hover:underline" onClick={() => onCellClick(ri)}>
                      {cell}
                    </button>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
