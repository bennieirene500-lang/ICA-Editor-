const FILLER_WORDS = new Set([
  'um', 'umm', 'ummm', 'uh', 'uhh', 'uhm', 'er', 'erm', 'hm', 'hmm'
]);

export function detectFillerSpans(words, { padding = 0.05 } = {}) {
  const spans = [];

  for (const word of words) {
    const clean = String(word.word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!FILLER_WORDS.has(clean)) continue;

    spans.push({
      start: Math.max(0, Number(word.start) - padding),
      end: Number(word.end) + padding
    });
  }

  return spans;
}
