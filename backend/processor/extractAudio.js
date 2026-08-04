import { spawn } from 'node:child_process';

export function extractAudio({ ffmpegPath, inputPath, audioPath }) {
  const args = [
    '-y',
    '-i', inputPath,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-codec:a', 'libmp3lame',
    '-b:a', '64k',
    audioPath
  ];

  return runFfmpeg({
    ffmpegPath,
    args,
    failureMessage: 'ICA could not prepare the audio from this recording.'
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

      reject(new Error(`${failureMessage}\n${stderr.slice(-1600)}`));
    });
  });
}
