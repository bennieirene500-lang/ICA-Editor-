export function applyCaptionEmphasis(captionGroups, emphasisWords) {
  const tokens = new Set(
    (emphasisWords || [])
      .flatMap(phrase => String(phrase || '').split(/\s+/))
      .map(normalize)
      .filter(Boolean)
  );

  if (!tokens.size) return captionGroups;

  return captionGroups.map(group => ({
    ...group,
    words: group.words.map(word => (
      tokens.has(normalize(word.word)) ? { ...word, emphasis: true } : word
    ))
  }));
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9%]/g, '');
}
