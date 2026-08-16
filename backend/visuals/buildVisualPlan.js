import { resolveMotionProfile } from './motionLibrary.js';

const MINIMUM_SPACING_SECONDS = 4.2;
const MINIMUM_CUTAWAY_SECONDS = 1.8;
const MAXIMUM_CUTAWAY_SECONDS = 4;
const EDGE_MARGIN_SECONDS = 0.6;

export function buildVisualPlan({
  moments,
  duration,
  goal = 'educational'
}) {
  const maxVisuals = chooseMaximumVisuals(duration);

  const candidates = [...moments].sort((a, b) => a.start - b.start);
  const selected = [];

  for (const candidate of candidates) {
    if (selected.length >= maxVisuals) break;

    const start = clamp(candidate.start, EDGE_MARGIN_SECONDS, Math.max(EDGE_MARGIN_SECONDS, duration - EDGE_MARGIN_SECONDS));
    const requestedDuration = clamp(candidate.end - candidate.start, MINIMUM_CUTAWAY_SECONDS, MAXIMUM_CUTAWAY_SECONDS);
    const end = Math.min(duration - EDGE_MARGIN_SECONDS, start + requestedDuration);

    if (end - start < MINIMUM_CUTAWAY_SECONDS) continue;
    if (isTooClose(selected, start, end)) continue;

    const confidence = 0.75;

    selected.push({
      ...candidate,
      id: `visual-${selected.length + 1}`,
      start: round(start),
      end: round(end),
      confidence,
      renderer: 'cutaway',
      kind: candidate.tier === 'template'
        ? 'color'
        : candidate.mediaType === 'video'
          ? 'video'
          : 'image',
      motion: candidate.tier === 'template'
        ? resolveMotionProfile({
            renderer: candidate.cardType,
            seed: hash(`${candidate.cardType}:${candidate.title}:${start}`),
            confidence,
            goal
          })
        : null
    });
  }

  return selected.sort((a, b) => a.start - b.start);
}

function chooseMaximumVisuals(duration) {
  if (duration < 20) return 1;
  if (duration < 45) return 2;
  if (duration < 90) return 3;
  if (duration < 150) return 4;
  return 5;
}

function isTooClose(selected, start, end) {
  return selected.some(item => (
    start < item.end + MINIMUM_SPACING_SECONDS &&
    end > item.start - MINIMUM_SPACING_SECONDS
  ));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value || 0)));
}

function round(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function hash(value) {
  let result = 0;
  for (const character of String(value || '')) {
    result = ((result << 5) - result + character.charCodeAt(0)) | 0;
  }
  return result;
}
