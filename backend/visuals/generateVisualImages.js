import fsp from 'node:fs/promises';
import path from 'node:path';

import OpenAI from 'openai';

const MODEL = 'gpt-image-1';
const IMAGE_SIZE = '1024x1536';

export async function generateVisualImages({ apiKey, moments, tempDir, jobId }) {
  const openai = new OpenAI({ apiKey });

  const images = [];

  for (const [index, moment] of moments.entries()) {
    const response = await openai.images.generate({
      model: MODEL,
      prompt: moment.imagePrompt,
      size: IMAGE_SIZE
    });

    const base64 = response.data?.[0]?.b64_json;
    if (!base64) continue;

    const imagePath = path.join(tempDir, `${jobId}-visual-${index}.png`);
    await fsp.writeFile(imagePath, Buffer.from(base64, 'base64'));

    images.push({ ...moment, imagePath });
  }

  return images;
}
