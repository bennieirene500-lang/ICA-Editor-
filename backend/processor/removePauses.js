import { spawn } from 'node:child_process';

export function removePauses({
  ffmpegPath,
  inputPath,
  outputPath,
  keepSegments
}) {
  if (!keepSegments.length) {
    throw new Error('ICA could not create a safe pause-removal plan.');
  }

  if (keepSegments.length === 1 && keepSegments[0].start === 0) {
    return copyVideo({
      ffmpegPath,
      inputPath,
      outputPath
    });
  }

  const filters = [];
  const concatInputs = [];

  keepSegments.forEach((segment, index) => {
    filters.push(
      `[0:v]trim=start=${segment.start}:end=${segment.end},setpts=PTS-STARTPTS[v${index}]`
    );
    filters.push(
      `[0:a]atrim=start=${segment.start}:end=${segment.end},asetpts=PTS-STARTPTS[a${index}]`
    );
    concatInputs.push(`[v${index}][a${index}]`);
  });

  filters.push(
    `${concatInputs.join('')}concat=n=${keepSegments.length}:v=1:a=1[outv][outa]`
  );

  const args = [
    '-y',
    '-i', inputPath,
    '-filter_complex', filters.join(';'),
    '-map', '[outv]',
    '-map', '[outa]',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    outputPath
  ];

  return runFfmpeg({
    ffmpegPath,
    args,
    failureMessage: 'ICA could not tighten the pauses in this recording.'
  });
}

function copyVideo({ ffmpegPath, inputPath, outputPath }) {
  const args = [
    '-y',
    '-i', inputPath,
    '-c', 'copy',
    '-movflags', '+faststart',
    outputPath
  ];

  return runFfmpeg({
    ffmpegPath,
    args,
    failureMessage: 'ICA could not prepare this recording.'
  });
}

function runFfmpeg({ ffmpegPath, args, failureMessage }) {
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

      reject(new Error(`${failureMessage}\n${stderr.slice(-1800)}`));
    });
  });
}
