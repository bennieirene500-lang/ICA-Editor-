export function safeErrorMessage(error) {
  if (error?.code === 'LIMIT_FILE_SIZE') return 'This recording is too large. Please choose a shorter recording.';
  if (error?.code === 'VIDEO_ALLOWANCE_EXHAUSTED') return 'You have used the videos included for this month.';
  if (error?.code === 'QUEUE_FULL') return error.message;
  if (error?.code === 'ENOSPC') return 'ICA temporarily ran out of processing space. Please try again shortly.';

  if (error?.status === 401 && /api key|authentication|openai/i.test(String(error?.message || ''))) {
    return 'ICA could not connect to its AI production service. Check the private OpenAI key in Render.';
  }
  if (error?.status === 401) return 'Please sign in again and retry.';
  if (error?.status === 429) return 'ICA is receiving too many requests right now. Please wait a moment and try again.';
  if (error?.status === 413) return 'This recording is too large for the current beta.';

  return error?.message || 'ICA could not prepare this video.';
}

export function statusForError(error) {
  if (error?.code === 'LIMIT_FILE_SIZE') return 413;
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 600) return error.status;
  return 500;
}
