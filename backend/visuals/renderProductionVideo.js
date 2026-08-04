import { spawn } from 'node:child_process';

export function renderProductionVideo({
  ffmpegPath,
  inputPath,
  subtitlePath,
  outputPath,
  soundCues = []
}) {
  const escapedSubtitlePath = escapeSubtitlePath(subtitlePath);
  const disciplinedCues = Array.isArray(soundCues)
    ? soundCues.slice(0, 3)
    : [];

  const args = disciplinedCues.length
    ? buildSoundMixArgs({
        inputPath,
        outputPath,
        escapedSubtitlePath,
        soundCues: disciplinedCues
      })
    : buildSimpleArgs({
        inputPath,
        outputPath,
        escapedSubtitlePath
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
        `ICA could not apply the kinetic visual production plan.\n${stderr.slice(-2600)}`
      ));
    });
  });
}

function buildSimpleArgs({ inputPath, outputPath, escapedSubtitlePath }) {
  return [
    '-y',
    '-i', inputPath,
    '-vf', `subtitles='${escapedSubtitlePath}'`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '19',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    outputPath
  ];
}

function buildSoundMixArgs({
  inputPath,
  outputPath,
  escapedSubtitlePath,
  soundCues
}) {
  const filterParts = [
    `[0:v]subtitles='${escapedSubtitlePath}'[vout]`,
    '[0:a]aformat=sample_rates=48000:channel_layouts=stereo[voice]'
  ];
  const cueLabels = [];

  soundCues.forEach((cue, index) => {
    const label = `cue${index}`;
    const delay = Math.max(0, Math.round(Number(cue.start || 0) * 1000));
    filterParts.push(`${soundSource(cue.type)},aformat=sample_rates=48000:channel_layouts=stereo,adelay=${delay}|${delay}[${label}]`);
    cueLabels.push(`[${label}]`);
  });

  filterParts.push(
    `[voice]${cueLabels.join('')}amix=inputs=${cueLabels.length + 1}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[aout]`
  );

  return [
    '-y',
    '-i', inputPath,
    '-filter_complex', filterParts.join(';'),
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '19',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    outputPath
  ];
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

function escapeSubtitlePath(filePath) {
  return filePath
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/,/g, '\\,')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}
