import { readFile } from "node:fs/promises"
import { join } from "node:path"

type FontEntry = {
  name: string
  data: ArrayBuffer
  weight: 400 | 700
  style: "normal"
}

async function loadFontFile(filename: string): Promise<ArrayBuffer> {
  const fontPath = join(
    process.cwd(),
    "node_modules/geist/dist/fonts/geist-sans",
    filename,
  )
  const buffer = await readFile(fontPath)
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  )
}

async function loadFontsInternal(): Promise<FontEntry[]> {
  const [regular, bold] = await Promise.all([
    loadFontFile("Geist-Regular.ttf"),
    loadFontFile("Geist-Bold.ttf"),
  ])

  return [
    {
      name: "Geist",
      data: regular,
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "Geist",
      data: bold,
      weight: 700 as const,
      style: "normal" as const,
    },
  ]
}

const fontsPromise = loadFontsInternal()

export async function loadFonts() {
  return fontsPromise
}
