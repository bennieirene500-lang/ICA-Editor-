import fs from 'node:fs';
import OpenAI from 'openai';

export async function transcribeAudio({ apiKey, audioPath }) {
  const openai = new OpenAI({ apiKey });

  const result = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['word'],
    prompt:
      'Transcribe exactly what is spoken. Preserve the detected language. Do not translate. The speaker may use more than one language, names, brands, or local terms.'
  });

  const words = normalizeWords(result.words || []);

  return {
    text: result.text || '',
    words,
    language: result.language || 'unknown'
  };
}

function normalizeWords(words) {
  return words
    .map(item => ({
      word: String(item.word || '').trim(),
      start: Number(item.start),
      end: Number(item.end)
    }))
    .filter(item =>
      item.word &&
      Number.isFinite(item.start) &&
      Number.isFinite(item.end) &&
      item.end > item.start
    );
}
