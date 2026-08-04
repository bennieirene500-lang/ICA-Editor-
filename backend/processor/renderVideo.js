import { spawn } from 'node:child_process';

export function renderCaptionedVideo({ ffmpegPath, inputPath, subtitlePath, outputPath }) {
  const escapedSubtitlePath = escapeSubtitlePath(subtitlePath);
  const filter = `subtitles='${escapedSubtitlePath}'`;

  const args = [
    '-y',
    '-i', inputPath,
    '-vf', filter,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    outputPath
  ];

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
        `ICA could not build the captioned video.\n${stderr.slice(-1800)}`
      ));
    });
  });
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
