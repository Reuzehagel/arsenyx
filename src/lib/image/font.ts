import { readFile } from "node:fs/promises";
import { join } from "node:path";

let fontCache: Array<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }> | null = null;

async function loadFontFile(filename: string): Promise<ArrayBuffer> {
  const fontPath = join(
    process.cwd(),
    "node_modules/geist/dist/fonts/geist-sans",
    filename
  );
  const buffer = await readFile(fontPath);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
}

export async function loadFonts() {
  if (fontCache) return fontCache;

  const [regular, bold] = await Promise.all([
    loadFontFile("Geist-Regular.ttf"),
    loadFontFile("Geist-Bold.ttf"),
  ]);

  fontCache = [
    { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: bold, weight: 700 as const, style: "normal" as const },
  ];
  return fontCache;
}
