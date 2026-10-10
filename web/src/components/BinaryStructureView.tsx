import type { BinaryAnalysis } from "../lib/binaryAnalysis";
import { ResourceTreeView } from "./ResourceTreeView";

interface Props {
  analysis: BinaryAnalysis;
  onSelectOffset: (offset: number) => void;
  onDisasmAt?: (fileOffset: number) => void;
}

export function BinaryStructureView({ analysis, onSelectOffset, onDisasmAt }: Props) {
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
          onDisasmRow={(row) => onDisasmAt?.(pe.sections[row]!.pointerToRawData)}
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
          <div className="space-y-2">
            <h4 className="text-moon-mist text-body-sm font-medium">Imports</h4>
            <ul className="text-caption font-dotdigital space-y-2">
              {pe.imports.map((imp) => (
                <li key={imp.dll}>
                  <details>
                    <summary className="text-frost-glow cursor-pointer">
                      {imp.dll}
                      <span className="text-fog-veil ml-2">({imp.functions.length})</span>
                    </summary>
                    <ul className="pl-4 mt-1 text-moon-mist max-h-40 overflow-auto">
                      {imp.functions.slice(0, 80).map((fn, i) => (
                        <li key={`${fn.iatRva}-${i}`}>
                          {fn.name ?? `#${fn.ordinal}`}
                          <span className="text-fog-veil"> · IAT 0x{fn.iatRva.toString(16)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        )}
        {pe.resourceTree.length > 0 && (
          <div>
            <h4 className="text-moon-mist text-body-sm font-medium mb-2">
              Resource tree ({pe.resources.length})
            </h4>
            <ResourceTreeView
              nodes={pe.resourceTree}
              onSelect={onSelectOffset}
            />
          </div>
        )}
        {pe.resources.length > 0 && (
          <SectionTable
            title={`Resources flat (${pe.resources.length})`}
            columns={["Type", "Name", "Lang", "Size", "File"]}
            rows={pe.resources.slice(0, 150).map((res) => [
              res.typeName,
              String(res.nameId),
              String(res.langId),
              String(res.size),
              res.fileOffset !== null ? `0x${res.fileOffset.toString(16)}` : "—",
            ])}
            onCellClick={(row) => {
              const res = pe.resources[row];
              if (res?.fileOffset != null) onSelectOffset(res.fileOffset);
            }}
          />
        )}
        {pe.debugEntries.length > 0 && (
          <SectionTable
            title="Debug directory"
            columns={["Type", "PDB / CV", "Size", "File"]}
            rows={pe.debugEntries.map((d) => [
              d.typeName,
              d.pdbPath ?? d.codeviewKind ?? "—",
              String(d.sizeOfData),
              d.fileOffset !== null ? `0x${d.fileOffset.toString(16)}` : "—",
            ])}
            onCellClick={(row) => {
              const d = pe.debugEntries[row];
              if (d?.fileOffset != null) onSelectOffset(d.fileOffset);
            }}
          />
        )}
        {pe.tls && (
          <HeaderGrid
            rows={[
              ["TLS start RVA", `0x${pe.tls.startRva.toString(16)}`],
              ["TLS end RVA", `0x${pe.tls.endRva.toString(16)}`],
              ["Index RVA", `0x${pe.tls.indexRva.toString(16)}`],
              ["Callbacks RVA", `0x${pe.tls.callbacksRva.toString(16)}`],
              ["Zero fill", String(pe.tls.sizeOfZeroFill)],
            ]}
          />
        )}
        {pe.delayImports.length > 0 && (
          <SectionTable
            title="Delay load imports"
            columns={["DLL", "Attributes", "Name RVA"]}
            rows={pe.delayImports.map((d) => [
              d.dll,
              `0x${d.attributes.toString(16)}`,
              `0x${d.rva.toString(16)}`,
            ])}
          />
        )}
        {pe.relocBlocks.length > 0 && (
          <SectionTable
            title={`Base reloc blocks (${pe.relocBlocks.length})`}
            columns={["Page RVA", "Block size", "Entries", "File"]}
            rows={pe.relocBlocks.slice(0, 100).map((b) => [
              `0x${b.pageRva.toString(16)}`,
              String(b.blockSize),
              String(b.entryCount),
              `0x${b.fileOffset.toString(16)}`,
            ])}
            onCellClick={(row) => onSelectOffset(pe.relocBlocks[row]!.fileOffset)}
          />
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
          onDisasmRow={(row) => {
            const s = elf.sectionHeaders[row]!;
            if (!s.isNobits) onDisasmAt?.(Number(s.offset));
          }}
        />
        {elf.versions && elf.versions.verneed.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-moon-mist text-body-sm font-medium">GNU versions</h4>
            <ul className="text-caption font-dotdigital space-y-2">
              {elf.versions.verneed.map((vn, i) => (
                <li key={i}>
                  <span className="text-frost-glow">{vn.file || "(file)"}</span>
                  <ul className="pl-4 text-moon-mist">
                    {vn.versions.map((v) => (
                      <li key={v.index}>
                        {v.name} <span className="text-fog-veil">idx {v.index}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}
        {elf.dynamic.length > 0 && (
          <SectionTable
            title={`Dynamic (${elf.dynamic.length})`}
            columns={["Tag", "Value"]}
            rows={elf.dynamic.slice(0, 120).map((d) => [
              d.tagName,
              `0x${d.value.toString(16)}`,
            ])}
          />
        )}
        {elf.relocations.length > 0 && (
          <SectionTable
            title={`Relocations (${elf.relocations.length})`}
            columns={["Offset", "Sym", "Type", "Rela"]}
            rows={elf.relocations.slice(0, 200).map((rel) => [
              `0x${rel.offset.toString(16)}`,
              String(rel.sym),
              String(rel.type),
              rel.rela ? "yes" : "no",
            ])}
          />
        )}
        {elf.symbols.length > 0 && (
          <SectionTable
            title={`Symbols (${elf.symbols.length})`}
            columns={["Name", "Value", "Size", "Bind", "Type", "Ver", "Sec"]}
            rows={elf.symbols.slice(0, 300).map((s) => [
              s.name,
              `0x${s.value.toString(16)}`,
              String(s.size),
              s.bind,
              s.type,
              s.versionName ?? "",
              s.sectionName ?? String(s.shndx),
            ])}
          />
        )}
      </div>
    );
  }

  if (analysis.kind === "macho" && analysis.macho) {
    const m = analysis.macho;
    return (
      <div className="glass-card hairline-inset p-4 space-y-4 max-h-[70vh] overflow-auto">
        <h3 className="font-aeonikpro text-heading-sm text-ice-highlight">Mach-O Structure</h3>
        <HeaderGrid
          rows={[
            ["CPU", m.cpuName],
            ["File type", m.fileTypeName],
            ["Bits", String(m.bits)],
            ["Magic", m.magic],
            ["Load commands", String(m.loadCommands.length)],
          ]}
        />
        <SectionTable
          title="Segments"
          columns={["Name", "VMA", "VMSize", "FileOff", "FileSize", "Prot"]}
          rows={m.segments.map((s) => [
            s.name,
            `0x${s.vmaddr.toString(16)}`,
            String(s.vmsize),
            `0x${s.fileoff.toString(16)}`,
            String(s.filesize),
            s.initprot,
          ])}
          onCellClick={(row) => onSelectOffset(Number(m.segments[row]!.fileoff))}
          onDisasmRow={(row) => onDisasmAt?.(Number(m.segments[row]!.fileoff))}
        />
        <SectionTable
          title="Load commands"
          columns={["Cmd", "Size", "Offset"]}
          rows={m.loadCommands.slice(0, 80).map((c) => [
            c.cmdName,
            String(c.cmdsize),
            `0x${c.fileOffset.toString(16)}`,
          ])}
          onCellClick={(row) => onSelectOffset(m.loadCommands[row]!.fileOffset)}
        />
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
  onDisasmRow,
}: {
  title: string;
  columns: string[];
  rows: string[][];
  onCellClick?: (rowIndex: number) => void;
  onDisasmRow?: (rowIndex: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-moon-mist text-body-sm font-medium">{title}</h4>
        {onDisasmRow && rows.length > 0 && (
          <span className="text-caption text-fog-veil">行名クリック → Hex · Disasm でセクション先頭</span>
        )}
      </div>
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
                    <span className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        className="hover:text-frost-glow hover:underline"
                        onClick={() => onCellClick(ri)}
                      >
                        {cell}
                      </button>
                      {onDisasmRow && (
                        <button
                          type="button"
                          className="text-blueprint-blue text-caption hover:underline"
                          onClick={() => onDisasmRow(ri)}
                        >
                          Disasm
                        </button>
                      )}
                    </span>
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
