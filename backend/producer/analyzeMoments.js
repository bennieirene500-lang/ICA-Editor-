import OpenAI from 'openai';

const MODEL = 'gpt-5.4-mini';

const SYSTEM_PROMPT = `You are the ICA Producer. You follow the ICA Producer Constitution:

1. Members communicate. ICA produces.
2. Knowledge comes before effects.
3. Edit for meaning, not maximum speed.
4. Movement communicates meaning and never decorates.
5. Every visual must earn its place.
6. Automation is the default; correction is the exception.
7. Professional beats flashy.
8. The member makes outcome decisions. ICA makes production decisions.
9. Protect smoothness first; improve production second.
10. If the viewer remembers the animation but misses the message, the animation failed.

You read a word-timestamped transcript of a short talking-head recording and decide
which moments, if any, deserve a visual cutaway: the speaker briefly leaves the frame,
a full-screen visual supports what they are saying, then the speaker returns.

Be deliberate, not sparse. A good recording usually earns two to four visual
moments, spread through the video, not clustered at the end. Pay special attention
to the opening: if the first 15 seconds contain a real hook, claim, promise or
number, that is one of the best places for a visual — viewers decide whether to
keep watching in the first few seconds, so do not leave the opening empty if there
is genuinely something there to anchor on. Only skip a moment entirely if nothing
in the recording would actually benefit from a visual.

For every selected moment you must also choose which PRODUCTION TIER it deserves:

- "template": a fast animated on-brand graphic card — a concept card, a number/stat,
  a short process (2-3 real steps), a before/after comparison, or a quote. Use this
  for ideas, numbers, processes and quotes that are not tied to a real-world image.
- "stock" (prefer this whenever it plausibly fits — it is fast and it is real
  footage, which reads as more alive than a graphic card): a real filmed photo or
  video clip. Use it not only for a literally described scene, but also whenever a
  real-world image would support the mood or topic better than a graphic would
  (e.g. a point about growth could use a real rising/climbing shot, not just a
  growth graphic; a point about focus could use a real quiet workspace shot).
  Provide a short stock-footage search query (2-4 plain words, like a real person
  would type into a stock footage search box).
- "generated": a single genuinely special moment that neither a template card nor
  real stock footage could represent — this is the one moment in the video worth
  spending real production time on. Use at most once per video. If nothing in the
  video is that unique, do not use this tier at all; template and stock are not
  lesser choices.

For "template" moments, also provide a short stockQuery (2-4 plain words) describing
a simple, real-world photo that would work well as a dimmed, blurred backdrop behind
the card's text — matched to the topic's mood, not necessarily a literal scene (e.g.
for a card about growth: "sunrise mountain view"; for a card about focus: "empty
quiet workspace"). Keep it simple and generic enough that a stock photo search will
find something calm and on-topic, not busy or distracting.

Return only moments that are clearly and directly supported by what is actually said
at that timestamp. Do not invent a process, comparison or statistic that was not
really said. Never invent steps that were not actually listed.`;

const RESPONSE_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'producer_moments',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        moments: {
          type: 'array',
          maxItems: 5,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              start: { type: 'number' },
              end: { type: 'number' },
              tier: { type: 'string', enum: ['template', 'stock', 'generated'] },
              cardType: { type: 'string', enum: ['concept', 'stat', 'process', 'comparison', 'quote'] },
              label: { type: 'string' },
              title: { type: 'string' },
              number: { type: 'string' },
              steps: { type: 'array', maxItems: 3, items: { type: 'string' } },
              comparisonLeft: { type: 'string' },
              comparisonRight: { type: 'string' },
              stockQuery: { type: 'string' },
              imagePrompt: { type: 'string' },
              reason: { type: 'string' },
              sourceText: { type: 'string' }
            },
            required: [
              'start', 'end', 'tier', 'cardType', 'label', 'title', 'number', 'steps',
              'comparisonLeft', 'comparisonRight', 'stockQuery', 'imagePrompt', 'reason', 'sourceText'
            ]
          }
        }
      },
      required: ['moments']
    }
  }
};

export async function analyzeMoments({ apiKey, words, goal, duration }) {
  const openai = new OpenAI({ apiKey });

  const transcriptWithTimestamps = words
    .map(word => `[${word.start.toFixed(2)}] ${word.word}`)
    .join(' ');

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: RESPONSE_SCHEMA,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Communication goal: ${goal}\nVideo duration: ${duration.toFixed(1)} seconds\n\nWord-timestamped transcript:\n${transcriptWithTimestamps}`
      }
    ]
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  return sanitizeMoments(parsed.moments, duration);
}

function sanitizeMoments(moments, duration) {
  if (!Array.isArray(moments)) return [];

  return moments
    .map(moment => ({
      start: clamp(Number(moment.start) || 0, 0, duration),
      end: clamp(Number(moment.end) || 0, 0, duration),
      tier: ['template', 'stock', 'generated'].includes(moment.tier) ? moment.tier : 'template',
      cardType: ['concept', 'stat', 'process', 'comparison', 'quote'].includes(moment.cardType) ? moment.cardType : 'concept',
      label: String(moment.label || '').trim().slice(0, 40),
      title: String(moment.title || '').trim().slice(0, 90),
      number: String(moment.number || '').trim().slice(0, 12),
      steps: Array.isArray(moment.steps) ? moment.steps.map(step => String(step || '').trim()).filter(Boolean).slice(0, 3) : [],
      comparisonLeft: String(moment.comparisonLeft || '').trim().slice(0, 34),
      comparisonRight: String(moment.comparisonRight || '').trim().slice(0, 34),
      stockQuery: String(moment.stockQuery || '').trim().slice(0, 60),
      imagePrompt: String(moment.imagePrompt || '').trim(),
      reason: String(moment.reason || '').trim(),
      sourceText: String(moment.sourceText || '').trim()
    }))
    .filter(moment => moment.title && moment.end - moment.start >= 0.5)
    .filter(moment => moment.tier !== 'stock' || moment.stockQuery)
    .filter(moment => moment.tier !== 'generated' || moment.imagePrompt)
    .sort((a, b) => a.start - b.start);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
