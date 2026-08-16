import fsp from 'node:fs/promises';
import path from 'node:path';

import OpenAI from 'openai';

const MODEL = 'gpt-image-1';
const IMAGE_SIZE = '1024x1536';
const IMAGE_QUALITY = 'medium';

export async function generateVisualImages({ apiKey, moments, tempDir, jobId }) {
  const openai = new OpenAI({ apiKey });

  const results = await Promise.all(moments.map(async (moment, index) => {
    const response = await openai.images.generate({
      model: MODEL,
      prompt: moment.imagePrompt,
      size: IMAGE_SIZE,
      quality: IMAGE_QUALITY
    });

    const base64 = response.data?.[0]?.b64_json;
    if (!base64) return null;

    const imagePath = path.join(tempDir, `${jobId}-visual-${index}.png`);
    await fsp.writeFile(imagePath, Buffer.from(base64, 'base64'));

    return { ...moment, imagePath };
  }));

  return results.filter(Boolean);
}
