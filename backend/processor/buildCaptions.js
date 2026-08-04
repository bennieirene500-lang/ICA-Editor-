const DEFAULTS = Object.freeze({
  maxWords: 5,
  maxDuration: 2.4,
  maxChars: 34,
  maxCharsPerLine: 18,
  baseFontSize: 70,
  minFontSize: 54
});

export function buildCaptionGroups(words, limits = {}) {
  const config = { ...DEFAULTS, ...limits };
  const groups = [];
  let current = [];

  for (const word of words) {
    const proposed = [...current, word];
    const duration = proposed.at(-1).end - proposed[0].start;
    const text = proposed.map(item => item.word).join(' ');

    const exceedsLimit =
      proposed.length > config.maxWords ||
      duration > config.maxDuration ||
      text.length > config.maxChars;

    if (current.length && exceedsLimit) {
      groups.push(toCaptionGroup(current, config));
      current = [word];
    } else {
      current = proposed;
    }
  }

  if (current.length) {
    groups.push(toCaptionGroup(current, config));
  }

  return groups;
}

export function createAss(groups) {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ICA,Arial,70,&H00FFFFFF,&H00205DFF,&H00111111,&H70000000,-1,0,0,0,100,100,0,0,1,5,1,2,90,90,360,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = groups.map(group => {
    const words = group.words;
    const breaks = new Set(group.lineBreakAfter || []);

    const text = words.map((item, index) => {
      const centiseconds = Math.max(
        1,
        Math.round((item.end - item.start) * 100)
      );

      const separator = breaks.has(index) ? '\\N' : ' ';
      return `{\\k${centiseconds}}${escapeAss(item.word)}${separator}`;
    }).join('').trim();

    return `Dialogue: 0,${assTime(group.start)},${assTime(group.end)},ICA,,0,0,0,,{\\fs${group.fontSize}}${text}`;
  });

  return `${header}${events.join('\n')}\n`;
}

function toCaptionGroup(words, config) {
  const text = words.map(item => item.word).join(' ');
  const layout = createBalancedLayout(text, config);

  return {
    start: words[0].start,
    end: words.at(-1).end,
    text,
    words: words.map(item => ({ ...item })),
    ...layout
  };
}

function createBalancedLayout(text, config) {
  const tokens = text.split(/\s+/).filter(Boolean);

  if (text.length <= config.maxCharsPerLine) {
    return {
      lines: [text],
      lineBreakAfter: [],
      fontSize: config.baseFontSize
    };
  }

  let bestIndex = Math.ceil(tokens.length / 2);
  let bestDifference = Infinity;

  for (let index = 1; index < tokens.length; index += 1) {
    const first = tokens.slice(0, index).join(' ');
    const second = tokens.slice(index).join(' ');
    const difference = Math.abs(first.length - second.length);

    if (difference < bestDifference) {
      bestDifference = difference;
      bestIndex = index;
    }
  }

  const firstLine = tokens.slice(0, bestIndex).join(' ');
  const secondLine = tokens.slice(bestIndex).join(' ');
  const longest = Math.max(firstLine.length, secondLine.length);

  const scaleRatio = Math.min(
    1,
    config.maxCharsPerLine / Math.max(1, longest)
  );

  return {
    lines: [firstLine, secondLine],
    lineBreakAfter: [bestIndex - 1],
    fontSize: Math.max(
      config.minFontSize,
      Math.round(config.baseFontSize * scaleRatio)
    )
  };
}

function assTime(seconds) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const cs = Math.floor((safe - Math.floor(safe)) * 100);

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function escapeAss(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, ' ');
}
