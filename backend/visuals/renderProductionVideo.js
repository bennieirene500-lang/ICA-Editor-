import { spawn } from 'node:child_process';

const DEFAULT_CARD_BACKDROP_COLOR = '0x141d2b';

export function renderProductionVideo({
  ffmpegPath,
  inputPath,
  subtitlePath,
  outputPath,
  soundCues = [],
  visualOverlays = [],
  width,
  height,
  withMusic = true,
  reframe = null
}) {
  const disciplinedCues = Array.isArray(soundCues) ? soundCues.slice(0, 3) : [];

  const args = buildArgs({
    inputPath,
    outputPath,
    subtitlePath,
    soundCues: disciplinedCues,
    visualOverlays,
    width,
    height,
    withMusic,
    reframe
  });

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      stdio: ['ignore', 'ignore', 'pipe']
    });

    let stderr = '';

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', code => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(
        `ICA could not apply the production plan.\n${stderr.slice(-2600)}`
      ));
    });
  });
}

function buildArgs({
  inputPath,
  outputPath,
  subtitlePath,
  soundCues,
  visualOverlays,
  width,
  height,
  withMusic,
  reframe
}) {
  const outputWidth = even(width);
  const outputHeight = even(height);

  const inputArgs = ['-i', inputPath];
  visualOverlays.forEach(overlay => {
    if (overlay.kind === 'color' && overlay.backdropImagePath) {
      inputArgs.push('-loop', '1', '-i', overlay.backdropImagePath);
    } else if (overlay.kind === 'color') {
      const colorSource = overlay.backdropColorSource || DEFAULT_CARD_BACKDROP_COLOR;
      inputArgs.push('-f', 'lavfi', '-i', `color=c=${colorSource}:s=${outputWidth}x${outputHeight}:r=30`);
    } else if (overlay.kind === 'video') {
      inputArgs.push('-stream_loop', '-1', '-i', overlay.mediaPath);
    } else {
      inputArgs.push('-loop', '1', '-i', overlay.imagePath);
    }
  });

  const filterParts = [];

  if (reframe) {
    filterParts.push(
      `[0:v]crop=w=${reframe.cropWidth}:h=${reframe.cropHeight}:x='${reframe.xExpr}':y='${reframe.yExpr}',` +
      `scale=w=${outputWidth}:h=${outputHeight},setsar=1,eq=contrast=1.06:saturation=1.12:brightness=0.01[graded]`
    );
  } else {
    filterParts.push('[0:v]eq=contrast=1.06:saturation=1.12:brightness=0.01[graded]');
  }
  let currentVideoLabel = 'graded';

  visualOverlays.forEach((overlay, index) => {
    if (overlay.kind === 'color' && overlay.backdropImagePath) {
      filterParts.push(
        `[${index + 1}:v]scale=w=${outputWidth}:h=${outputHeight}:force_original_aspect_ratio=increase,` +
        `crop=${outputWidth}:${outputHeight},setsar=1,boxblur=8:2,eq=brightness=-0.18:saturation=0.55,format=yuva420p[img${index}]`
      );
    } else if (overlay.kind === 'color') {
      filterParts.push(`[${index + 1}:v]format=yuva420p[img${index}]`);
    } else {
      filterParts.push(
        `[${index + 1}:v]scale=w=${outputWidth}:h=${outputHeight}:force_original_aspect_ratio=increase,` +
        `crop=${outputWidth}:${outputHeight},setsar=1,format=yuva420p[img${index}]`
      );
    }
  });

  visualOverlays.forEach((overlay, index) => {
    const nextLabel = `ov${index}`;
    filterParts.push(
      `[${currentVideoLabel}][img${index}]overlay=eof_action=pass:enable='between(t,${overlay.start},${overlay.end})'[${nextLabel}]`
    );
    currentVideoLabel = nextLabel;
  });

  visualOverlays.forEach((overlay, index) => {
    const style = pickTransitionStyle(overlay);
    const nextLabel = `trans${index}`;
    filterParts.push(
      `[${currentVideoLabel}]${transitionFilter(style, overlay.start)},${transitionFilter(style, overlay.end)}[${nextLabel}]`
    );
    currentVideoLabel = nextLabel;
  });

  const escapedSubtitlePath = subtitlePath ? escapeSubtitlePath(subtitlePath) : null;

  if (escapedSubtitlePath) {
    filterParts.push(`[${currentVideoLabel}]subtitles='${escapedSubtitlePath}'[vout]`);
  } else {
    filterParts.push(`[${currentVideoLabel}]null[vout]`);
  }

  const videoOutputLabel = '[vout]';

  let audioOutputLabel = '0:a';

  if (withMusic || soundCues.length) {
    filterParts.push('[0:a]aformat=sample_rates=48000:channel_layouts=stereo[voiceRaw]');

    const layerLabels = [];

    if (withMusic) {
      filterParts.push('[voiceRaw]asplit=2[voice][voiceSidechain]');
      filterParts.push(`${backgroundMusicSource()},aformat=sample_rates=48000:channel_layouts=stereo[bgmusicRaw]`);
      filterParts.push(
        '[bgmusicRaw][voiceSidechain]sidechaincompress=threshold=0.04:ratio=10:attack=40:release=450:makeup=1[bgmusic]'
      );
      layerLabels.push('[bgmusic]');
    } else {
      filterParts.push('[voiceRaw]anull[voice]');
    }

    soundCues.forEach((cue, index) => {
      const label = `cue${index}`;
      const delay = Math.max(0, Math.round(Number(cue.start || 0) * 1000));
      filterParts.push(`${soundSource(cue.type)},aformat=sample_rates=48000:channel_layouts=stereo,adelay=${delay}|${delay}[${label}]`);
      layerLabels.push(`[${label}]`);
    });

    filterParts.push(
      `[voice]${layerLabels.join('')}amix=inputs=${layerLabels.length + 1}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[aout]`
    );
    audioOutputLabel = '[aout]';
  }

  const args = [
    '-y', ...inputArgs,
    '-filter_complex', filterParts.join(';'),
    '-map', videoOutputLabel,
    '-map', audioOutputLabel
  ];

  args.push(
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '19',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    outputPath
  );

  return args;
}

const TRANSITION_STYLES = ['dissolve', 'blur', 'flash'];
const TRANSITION_HALF_DURATION = 0.09;

function pickTransitionStyle(overlay) {
  const seed = hash(`${overlay.id || ''}:${overlay.start}`);
  return TRANSITION_STYLES[Math.abs(seed) % TRANSITION_STYLES.length];
}

function transitionFilter(style, cutTime) {
  const from = Math.max(0, cutTime - TRANSITION_HALF_DURATION);
  const to = cutTime + TRANSITION_HALF_DURATION;
  const enable = `between(t,${from},${to})`;

  if (style === 'flash') {
    return `eq=brightness=0.4:enable='${enable}'`;
  }

  if (style === 'blur') {
    return `boxblur=12:2:enable='${enable}'`;
  }

  return `boxblur=6:1:enable='${enable}',eq=contrast=0.82:enable='${enable}'`;
}

function hash(value) {
  let result = 0;
  for (const character of String(value || '')) {
    result = ((result << 5) - result + character.charCodeAt(0)) | 0;
  }
  return result;
}

function backgroundMusicSource() {
  return 'sine=frequency=110,chorus=0.5:0.9:50:0.4:0.25:2,tremolo=f=0.1:d=0.22,volume=0.022,afade=t=in:st=0:d=3';
}

function soundSource(type) {
  if (type === 'soft-tick') {
    return 'sine=frequency=540:duration=0.065,afade=t=out:st=0.018:d=0.047,volume=0.018';
  }

  if (type === 'soft-rise') {
    return 'sine=frequency=660:duration=0.09,afade=t=in:st=0:d=0.018,afade=t=out:st=0.035:d=0.055,volume=0.016';
  }

  return 'anoisesrc=color=pink:duration=0.12,highpass=f=900,lowpass=f=3800,afade=t=out:st=0.025:d=0.095,volume=0.018';
}

function even(value) {
  const number = Math.max(2, Math.round(Number(value) || 2));
  return number % 2 === 0 ? number : number - 1;
}

function escapeSubtitlePath(filePath) {
  return filePath
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/,/g, '\\,')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}
