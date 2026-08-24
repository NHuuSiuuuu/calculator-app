export function chunkText(text, options = {}) {
  const maxChars = options.maxChars ?? 1200;
  const overlapChars = options.overlapChars ?? 180;
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  const chunks = [];
  let start = 0;

  while (start < normalized.length) {
    const hardEnd = Math.min(start + maxChars, normalized.length);
    const slice = normalized.slice(start, hardEnd);
    const breakAt = hardEnd < normalized.length
      ? Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "), slice.lastIndexOf("\n"))
      : -1;
    const end = breakAt > Math.floor(maxChars * 0.55) ? start + breakAt + 1 : hardEnd;
    const content = normalized.slice(start, end).trim();

    if (content) {
      chunks.push({
        content,
        tokenEstimate: Math.max(1, Math.ceil(content.length / 4)),
      });
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(0, end - overlapChars);
  }

  return chunks;
}
