import { spawn } from 'node:child_process';

export async function detectSilence({
  ffmpegPath,
  inputPath,
  noiseDb = -38,
  minimumSilenceSeconds = 0.85
}) {
  const args = [
    '-hide_banner',
    '-i', inputPath,
    '-af', `silencedetect=noise=${noiseDb}dB:d=${minimumSilenceSeconds}`,
    '-f', 'null',
    '-'
  ];

  const stderr = await runAndCapture(ffmpegPath, args);
  return parseSilence(stderr);
}

function runAndCapture(ffmpegPath, args) {
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
        resolve(stderr);
        return;
      }

      reject(new Error(
        `ICA could not analyse the recording for pauses.\n${stderr.slice(-1800)}`
      ));
    });
  });
}

function parseSilence(stderr) {
  const starts = [];
  const ranges = [];
  const lines = stderr.split(/\r?\n/);

  for (const line of lines) {
    const startMatch = line.match(/silence_start:\s*([0-9.]+)/);
    if (startMatch) {
      starts.push(Number(startMatch[1]));
      continue;
    }

    const endMatch = line.match(/silence_end:\s*([0-9.]+)/);
    if (endMatch && starts.length) {
      const start = starts.shift();
      const end = Number(endMatch[1]);

      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        ranges.push({ start, end, duration: end - start });
      }
    }
  }

  return ranges;
}
