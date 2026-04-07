export function preserveOverframeLineBreaks(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const withStandaloneYouTubeLinks = normalized
    .split("\n")
    .flatMap((line, index, lines) => {
      if (!isStandaloneYouTubeLinkLine(line)) {
        return [line]
      }

      const output: string[] = []
      if (index > 0 && lines[index - 1]?.trim()) {
        output.push("")
      }

      output.push(line)

      if (index < lines.length - 1 && lines[index + 1]?.trim()) {
        output.push("")
      }

      return output
    })
    .join("\n")

  return withStandaloneYouTubeLinks.replace(/([^\n])\n(?!\n)/g, "$1  \n")
}

function isStandaloneYouTubeLinkLine(line: string) {
  const trimmed = line.trim()

  return (
    /^(?:<)?https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+(?:>)?$/i.test(
      trimmed,
    ) ||
    /^\[[^\]]+\]\(\s*https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^)]+\s*\)$/i.test(
      trimmed,
    )
  )
}
