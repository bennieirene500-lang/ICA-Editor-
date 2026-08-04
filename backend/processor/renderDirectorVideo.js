import { spawn } from 'node:child_process';

export function renderDirectorVideo({
  ffmpegPath,
  inputPath,
  outputPath,
  segments,
  width,
  height,
  frameRate = 30
}) {
  if (!segments.length) {
    throw new Error('ICA could not create a visual direction plan.');
  }

  const filters = [];
  const concatInputs = [];
  const outputWidth = even(width);
  const outputHeight = even(height);

  segments.forEach((segment, index) => {
    const videoLabel = `v${index}`;
    const audioLabel = `a${index}`;
    const segmentDuration = Math.max(0.05, segment.end - segment.start);

    if (segment.mode === 'punch') {
      const zoomAmount = Math.max(0, Number(segment.zoomScale || 1.08) - 1);
      const duration = segmentDuration.toFixed(3);

      /*
       * The sine curve starts at normal framing, glides inward,
       * reaches maximum emphasis halfway through, and returns smoothly.
       */
      const zoomExpression =
        `1+${zoomAmount.toFixed(4)}*sin(PI*t/${duration})`;

      const scaledWidth =
        `trunc(iw*(${zoomExpression})/2)*2`;

      const scaledHeight =
        `trunc(ih*(${zoomExpression})/2)*2`;

      filters.push(
        `[0:v]trim=start=${segment.start}:end=${segment.end},` +
        `setpts=PTS-STARTPTS,` +
        `scale=w='${scaledWidth}':h='${scaledHeight}':eval=frame,` +
        `crop=${outputWidth}:${outputHeight}:(in_w-out_w)/2:(in_h-out_h)/2,` +
        `fps=${frameRate},format=yuv420p[${videoLabel}]`
      );
    } else {
      filters.push(
        `[0:v]trim=start=${segment.start}:end=${segment.end},` +
        `setpts=PTS-STARTPTS,` +
        `scale=${outputWidth}:${outputHeight},` +
        `fps=${frameRate},format=yuv420p[${videoLabel}]`
      );
    }

    filters.push(
      `[0:a]atrim=start=${segment.start}:end=${segment.end},` +
      `asetpts=PTS-STARTPTS[${audioLabel}]`
    );

    concatInputs.push(`[${videoLabel}][${audioLabel}]`);
  });

  filters.push(
    `${concatInputs.join('')}concat=n=${segments.length}:v=1:a=1[outv][outa]`
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
    failureMessage: 'ICA could not apply the visual rhythm plan.'
  });
}

function even(value) {
  const number = Math.max(2, Math.round(value));
  return number % 2 === 0 ? number : number - 1;
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

      reject(new Error(
        `${failureMessage}\n${stderr.slice(-2200)}`
      ));
    });
  });
}
