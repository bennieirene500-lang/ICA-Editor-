import { resolveVisualTemplate } from './visualLibrary.js';
import { resolveMotionProfile } from './motionLibrary.js';

const GOAL_LABELS = Object.freeze({
  educational: {
    opening: 'KEY IDEA',
    closing: 'REMEMBER THIS'
  },
  sales: {
    opening: 'WHY IT MATTERS',
    closing: 'NEXT STEP'
  },
  story: {
    opening: 'THE STORY',
    closing: 'THE TAKEAWAY'
  },
  motivation: {
    opening: 'THE CHALLENGE',
    closing: 'TAKE THIS WITH YOU'
  }
});

const TYPE_LABELS = Object.freeze({
  'concept-card': 'KEY IDEA',
  'key-point-card': 'KEY POINT',
  'benefit-card': 'WHY IT MATTERS',
  'chapter-card': 'THE STORY',
  'turning-point-card': 'TURNING POINT',
  'location-card': 'CONTEXT',
  'challenge-card': 'THE CHALLENGE',
  'final-message-card': 'TAKE THIS WITH YOU',
  'call-to-action-card': 'NEXT STEP',
  'quote-card': 'REMEMBER THIS',
  'proof-stat': 'PROOF',
  'number-counter': 'THE NUMBER',
  'progress-counter': 'PROGRESS',
  'growth-graph': 'GROWTH',
  'momentum-graph': 'MOMENTUM',
  'comparison-card': 'THE DIFFERENCE',
  'before-after': 'THE SHIFT',
  'three-step-diagram': 'THE PROCESS',
  timeline: 'THE SEQUENCE',
  checklist: 'CHECKLIST'
});

export function buildVisualPlan({
  producerDecision,
  meaningAnalysis,
  transcript,
  duration,
  cameraDecisions = []
}) {
  const goal = producerDecision.goal;
  const analyses = Array.isArray(meaningAnalysis) ? meaningAnalysis : [];
  const opportunities = Array.isArray(
    producerDecision.visuals?.opportunities
  ) ? producerDecision.visuals.opportunities : [];

  const maxVisuals = chooseMaximumVisuals({
    duration,
    supportLevel: producerDecision.visuals?.supportLevel
  });

  const minimumVisuals = Math.min(
    maxVisuals,
    Math.max(1, Number(
      producerDecision.visuals?.minimumOpportunities || 2
    ))
  );

  const candidates = opportunities.map((opportunity, index) => ({
    ...opportunity,
    analysis: nearestAnalysis(analyses, opportunity.start),
    priority: 100 - index
  }));

  const rankedAnalyses = [...analyses]
    .filter(item => item.end - item.start >= 0.8)
    .sort((a, b) => b.score - a.score || a.start - b.start);

  for (const [index, analysis] of rankedAnalyses.entries()) {
    candidates.push({
      start: analysis.start,
      end: analysis.end,
      type: fallbackType(goal, index, analysis.text),
      reason: 'A meaningful statement benefits from visual reinforcement.',
      sourceText: analysis.text,
      confidence: Math.min(0.9, 0.54 + (analysis.score * 0.055)),
      analysis,
      priority: analysis.score * 10
    });
  }

  if (analyses.length) {
    const opening = analyses[0];
    candidates.push({
      start: Math.max(0.8, opening.start + 0.15),
      end: opening.end,
      type: openingType(goal),
      reason: 'The opening promise deserves an immediate visual anchor.',
      sourceText: opening.text,
      confidence: 0.82,
      analysis: opening,
      priority: 115
    });

    const closing = [...analyses]
      .reverse()
      .find(item => item.score >= 2) || analyses.at(-1);

    if (duration >= 22 && closing) {
      candidates.push({
        start: Math.max(1, Math.min(closing.start, duration - 4.1)),
        end: Math.min(duration - 0.4, closing.end),
        type: closingType(goal),
        reason: 'The final message should land clearly and memorably.',
        sourceText: closing.text,
        confidence: 0.78,
        analysis: closing,
        priority: 105
      });
    }
  }

  const selected = [];
  const sorted = candidates
    .filter(candidate => Number.isFinite(candidate.start))
    .sort((a, b) => b.priority - a.priority || a.start - b.start);

  for (const candidate of sorted) {
    if (selected.length >= maxVisuals) break;

    const start = clamp(candidate.start, 0.75, Math.max(0.75, duration - 1.2));

    if (isTooClose(selected, start, 5.6)) continue;
    if (collidesWithCamera(cameraDecisions, start, 1.15)) continue;

    const template = resolveVisualTemplate(
      candidate.type,
      hash(`${candidate.type}:${candidate.sourceText}:${start}`)
    );

    const visualDuration = Math.min(
      template.duration,
      Math.max(1.9, duration - start - 0.35)
    );

    const content = buildContent({
      type: candidate.type,
      sourceText: candidate.sourceText || candidate.analysis?.text || transcript,
      goal,
      label: TYPE_LABELS[candidate.type] || GOAL_LABELS[goal]?.opening || 'KEY IDEA'
    });

    selected.push({
      id: `visual-${selected.length + 1}`,
      start: round(start),
      end: round(Math.min(duration - 0.25, start + visualDuration)),
      type: candidate.type,
      renderer: template.renderer,
      family: template.family,
      variant: template.variant,
      label: content.label,
      title: content.title,
      number: content.number,
      left: content.left,
      right: content.right,
      steps: content.steps,
      reason: candidate.reason,
      confidence: round(candidate.confidence || 0.62),
      motion: resolveMotionProfile({
        renderer: template.renderer,
        seed: hash(`${candidate.type}:${candidate.sourceText}:${start}:motion`),
        confidence: candidate.confidence || 0.62,
        goal
      })
    });
  }

  if (selected.length < minimumVisuals) {
    for (const analysis of rankedAnalyses) {
      if (selected.length >= minimumVisuals) break;

      let start = clamp(
        analysis.start + 0.2,
        0.8,
        Math.max(0.8, duration - 1.5)
      );

      start = findOpenMoment({
        start,
        selected,
        cameraDecisions,
        duration
      });

      if (start === null) continue;

      const type = fallbackType(goal, selected.length, analysis.text);
      const template = resolveVisualTemplate(
        type,
        hash(`${type}:${analysis.text}:${start}`)
      );
      const content = buildContent({
        type,
        sourceText: analysis.text,
        goal,
        label: TYPE_LABELS[type] || 'KEY IDEA'
      });

      selected.push({
        id: `visual-${selected.length + 1}`,
        start: round(start),
        end: round(Math.min(duration - 0.25, start + template.duration)),
        type,
        renderer: template.renderer,
        family: template.family,
        variant: template.variant,
        label: content.label,
        title: content.title,
        number: content.number,
        left: content.left,
        right: content.right,
        steps: content.steps,
        reason: 'A strong point benefits from a visual reset.',
        confidence: 0.61,
        motion: resolveMotionProfile({
          renderer: template.renderer,
          seed: hash(`${type}:${analysis.text}:${start}:motion`),
          confidence: 0.61,
          goal
        })
      });
    }
  }

  return selected
    .filter(item => item.end - item.start >= 1.7)
    .sort((a, b) => a.start - b.start)
    .map((item, index) => ({
      ...item,
      id: `visual-${index + 1}`
    }));
}

function chooseMaximumVisuals({ duration, supportLevel }) {
  const base = duration < 24 ? 2 : duration < 45 ? 3 : duration < 75 ? 4 : 5;
  if (supportLevel === 'medium') return Math.max(2, base - 1);
  if (supportLevel === 'low') return Math.max(1, base - 2);
  return base;
}

function openingType(goal) {
  return {
    educational: 'concept-card',
    sales: 'benefit-card',
    story: 'chapter-card',
    motivation: 'challenge-card'
  }[goal] || 'concept-card';
}

function closingType(goal) {
  return {
    educational: 'quote-card',
    sales: 'call-to-action-card',
    story: 'quote-card',
    motivation: 'final-message-card'
  }[goal] || 'quote-card';
}

function fallbackType(goal, index, text = '') {
  if (extractNumber(text)) {
    return goal === 'sales' ? 'proof-stat' : 'number-counter';
  }

  if (/\b(before|after|instead|versus|vs\.?|difference)\b/i.test(text)) {
    return goal === 'sales' ? 'before-after' : 'comparison-card';
  }

  const types = {
    educational: ['concept-card', 'three-step-diagram', 'timeline', 'comparison-card'],
    sales: ['benefit-card', 'proof-stat', 'before-after', 'call-to-action-card'],
    story: ['chapter-card', 'turning-point-card', 'quote-card'],
    motivation: ['challenge-card', 'momentum-graph', 'quote-card', 'final-message-card']
  }[goal] || ['concept-card', 'quote-card'];

  return types[index % types.length];
}

function buildContent({ type, sourceText, goal, label }) {
  const clean = cleanText(sourceText);
  const number = extractNumber(clean);
  const comparison = splitComparison(clean);
  const steps = splitSteps(clean);

  return {
    label,
    title: shorten(clean, type === 'quote-card' ? 72 : 58),
    number: number || (type.includes('counter') ? '1' : ''),
    left: shorten(comparison.left || clean, 34),
    right: shorten(comparison.right || GOAL_LABELS[goal]?.closing || 'THE RESULT', 34),
    steps
  };
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^(um+|uh+|so|and|but|okay|right|well)\b[,. ]*/i, '')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}

function shorten(value, maximum) {
  const clean = cleanText(value);
  if (clean.length <= maximum) return clean;

  const words = clean.split(' ');
  let result = '';

  for (const word of words) {
    const next = result ? `${result} ${word}` : word;
    if (next.length > maximum - 1) break;
    result = next;
  }

  return `${result.replace(/[,:;.!?]+$/, '')}…`;
}

function extractNumber(text) {
  const match = String(text || '').match(
    /(?:R|\$|£|€)?\s?\d+(?:[.,]\d+)?\s?(?:%|k|m|million|billion)?/i
  );
  return match ? match[0].replace(/\s+/g, '') : '';
}

function splitComparison(text) {
  const parts = String(text || '').split(
    /\b(?:but|instead|versus|vs\.?|compared with|compared to)\b/i
  );

  if (parts.length >= 2) {
    return {
      left: cleanText(parts[0]),
      right: cleanText(parts.slice(1).join(' '))
    };
  }

  const beforeAfter = String(text || '').match(
    /\bbefore\b(.+?)\bafter\b(.+)/i
  );

  if (beforeAfter) {
    return {
      left: cleanText(beforeAfter[1]),
      right: cleanText(beforeAfter[2])
    };
  }

  const words = cleanText(text).split(' ');
  const midpoint = Math.max(1, Math.ceil(words.length / 2));
  return {
    left: words.slice(0, midpoint).join(' '),
    right: words.slice(midpoint).join(' ')
  };
}

function splitSteps(text) {
  const clean = cleanText(text);
  const explicit = clean
    .split(/\b(?:first|second|third|then|next|finally)\b[,:-]?/i)
    .map(item => cleanText(item))
    .filter(Boolean);

  if (explicit.length >= 3) {
    return explicit.slice(0, 3).map(item => shorten(item, 26));
  }

  const clauses = clean
    .split(/[.;]|,\s+(?=[a-z])/i)
    .map(item => cleanText(item))
    .filter(Boolean);

  if (clauses.length >= 3) {
    return clauses.slice(0, 3).map(item => shorten(item, 26));
  }

  const words = clean.split(' ').filter(Boolean);
  const size = Math.max(1, Math.ceil(words.length / 3));
  const chunks = [
    words.slice(0, size),
    words.slice(size, size * 2),
    words.slice(size * 2)
  ].map(chunk => chunk.join(' ')).filter(Boolean);

  while (chunks.length < 3) {
    chunks.push(['Understand', 'Apply', 'Continue'][chunks.length]);
  }

  return chunks.slice(0, 3).map(item => shorten(item, 26));
}

function nearestAnalysis(analyses, start) {
  return analyses.reduce((nearest, item) => {
    if (!nearest) return item;
    return Math.abs(item.start - start) < Math.abs(nearest.start - start)
      ? item
      : nearest;
  }, null);
}

function isTooClose(selected, start, spacing) {
  return selected.some(item => Math.abs(item.start - start) < spacing);
}

function collidesWithCamera(decisions, start, margin) {
  return decisions.some(decision => (
    start >= decision.start - margin &&
    start <= decision.end + margin
  ));
}

function findOpenMoment({ start, selected, cameraDecisions, duration }) {
  const shifts = [0, 2.2, -2.2, 4.4, -4.4];

  for (const shift of shifts) {
    const candidate = clamp(start + shift, 0.8, duration - 2.2);
    if (isTooClose(selected, candidate, 5.2)) continue;
    if (collidesWithCamera(cameraDecisions, candidate, 0.9)) continue;
    return candidate;
  }

  return null;
}

function hash(value) {
  let result = 0;
  for (const character of String(value || '')) {
    result = ((result << 5) - result + character.charCodeAt(0)) | 0;
  }
  return result;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value || 0)));
}

function round(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}
