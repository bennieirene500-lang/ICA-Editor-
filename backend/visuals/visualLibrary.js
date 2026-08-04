const TEMPLATE_ALIASES = Object.freeze({
  'concept-card': 'card',
  'key-point-card': 'card',
  'benefit-card': 'card',
  'chapter-card': 'card',
  'turning-point-card': 'card',
  'location-card': 'card',
  'challenge-card': 'card',
  'final-message-card': 'card',
  'call-to-action-card': 'cta',
  'quote-card': 'quote',
  'proof-stat': 'stat',
  'number-counter': 'stat',
  'progress-counter': 'stat',
  'growth-graph': 'graph',
  'momentum-graph': 'graph',
  'comparison-card': 'comparison',
  'before-after': 'comparison',
  'three-step-diagram': 'process',
  'timeline': 'process',
  'checklist': 'process'
});

const LIBRARY = Object.freeze({
  card: {
    family: 'message-card',
    duration: 3.05,
    variants: ['accent-left', 'accent-top', 'centered', 'floating-label']
  },
  quote: {
    family: 'quote-card',
    duration: 3.25,
    variants: ['statement', 'memory', 'emphasis']
  },
  stat: {
    family: 'number-card',
    duration: 3.2,
    variants: ['number-first', 'proof', 'counter']
  },
  graph: {
    family: 'growth-visual',
    duration: 3.45,
    variants: ['bars', 'momentum', 'progress']
  },
  comparison: {
    family: 'comparison-card',
    duration: 3.35,
    variants: ['before-after', 'choice', 'shift']
  },
  process: {
    family: 'process-card',
    duration: 3.65,
    variants: ['steps', 'timeline', 'checklist']
  },
  cta: {
    family: 'action-card',
    duration: 3.2,
    variants: ['next-step', 'invitation', 'decision']
  }
});

export function resolveVisualTemplate(type, seed = 0) {
  const requested = String(type || 'concept-card').trim().toLowerCase();
  const key = TEMPLATE_ALIASES[requested] || 'card';
  const template = LIBRARY[key];
  const variant = template.variants[Math.abs(seed) % template.variants.length];

  return {
    requestedType: requested,
    renderer: key,
    family: template.family,
    duration: template.duration,
    variant
  };
}

export function listVisualLibrary() {
  return Object.entries(LIBRARY).map(([renderer, template]) => ({
    renderer,
    family: template.family,
    variants: [...template.variants]
  }));
}

export function isSupportedVisualType(type) {
  return Boolean(TEMPLATE_ALIASES[String(type || '').trim().toLowerCase()]);
}
