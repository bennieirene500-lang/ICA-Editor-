const PLAY_RES_X = 1080;
const PLAY_RES_Y = 1920;
const ORANGE = '&H00205DFF&';
const ORANGE_SOFT = '&H006C8FFF&';
const WHITE = '&H00FFFFFF&';
const MUTED = '&H00D6DEE8&';
const NAVY = '&H0024140B&';
const NAVY_2 = '&H00301D10&';
const PANEL = '&H00351E10&';

export function createProductionAss({
  captions = [],
  visuals = [],
  includeCaptions = true
}) {
  const visualEvents = visuals.flatMap(renderVisual);
  const captionEvents = includeCaptions
    ? captions.map(renderCaption)
    : [];

  return `${header()}${[...visualEvents, ...captionEvents].join('\n')}\n`;
}

function header() {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${PLAY_RES_X}
PlayResY: ${PLAY_RES_Y}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial,70,&H00FFFFFF,&H00205DFF,&H00111111,&H70000000,-1,0,0,0,100,100,0,0,1,5,1,2,90,90,360,1
Style: VisualText,Arial,58,&H00FFFFFF,&H00FFFFFF,&H00111111,&H00000000,-1,0,0,0,100,100,0,0,1,2,1,7,0,0,0,1
Style: VisualSmall,Arial,27,&H00FFFFFF,&H00FFFFFF,&H00111111,&H00000000,-1,0,0,0,100,100,2,0,1,1,0,7,0,0,0,1
Style: VisualBody,Arial,37,&H00D6DEE8,&H00FFFFFF,&H00111111,&H00000000,0,0,0,0,100,100,0,0,1,1,0,7,0,0,0,1
Style: VisualNumber,Arial,122,&H00FFFFFF,&H00FFFFFF,&H00111111,&H00000000,-1,0,0,0,100,100,0,0,1,2,1,8,0,0,0,1
Style: Drawing,Arial,20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

function renderVisual(visual) {
  const renderer = {
    card: renderCard,
    quote: renderQuote,
    stat: renderStat,
    graph: renderGraph,
    comparison: renderComparison,
    process: renderProcess,
    cta: renderCta
  }[visual.renderer] || renderCard;

  return renderer(visual);
}

function renderCard(visual) {
  const centered = visual.variant === 'centered';
  const accentTop = visual.variant === 'accent-top';
  const events = [
    rect({ visual, x: 80, y: 165, width: 920, height: 350, color: PANEL, alpha: '24', layer: 0 })
  ];

  if (accentTop) {
    events.push(wipeRect({ visual, x: 80, y: 165, width: 920, height: 12, color: ORANGE, layer: 1 }));
  } else {
    events.push(growRect({ visual, x: 80, y: 165, width: 14, height: 350, color: ORANGE, layer: 1, axis: 'y' }));
  }

  events.push(textEvent({
    visual,
    style: 'VisualSmall',
    layer: 2,
    x: centered ? 540 : 132,
    y: 215,
    align: centered ? 8 : 7,
    fontSize: 28,
    color: ORANGE_SOFT,
    text: visual.label,
    delay: 0.08
  }));

  events.push(textEvent({
    visual,
    style: 'VisualText',
    layer: 2,
    x: centered ? 540 : 132,
    y: 280,
    align: centered ? 8 : 7,
    fontSize: 61,
    maxChars: centered ? 24 : 25,
    color: WHITE,
    text: visual.title,
    delay: 0.18
  }));

  return events;
}

function renderQuote(visual) {
  return [
    rect({ visual, x: 65, y: 150, width: 950, height: 470, color: NAVY, alpha: '18', layer: 0 }),
    growRect({ visual, x: 65, y: 150, width: 16, height: 470, color: ORANGE, layer: 1, axis: 'y' }),
    textEvent({ visual, style: 'VisualSmall', layer: 2, x: 125, y: 205, align: 7, fontSize: 28, color: ORANGE_SOFT, text: visual.label, delay: 0.1 }),
    textEvent({ visual, style: 'VisualText', layer: 2, x: 125, y: 280, align: 7, fontSize: 60, maxChars: 25, color: WHITE, text: `“${visual.title}”`, delay: 0.2, scaleSettle: true })
  ];
}

function renderStat(visual) {
  const number = visual.number || '1';
  const label = visual.title.replace(number, '').trim() || visual.title;

  return [
    rect({ visual, x: 95, y: 155, width: 890, height: 455, color: NAVY_2, alpha: '18', layer: 0 }),
    wipeRect({ visual, x: 95, y: 155, width: 890, height: 12, color: ORANGE, layer: 1 }),
    textEvent({ visual, style: 'VisualSmall', layer: 2, x: 540, y: 218, align: 8, fontSize: 27, color: ORANGE_SOFT, text: visual.label, delay: 0.08 }),
    ...countEvents({ visual, number, x: 540, y: 285 }),
    textEvent({ visual, style: 'VisualBody', layer: 2, x: 540, y: 470, align: 8, fontSize: 38, maxChars: 34, color: MUTED, text: label, delay: 0.52 })
  ];
}

function renderGraph(visual) {
  const bars = [
    { x: 600, y: 500, width: 72, height: 105, color: '&H00705A46&', delay: 0.28 },
    { x: 715, y: 415, width: 72, height: 190, color: '&H005A794E&', delay: 0.42 },
    { x: 830, y: 300, width: 72, height: 305, color: ORANGE, delay: 0.56 }
  ];

  return [
    rect({ visual, x: 70, y: 145, width: 940, height: 535, color: NAVY, alpha: '18', layer: 0 }),
    growRect({ visual, x: 70, y: 145, width: 14, height: 535, color: ORANGE, layer: 1, axis: 'y' }),
    textEvent({ visual, style: 'VisualSmall', layer: 2, x: 125, y: 205, align: 7, fontSize: 27, color: ORANGE_SOFT, text: visual.label, delay: 0.08 }),
    textEvent({ visual, style: 'VisualText', layer: 2, x: 125, y: 275, align: 7, fontSize: 50, maxChars: 18, color: WHITE, text: visual.title, delay: 0.18 }),
    ...bars.map(bar => growRect({ visual, ...bar, layer: 1, axis: 'y' })),
    wipeRect({ visual, x: 565, y: 604, width: 370, height: 5, color: MUTED, alpha: '40', layer: 1, delay: 0.2 })
  ];
}

function renderComparison(visual) {
  const leftVisual = withMotion(visual, 'left');
  const rightVisual = withMotion(visual, 'right');

  return [
    rect({ visual, x: 55, y: 145, width: 970, height: 540, color: NAVY, alpha: '18', layer: 0 }),
    textEvent({ visual, style: 'VisualSmall', layer: 2, x: 540, y: 195, align: 8, fontSize: 27, color: ORANGE_SOFT, text: visual.label, delay: 0.08 }),
    rect({ visual: leftVisual, x: 90, y: 255, width: 420, height: 330, color: '&H00402A1C&', alpha: '20', layer: 1, delay: 0.16 }),
    rect({ visual: rightVisual, x: 570, y: 255, width: 420, height: 330, color: '&H00312312&', alpha: '12', layer: 1, delay: 0.24 }),
    textEvent({ visual: leftVisual, style: 'VisualSmall', layer: 2, x: 300, y: 295, align: 8, fontSize: 24, color: MUTED, text: 'BEFORE', delay: 0.28 }),
    textEvent({ visual: rightVisual, style: 'VisualSmall', layer: 2, x: 780, y: 295, align: 8, fontSize: 24, color: ORANGE_SOFT, text: 'AFTER', delay: 0.36 }),
    textEvent({ visual: leftVisual, style: 'VisualBody', layer: 2, x: 300, y: 370, align: 8, fontSize: 37, maxChars: 16, color: WHITE, text: visual.left, delay: 0.38 }),
    textEvent({ visual: rightVisual, style: 'VisualBody', layer: 2, x: 780, y: 370, align: 8, fontSize: 37, maxChars: 16, color: WHITE, text: visual.right, delay: 0.46 })
  ];
}

function renderProcess(visual) {
  const steps = visual.steps?.length ? visual.steps : ['Understand', 'Apply', 'Continue'];
  const events = [
    rect({ visual, x: 70, y: 130, width: 940, height: 650, color: NAVY, alpha: '18', layer: 0 }),
    textEvent({ visual, style: 'VisualSmall', layer: 2, x: 125, y: 185, align: 7, fontSize: 27, color: ORANGE_SOFT, text: visual.label, delay: 0.08 })
  ];

  steps.slice(0, 3).forEach((step, index) => {
    const y = 260 + (index * 150);
    const delay = 0.18 + (index * 0.22);
    const stepVisual = withMotion(visual, 'left');
    events.push(rect({ visual: stepVisual, x: 120, y, width: 82, height: 82, color: ORANGE, alpha: '00', layer: 1, delay, scaleSettle: true }));
    events.push(textEvent({ visual: stepVisual, style: 'VisualText', layer: 2, x: 161, y: y + 16, align: 8, fontSize: 40, color: WHITE, text: String(index + 1), delay: delay + 0.05, scaleSettle: true }));
    events.push(textEvent({ visual: stepVisual, style: 'VisualBody', layer: 2, x: 245, y: y + 16, align: 7, fontSize: 39, maxChars: 28, color: WHITE, text: step, delay: delay + 0.08 }));
  });

  return events;
}

function renderCta(visual) {
  return [
    rect({ visual, x: 70, y: 175, width: 940, height: 380, color: NAVY_2, alpha: '12', layer: 0, scaleSettle: true }),
    wipeRect({ visual, x: 70, y: 175, width: 940, height: 14, color: ORANGE, layer: 1 }),
    textEvent({ visual, style: 'VisualSmall', layer: 2, x: 540, y: 235, align: 8, fontSize: 28, color: ORANGE_SOFT, text: visual.label, delay: 0.1 }),
    textEvent({ visual, style: 'VisualText', layer: 2, x: 540, y: 315, align: 8, fontSize: 64, maxChars: 24, color: WHITE, text: visual.title, delay: 0.2, scaleSettle: true }),
    wipeRect({ visual, x: 365, y: 475, width: 350, height: 6, color: ORANGE, layer: 1, delay: 0.38 })
  ];
}

function countEvents({ visual, number, x, y }) {
  const parsed = parseNumber(number);
  if (!parsed) {
    return [textEvent({ visual, style: 'VisualNumber', layer: 2, x, y, align: 8, fontSize: number.length > 8 ? 92 : 126, color: WHITE, text: number, delay: 0.2, scaleSettle: true })];
  }

  const steps = 7;
  const events = [];
  for (let index = 1; index <= steps; index += 1) {
    const delay = 0.18 + ((index - 1) * 0.065);
    const value = Math.round((parsed.value * index) / steps);
    const text = `${parsed.prefix}${value}${parsed.suffix}`;
    const last = index === steps;
    events.push(textEvent({
      visual,
      style: 'VisualNumber',
      layer: 2,
      x,
      y,
      align: 8,
      fontSize: number.length > 8 ? 92 : 126,
      color: WHITE,
      text,
      delay,
      durationOverride: last ? Math.max(0.5, visual.end - visual.start - delay) : 0.075,
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

function renderCaption(group) {
  const breaks = new Set(group.lineBreakAfter || []);
  const words = group.words || [];

  const text = words.map((item, index) => {
    const centiseconds = Math.max(
      1,
      Math.round((Number(item.end) - Number(item.start)) * 100)
    );
    const separator = breaks.has(index) ? '\\N' : ' ';
    return `{\\k${centiseconds}}${escapeAss(item.word)}${separator}`;
  }).join('').trim();

  return dialogue({
    layer: 10,
    start: group.start,
    end: group.end,
    style: 'Caption',
    text: `{\\fs${group.fontSize || 70}}${text}`
  });
}

function rect({
  visual,
  x,
  y,
  width,
  height,
  color,
  alpha = '00',
  layer = 0,
  delay = 0,
  scaleSettle = false
}) {
  const drawing = `m 0 0 l ${width} 0 l ${width} ${height} l 0 ${height}`;
  const timing = eventTiming(visual, delay);
  const tags = motionTags({ visual, x, y, scaleSettle });
  return dialogue({
    layer,
    start: timing.start,
    end: timing.end,
    style: 'Drawing',
    text: `{\\an7${tags}\\p1\\bord0\\shad0\\1c${color}\\1a&H${alpha}&}${drawing}{\\p0}`
  });
}

function wipeRect({ visual, x, y, width, height, color, alpha = '00', layer = 0, delay = 0 }) {
  const drawing = `m 0 0 l ${width} 0 l ${width} ${height} l 0 ${height}`;
  const timing = eventTiming(visual, delay);
  const entryMs = visual.motion?.entryMs || 280;
  return dialogue({
    layer,
    start: timing.start,
    end: timing.end,
    style: 'Drawing',
    text: `{\\an7\\pos(${x},${y})\\org(${x},${y})\\fad(80,${visual.motion?.exitMs || 180})\\fscx4\\t(0,${entryMs},\\fscx100)\\p1\\bord0\\shad0\\1c${color}\\1a&H${alpha}&}${drawing}{\\p0}`
  });
}

function growRect({ visual, x, y, width, height, color, alpha = '00', layer = 0, axis = 'y', delay = 0 }) {
  const drawing = `m 0 0 l ${width} 0 l ${width} ${height} l 0 ${height}`;
  const timing = eventTiming(visual, delay);
  const entryMs = Math.max(220, visual.motion?.entryMs || 280);
  const scaleTag = axis === 'y'
    ? `\\fscy5\\t(0,${entryMs},\\fscy100)`
    : `\\fscx5\\t(0,${entryMs},\\fscx100)`;
  const originX = axis === 'y' ? x : x;
  const originY = axis === 'y' ? y + height : y;
  return dialogue({
    layer,
    start: timing.start,
    end: timing.end,
    style: 'Drawing',
    text: `{\\an7\\pos(${x},${y})\\org(${originX},${originY})\\fad(80,${visual.motion?.exitMs || 180})${scaleTag}\\p1\\bord0\\shad0\\1c${color}\\1a&H${alpha}&}${drawing}{\\p0}`
  });
}

function textEvent({
  visual,
  style,
  layer,
  x,
  y,
  align,
  fontSize,
  color,
  text,
  maxChars = 32,
  delay = 0,
  durationOverride = null,
  scaleSettle = false
}) {
  const wrapped = wrapText(text, maxChars);
  const timing = eventTiming(visual, delay, durationOverride);
  const tags = motionTags({ visual, x, y, scaleSettle });
  return dialogue({
    layer,
    start: timing.start,
    end: timing.end,
    style,
    text: `{\\an${align}${tags}\\fs${fontSize}\\1c${color}}${escapeAss(wrapped).replace(/\\n/g, '\\N')}`
  });
}

function motionTags({ visual, x, y, scaleSettle = false }) {
  const motion = visual.motion || {};
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

function withMotion(visual, direction) {
  return {
    ...visual,
    motion: {
      ...(visual.motion || {}),
      entry: direction,
      distance: Math.max(48, visual.motion?.distance || 0)
    }
  };
}

function eventTiming(visual, delay = 0, durationOverride = null) {
  const start = Number(visual.start || 0) + Number(delay || 0);
  const maximumEnd = Number(visual.end || start + 1);
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
