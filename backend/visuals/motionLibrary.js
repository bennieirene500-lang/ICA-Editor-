const MOTION_PROFILES = Object.freeze({
  lift: {
    name: 'soft-lift',
    entry: 'up',
    distance: 46,
    entryMs: 280,
    settleScale: 96,
    exitMs: 180
  },
  slideLeft: {
    name: 'slide-from-left',
    entry: 'left',
    distance: 62,
    entryMs: 300,
    settleScale: 98,
    exitMs: 180
  },
  slideRight: {
    name: 'slide-from-right',
    entry: 'right',
    distance: 62,
    entryMs: 300,
    settleScale: 98,
    exitMs: 180
  },
  settle: {
    name: 'scale-settle',
    entry: 'none',
    distance: 0,
    entryMs: 260,
    settleScale: 90,
    exitMs: 180
  },
  draw: {
    name: 'draw-and-rise',
    entry: 'up',
    distance: 34,
    entryMs: 320,
    settleScale: 96,
    exitMs: 180
  },
  stagger: {
    name: 'staggered-reveal',
    entry: 'left',
    distance: 44,
    entryMs: 260,
    settleScale: 98,
    exitMs: 180
  },
  focus: {
    name: 'quiet-focus',
    entry: 'none',
    distance: 0,
    entryMs: 240,
    settleScale: 97,
    exitMs: 200
  }
});

const RENDERER_MOTIONS = Object.freeze({
  card: ['lift', 'slideLeft', 'focus'],
  quote: ['focus', 'lift'],
  stat: ['settle', 'lift'],
  graph: ['draw', 'lift'],
  comparison: ['slideLeft', 'slideRight'],
  process: ['stagger', 'lift'],
  cta: ['settle', 'lift']
});

export function resolveMotionProfile({
  renderer,
  seed = 0,
  confidence = 0.7,
  goal = 'educational'
}) {
  const names = RENDERER_MOTIONS[renderer] || ['lift'];
  let name = names[Math.abs(seed) % names.length];

  if (confidence < 0.63) name = 'focus';
  if (goal === 'story' && renderer !== 'comparison') name = 'focus';
  if (goal === 'motivation' && renderer === 'card') name = 'lift';

  return structuredClone(MOTION_PROFILES[name] || MOTION_PROFILES.lift);
}

export function buildSoundCues(visuals = []) {
  const candidates = visuals
    .filter(visual => Number(visual.confidence || 0) >= 0.68)
    .map(visual => ({
      start: Number(visual.start || 0),
      type: soundForRenderer(visual.renderer),
      visualId: visual.id,
      renderer: visual.renderer
    }))
    .filter(cue => cue.type !== 'none')
    .sort((a, b) => a.start - b.start);

  const selected = [];
  for (const cue of candidates) {
    if (selected.length >= 3) break;
    if (selected.some(item => Math.abs(item.start - cue.start) < 8.5)) continue;
    selected.push(cue);
  }

  return selected;
}

export function listMotionProfiles() {
  return Object.values(MOTION_PROFILES).map(profile => ({ ...profile }));
}

function soundForRenderer(renderer) {
  return {
    stat: 'soft-tick',
    graph: 'soft-whoosh',
    process: 'soft-whoosh',
    cta: 'soft-rise'
  }[renderer] || 'none';
}
