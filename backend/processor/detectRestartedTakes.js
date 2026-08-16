export function detectRestartedTakeSpans(analyses, { maxGapSeconds = 3, similarityThreshold = 0.6 } = {}) {
  const spans = [];

  for (let index = 0; index < analyses.length - 1; index += 1) {
    const current = analyses[index];
    const next = analyses[index + 1];

    if (next.start - current.end > maxGapSeconds) continue;

    if (wordOverlap(current.text, next.text) >= similarityThreshold) {
      spans.push({ start: current.start, end: current.end });
    }
  }

  return spans;
}

function wordOverlap(a, b) {
  const wordsA = new Set(normalize(a));
  const wordsB = new Set(normalize(b));
  if (!wordsA.size || !wordsB.size) return 0;

  let shared = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) shared += 1;
  }

  return shared / Math.max(wordsA.size, wordsB.size);
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}
