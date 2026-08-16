const PLAY_RES_X = 1080;
const PLAY_RES_Y = 1920;
const WHITE = '&H00FFFFFF&';
const MUTED = '&H00D6DEE8&';
const DEFAULT_ACCENT_ASS = '&H00205DFF&';

const PANEL = { x: 90, y: 560, width: 900, height: 800 };

function accent(card) {
  return card.palette?.accentAss || DEFAULT_ACCENT_ASS;
}

function accentSoft(card) {
  return card.palette?.accentSoftAss || '&H006C8FFF&';
}

export function createProductionAss({ captions = [], cards = [] }) {
  const cardEvents = cards.flatMap(renderCard);
  const captionAccent = cards.find(card => card.palette)?.palette.accentAss || DEFAULT_ACCENT_ASS;
  const captionEvents = captions.map(group => renderCaption(group, captionAccent));

  return `${header(captionAccent)}${[...cardEvents, ...captionEvents].join('\n')}\n`;
}

function header(captionAccent) {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${PLAY_RES_X}
PlayResY: ${PLAY_RES_Y}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial,70,&H00FFFFFF,${captionAccent},&H00111111,&H70000000,-1,0,0,0,100,100,0,0,1,5,1,2,90,90,360,1
Style: CardLabel,Arial,32,&H00FFFFFF,&H00FFFFFF,&H00111111,&H00000000,-1,0,0,0,100,100,2,0,1,1,0,7,0,0,0,1
Style: CardTitle,Arial,68,&H00FFFFFF,&H00FFFFFF,&H00111111,&H00000000,-1,0,0,0,100,100,0,0,1,2,1,7,0,0,0,1
Style: CardBody,Arial,42,&H00D6DEE8,&H00FFFFFF,&H00111111,&H00000000,0,0,0,0,100,100,0,0,1,1,0,7,0,0,0,1
Style: CardNumber,Arial,150,&H00FFFFFF,&H00FFFFFF,&H00111111,&H00000000,-1,0,0,0,100,100,0,0,1,2,1,8,0,0,0,1
Style: Drawing,Arial,20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

function renderCard(card) {
  const renderer = {
    concept: renderConcept,
    quote: renderQuote,
    stat: renderStat,
    comparison: renderComparison,
    process: renderProcess
  }[card.cardType] || renderConcept;

  return renderer(card);
}

function renderConcept(card) {
  return [
    growRect({ card, x: PANEL.x, y: PANEL.y, width: 14, height: PANEL.height, color: accent(card), layer: 1, axis: 'y' }),
    textEvent({ card, style: 'CardLabel', layer: 2, x: PANEL.x + 52, y: PANEL.y + 70, align: 7, color: accentSoft(card), text: card.label, delay: 0.1 }),
    textEvent({ card, style: 'CardTitle', layer: 2, x: PANEL.x + 52, y: PANEL.y + 160, align: 7, maxChars: 15, color: WHITE, text: card.title, delay: 0.22 })
  ];
}

function renderQuote(card) {
  return [
    growRect({ card, x: PANEL.x, y: PANEL.y, width: 16, height: PANEL.height, color: accent(card), layer: 1, axis: 'y' }),
    textEvent({ card, style: 'CardLabel', layer: 2, x: PANEL.x + 55, y: PANEL.y + 90, align: 7, color: accentSoft(card), text: card.label, delay: 0.1 }),
    textEvent({ card, style: 'CardTitle', layer: 2, x: PANEL.x + 55, y: PANEL.y + 200, align: 7, maxChars: 15, color: WHITE, text: `“${card.title}”`, delay: 0.22 })
  ];
}

function renderStat(card) {
  const centerX = PANEL.x + PANEL.width / 2;
  const centerY = PANEL.y + 260;

  return [
    wipeRect({ card, x: PANEL.x, y: PANEL.y, width: PANEL.width, height: 12, color: accent(card), layer: 1 }),
    textEvent({ card, style: 'CardLabel', layer: 2, x: centerX, y: PANEL.y + 90, align: 8, color: accentSoft(card), text: card.label, delay: 0.1 }),
    ...countEvents({ card, number: card.number || '1', x: centerX, y: centerY }),
    textEvent({ card, style: 'CardBody', layer: 2, x: centerX, y: PANEL.y + 470, align: 8, maxChars: 30, color: MUTED, text: card.title, delay: 0.55 })
  ];
}

function renderComparison(card) {
  const leftCard = withMotion(card, 'left');
  const rightCard = withMotion(card, 'right');
  const centerX = PANEL.x + PANEL.width / 2;
  const columnY = PANEL.y + 220;

  return [
    textEvent({ card, style: 'CardLabel', layer: 2, x: centerX, y: PANEL.y + 90, align: 8, color: accentSoft(card), text: card.label, delay: 0.1 }),
    rect({ card: leftCard, x: PANEL.x, y: columnY, width: 410, height: 420, color: '&H00402A1C&', alpha: '20', layer: 1, delay: 0.18 }),
    rect({ card: rightCard, x: PANEL.x + 470, y: columnY, width: 430, height: 420, color: '&H00312312&', alpha: '12', layer: 1, delay: 0.26 }),
    textEvent({ card: leftCard, style: 'CardLabel', layer: 2, x: PANEL.x + 205, y: columnY + 45, align: 8, color: MUTED, text: 'BEFORE', delay: 0.3 }),
    textEvent({ card: rightCard, style: 'CardLabel', layer: 2, x: PANEL.x + 685, y: columnY + 45, align: 8, color: accentSoft(card), text: 'AFTER', delay: 0.38 }),
    textEvent({ card: leftCard, style: 'CardBody', layer: 2, x: PANEL.x + 205, y: columnY + 150, align: 8, maxChars: 16, color: WHITE, text: card.comparisonLeft, delay: 0.4 }),
    textEvent({ card: rightCard, style: 'CardBody', layer: 2, x: PANEL.x + 685, y: columnY + 150, align: 8, maxChars: 16, color: WHITE, text: card.comparisonRight, delay: 0.48 })
  ];
}

function renderProcess(card) {
  const steps = card.steps?.length ? card.steps : [];
  const events = [
    textEvent({ card, style: 'CardLabel', layer: 2, x: PANEL.x + 50, y: PANEL.y + 60, align: 7, color: accentSoft(card), text: card.label, delay: 0.1 })
  ];

  steps.slice(0, 3).forEach((step, index) => {
    const y = PANEL.y + 170 + (index * 200);
    const delay = 0.2 + (index * 0.22);
    const stepCard = withMotion(card, 'left');
    events.push(rect({ card: stepCard, x: PANEL.x + 50, y, width: 96, height: 96, color: accent(card), alpha: '00', layer: 1, delay, scaleSettle: true }));
    events.push(textEvent({ card: stepCard, style: 'CardTitle', layer: 2, x: PANEL.x + 98, y: y + 20, align: 8, color: WHITE, text: String(index + 1), delay: delay + 0.05, scaleSettle: true }));
    events.push(textEvent({ card: stepCard, style: 'CardBody', layer: 2, x: PANEL.x + 175, y: y + 20, align: 7, maxChars: 24, color: WHITE, text: step, delay: delay + 0.08 }));
  });

  return events;
}

function countEvents({ card, number, x, y }) {
  const parsed = parseNumber(number);
  if (!parsed) {
    return [textEvent({ card, style: 'CardNumber', layer: 2, x, y, align: 8, color: WHITE, text: number, delay: 0.2, scaleSettle: true })];
  }

  const steps = 7;
  const events = [];
  for (let index = 1; index <= steps; index += 1) {
    const delay = 0.18 + ((index - 1) * 0.065);
    const value = Math.round((parsed.value * index) / steps);
    const text = `${parsed.prefix}${value}${parsed.suffix}`;
    const last = index === steps;
    events.push(textEvent({
      card,
      style: 'CardNumber',
      layer: 2,
      x,
      y,
      align: 8,
      color: WHITE,
      text,
      delay,
      durationOverride: last ? Math.max(0.5, card.end - card.start - delay) : 0.075,
      scaleSettle: last
    }));
  }
  return events;
}

function parseNumber(value) {
  const match = String(value || '').match(/^([^\d-]*)(-?\d+(?:[.,]\d+)?)(.*)$/);
  if (!match) return null;
  const numeric = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(numeric) || Math.abs(numeric) > 1000000) return null;
  return { prefix: match[1], value: numeric, suffix: match[3] };
}

function renderCaption(group, captionAccent) {
  const breaks = new Set(group.lineBreakAfter || []);
  const words = group.words || [];

  let elapsedMs = 0;
  const text = words.map((item, index) => {
    const durationMs = Math.max(10, Math.round((Number(item.end) - Number(item.start)) * 1000));
    const centiseconds = Math.max(1, Math.round(durationMs / 10));
    const separator = breaks.has(index) ? '\\N' : ' ';
    const startMs = elapsedMs;
    elapsedMs += durationMs;

    if (!item.emphasis) {
      return `{\\k${centiseconds}}${escapeAss(item.word)}${separator}`;
    }

    const popMs = Math.min(160, Math.max(60, Math.round(durationMs * 0.4)));
    return (
      `{\\k${centiseconds}\\1c${captionAccent}` +
      `\\t(${startMs},${startMs + popMs},\\fscx128\\fscy128)` +
      `\\t(${startMs + popMs},${startMs + popMs + 120},\\fscx100\\fscy100)}` +
      `${escapeAss(item.word)}{\\1c${WHITE}}${separator}`
    );
  }).join('').trim();

  return dialogue({
    layer: 10,
    start: group.start,
    end: group.end,
    style: 'Caption',
    text: `{\\fscx78\\fscy78\\t(0,130,\\fscx110\\fscy110)\\t(130,230,\\fscx100\\fscy100)\\fs${group.fontSize || 70}}${text}`
  });
}

function rect({ card, x, y, width, height, color, alpha = '00', layer = 0, delay = 0, scaleSettle = false }) {
  const drawing = `m 0 0 l ${width} 0 l ${width} ${height} l 0 ${height}`;
  const timing = eventTiming(card, delay);
  const tags = motionTags({ card, x, y, scaleSettle });
  return dialogue({
    layer,
    start: timing.start,
    end: timing.end,
    style: 'Drawing',
    text: `{\\an7${tags}\\p1\\bord0\\shad0\\1c${color}\\1a&H${alpha}&}${drawing}{\\p0}`
  });
}

function wipeRect({ card, x, y, width, height, color, alpha = '00', layer = 0, delay = 0 }) {
  const drawing = `m 0 0 l ${width} 0 l ${width} ${height} l 0 ${height}`;
  const timing = eventTiming(card, delay);
  const entryMs = card.motion?.entryMs || 280;
  return dialogue({
    layer,
    start: timing.start,
    end: timing.end,
    style: 'Drawing',
    text: `{\\an7\\pos(${x},${y})\\org(${x},${y})\\fad(80,${card.motion?.exitMs || 180})\\fscx4\\t(0,${entryMs},\\fscx100)\\p1\\bord0\\shad0\\1c${color}\\1a&H${alpha}&}${drawing}{\\p0}`
  });
}

function growRect({ card, x, y, width, height, color, alpha = '00', layer = 0, axis = 'y', delay = 0 }) {
  const drawing = `m 0 0 l ${width} 0 l ${width} ${height} l 0 ${height}`;
  const timing = eventTiming(card, delay);
  const entryMs = Math.max(220, card.motion?.entryMs || 280);
  const scaleTag = axis === 'y'
    ? `\\fscy5\\t(0,${entryMs},\\fscy100)`
    : `\\fscx5\\t(0,${entryMs},\\fscx100)`;
  const originY = axis === 'y' ? y + height : y;
  return dialogue({
    layer,
    start: timing.start,
    end: timing.end,
    style: 'Drawing',
    text: `{\\an7\\pos(${x},${y})\\org(${x},${originY})\\fad(80,${card.motion?.exitMs || 180})${scaleTag}\\p1\\bord0\\shad0\\1c${color}\\1a&H${alpha}&}${drawing}{\\p0}`
  });
}

function textEvent({ card, style, layer, x, y, align, color, text, maxChars = 32, delay = 0, durationOverride = null, scaleSettle = false }) {
  const wrapped = wrapText(text, maxChars);
  const timing = eventTiming(card, delay, durationOverride);
  const tags = motionTags({ card, x, y, scaleSettle });
  return dialogue({
    layer,
    start: timing.start,
    end: timing.end,
    style,
    text: `{\\an${align}${tags}\\1c${color}}${escapeAss(wrapped).replace(/\\n/g, '\\N')}`
  });
}

function motionTags({ card, x, y, scaleSettle = false }) {
  const motion = card.motion || {};
  const direction = motion.entry || 'up';
  const distance = Number(motion.distance || 38);
  const entryMs = Number(motion.entryMs || 280);
  const exitMs = Number(motion.exitMs || 180);
  let startX = x;
  let startY = y;

  if (direction === 'up') startY += distance;
  if (direction === 'down') startY -= distance;
  if (direction === 'left') startX -= distance;
  if (direction === 'right') startX += distance;

  const position = direction === 'none'
    ? `\\pos(${x},${y})`
    : `\\move(${startX},${startY},${x},${y},0,${entryMs})`;

  const scale = scaleSettle || motion.name === 'scale-settle'
    ? `\\fscx${motion.settleScale || 92}\\fscy${motion.settleScale || 92}\\t(0,${entryMs},\\fscx100\\fscy100)`
    : '';

  return `${position}\\fad(120,${exitMs})${scale}`;
}

function withMotion(card, direction) {
  return {
    ...card,
    motion: {
      ...(card.motion || {}),
      entry: direction,
      distance: Math.max(48, card.motion?.distance || 0)
    }
  };
}

function eventTiming(card, delay = 0, durationOverride = null) {
  const start = Number(card.start || 0) + Number(delay || 0);
  const maximumEnd = Number(card.end || start + 1);
  const end = durationOverride === null
    ? maximumEnd
    : Math.min(maximumEnd, start + Number(durationOverride));
  return { start, end: Math.max(start + 0.05, end) };
}

function dialogue({ layer, start, end, style, text }) {
  return `Dialogue: ${layer},${assTime(start)},${assTime(end)},${style},,0,0,0,,${text}`;
}

function wrapText(value, maximum) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const proposed = current ? `${current} ${word}` : word;
    if (current && proposed.length > maximum && lines.length < 2) {
      lines.push(current);
      current = word;
    } else {
      current = proposed;
    }
  }

  if (current) lines.push(current);
  return lines.slice(0, 3).join('\n');
}

function assTime(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const cs = Math.floor((safe - Math.floor(safe)) * 100);

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function escapeAss(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\N');
}
