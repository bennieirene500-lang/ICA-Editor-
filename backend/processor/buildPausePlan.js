export function buildPausePlan({
  silenceRanges,
  videoDuration,
  preserveSeconds = 0.28,
  minimumRemovalSeconds = 0.42,
  maximumSingleRemovalSeconds = 2.5
}) {
  const removals = [];

  for (const range of silenceRanges) {
    const removableStart = range.start + preserveSeconds;
    const removableEnd = range.end - preserveSeconds;
    const removableDuration = removableEnd - removableStart;

    if (removableDuration < minimumRemovalSeconds) continue;

    const cappedEnd = Math.min(
      removableEnd,
      removableStart + maximumSingleRemovalSeconds
    );

    removals.push({
      start: round(removableStart),
      end: round(cappedEnd),
      duration: round(cappedEnd - removableStart)
    });
  }

  const keepSegments = invertRanges(removals, videoDuration);

  return {
    removals,
    keepSegments,
    totalRemovedSeconds: round(
      removals.reduce((sum, item) => sum + item.duration, 0)
    )
  };
}

function invertRanges(removals, duration) {
  const keep = [];
  let cursor = 0;

  for (const removal of removals) {
    if (removal.start > cursor) {
      keep.push({
        start: round(cursor),
        end: round(removal.start)
      });
    }

    cursor = Math.max(cursor, removal.end);
  }

  if (cursor < duration) {
    keep.push({
      start: round(cursor),
      end: round(duration)
    });
  }

  return keep.filter(segment => segment.end - segment.start >= 0.05);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
