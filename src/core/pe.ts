import type { AppCompatibilityProfile, CpuArchitecture, PeImport, PeSection } from './types';

const MAX_PROBE_BYTES = 12 * 1024 * 1024;

class ViewReader {
  constructor(private readonly view: DataView, private readonly bytes: Uint8Array) {}
  u16(offset: number) { return this.view.getUint16(offset, true); }
  u32(offset: number) { return this.view.getUint32(offset, true); }
  ascii(offset: number, length: number) {
    const end = Math.min(this.bytes.length, offset + length);
    let value = '';
    for (let i = offset; i < end; i++) {
      const c = this.bytes[i] ?? 0;
      if (c === 0) break;
      value += String.fromCharCode(c);
    }
    return value;
  }
  cString(offset: number, max = 512) { return this.ascii(offset, max); }
}

function machineToArch(machine: number): CpuArchitecture {
  switch (machine) {
    case 0x014c: return 'x86';
    case 0x8664: return 'x64';
    case 0x01c0:
    case 0x01c4: return 'arm';
    case 0xaa64: return 'arm64';
    default: return 'unknown';
  }
}

function subsystemName(value: number): string {
  const map: Record<number, string> = {
    1: 'Native',
    2: 'Windows GUI',
    3: 'Windows Console',
    5: 'OS/2 Console',
    7: 'POSIX Console',
    9: 'Windows CE GUI',
    10: 'EFI Application',
    11: 'EFI Boot Service Driver',
    12: 'EFI Runtime Driver',
    13: 'EFI ROM',
    14: 'Xbox',
    16: 'Windows Boot Application'
  };
  return map[value] ?? `Unknown (${value})`;
}

function rvaToOffset(rva: number, sections: PeSection[]): number | null {
  for (const section of sections) {
    const span = Math.max(section.virtualSize, section.rawSize);
    if (rva >= section.virtualAddress && rva < section.virtualAddress + span) {
      return section.rawAddress + (rva - section.virtualAddress);
    }
  }
  return null;
}

function scanAscii(bytes: Uint8Array, terms: string[]): string[] {
  const haystack = new TextDecoder('latin1').decode(bytes).toLowerCase();
  return terms.filter((term) => haystack.includes(term.toLowerCase()));
}

function classifyInstaller(fileName: string, bytes: Uint8Array): AppCompatibilityProfile['installer'] {
  const lower = fileName.toLowerCase();
  const hits = scanAscii(bytes, ['Inno Setup Setup Data', 'Nullsoft', 'NSIS', 'Windows Installer']);
  if (hits.some((h) => h.includes('Inno Setup'))) return 'inno';
  if (hits.some((h) => /nullsoft|nsis/i.test(h))) return 'nsis';
  if (hits.some((h) => /Windows Installer/i.test(h)) || /msi|installer|setup/.test(lower)) return 'msi-bootstrapper';
  return 'portable-or-unknown';
}

function parseImports(reader: ViewReader, importRva: number, sections: PeSection[], limit: number): PeImport[] {
  if (!importRva) return [];
  const start = rvaToOffset(importRva, sections);
  if (start == null || start >= limit) return [];

  const imports: PeImport[] = [];
  for (let index = 0; index < 256; index++) {
    const off = start + index * 20;
    if (off + 20 > limit) break;
    const originalFirstThunk = reader.u32(off);
    const nameRva = reader.u32(off + 12);
    const firstThunk = reader.u32(off + 16);
    if (originalFirstThunk === 0 && nameRva === 0 && firstThunk === 0) break;
    const nameOffset = rvaToOffset(nameRva, sections);
    if (nameOffset == null || nameOffset >= limit) continue;
    const dll = reader.cString(nameOffset, 256).trim();
    if (dll) imports.push({ dll, symbols: [] });
  }
  return imports;
}

export async function inspectPortableExecutable(file: File): Promise<AppCompatibilityProfile> {
  const sample = await file.slice(0, Math.min(file.size, MAX_PROBE_BYTES)).arrayBuffer();
  const bytes = new Uint8Array(sample);
  const view = new DataView(sample);
  const reader = new ViewReader(view, bytes);

  if (bytes.length < 0x100 || reader.ascii(0, 2) !== 'MZ') {
    throw new Error('This file does not have a valid DOS MZ header and is not recognized as a Windows PE executable.');
  }

  const peOffset = reader.u32(0x3c);
  if (peOffset + 0x108 >= bytes.length || reader.ascii(peOffset, 4) !== 'PE') {
    throw new Error('The PE header is missing or lies outside the safe inspection window.');
  }

  const coff = peOffset + 4;
  const machine = reader.u16(coff);
  const numberOfSections = reader.u16(coff + 2);
  const optionalHeaderSize = reader.u16(coff + 16);
  const optional = coff + 20;
  const magic = reader.u16(optional);
  const peKind = magic === 0x10b ? 'PE32' : magic === 0x20b ? 'PE32+' : 'unknown';
  const architecture = machineToArch(machine);
  const entryPoint = reader.u32(optional + 16);
  const is64 = magic === 0x20b;
  const imageBase = is64
    ? `0x${view.getBigUint64(optional + 24, true).toString(16)}`
    : `0x${reader.u32(optional + 28).toString(16)}`;
  const subsystemOffset = optional + 68;
  const subsystem = subsystemName(reader.u16(subsystemOffset));
  const dataDirectoryBase = optional + (is64 ? 112 : 96);
  const importRva = reader.u32(dataDirectoryBase + 8);
  const clrRva = reader.u32(dataDirectoryBase + 14 * 8);

  const sections: PeSection[] = [];
  const sectionBase = optional + optionalHeaderSize;
  for (let i = 0; i < Math.min(numberOfSections, 96); i++) {
    const off = sectionBase + i * 40;
    if (off + 40 > bytes.length) break;
    sections.push({
      name: reader.ascii(off, 8),
      virtualSize: reader.u32(off + 8),
      virtualAddress: reader.u32(off + 12),
      rawSize: reader.u32(off + 16),
      rawAddress: reader.u32(off + 20)
    });
  }

  const imports = parseImports(reader, importRva, sections, bytes.length);
  const importDlls = imports.map((i) => i.dll.toLowerCase());
  const graphicsApis = [
    ['ddraw.dll', 'DirectDraw'], ['d3d8.dll', 'Direct3D 8'], ['d3d9.dll', 'Direct3D 9'],
    ['d3d10.dll', 'Direct3D 10'], ['d3d11.dll', 'Direct3D 11'], ['d3d12.dll', 'Direct3D 12'],
    ['opengl32.dll', 'OpenGL'], ['vulkan-1.dll', 'Vulkan']
  ].filter(([dll]) => importDlls.includes(dll!)).map(([, label]) => label!);
  const audioApis = [
    ['dsound.dll', 'DirectSound'], ['xaudio2_9.dll', 'XAudio2'], ['winmm.dll', 'WinMM'], ['avrt.dll', 'WASAPI/AVRT']
  ].filter(([dll]) => importDlls.includes(dll!)).map(([, label]) => label!);

  const textHits = scanAscii(bytes, ['electron.exe', 'node.exe', 'chrome_elf.dll', 'Visual Studio Code', 'Code.exe']);
  const isElectronLike = textHits.some((x) => /electron|chrome_elf|node\.exe/i.test(x));
  const isVsCodeLike = /(^|[-_ ])(vs ?code|visual studio code|code)([-_ .]|$)/i.test(file.name) || textHits.some((x) => /visual studio code|code\.exe/i.test(x));
  const isDotNet = clrRva !== 0 || importDlls.includes('mscoree.dll');
  const blockers: string[] = [];
  const notes: string[] = [];

  if (architecture === 'arm' || architecture === 'arm64') blockers.push('Windows ARM executables are not routed to an engine yet.');
  if (importDlls.some((dll) => /win32k|ntoskrnl|wdf|fltmgr/.test(dll))) blockers.push('Kernel/driver dependency detected; browser runtimes cannot load Windows kernel drivers.');
  if (graphicsApis.includes('Direct3D 12')) notes.push('Direct3D 12 is a later milestone; prefer a D3D11 mode if the app exposes one.');
  if (isElectronLike) notes.push('Electron/Chromium workload detected; this is expensive under binary translation and may have an optimized web adapter.');
  if (file.size > 512 * 1024 * 1024) notes.push('Large executable: WinWeb intentionally inspected only a bounded prefix to protect mobile memory.');

  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    fileSize: file.size,
    peKind,
    architecture,
    subsystem,
    numberOfSections,
    entryPoint,
    imageBase,
    imports,
    importDlls,
    sections,
    isDotNet,
    isElectronLike,
    isVsCodeLike,
    graphicsApis,
    audioApis,
    installer: classifyInstaller(file.name, bytes),
    blockers,
    notes,
    analyzedAt: new Date().toISOString()
  };
}
