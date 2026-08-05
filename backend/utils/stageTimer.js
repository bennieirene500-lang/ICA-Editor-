/**
 * Lightweight stage timer for the video production pipeline.
 *
 * Logs a START line before a stage runs and a DONE/FAIL line after it
 * finishes, including per-stage duration and running total duration for
 * the job. Intended purely for diagnostics — it does not change control
 * flow or behaviour of the wrapped function.
 */
export function createStageTimer(jobId) {
  const jobStartedAt = Date.now();

  async function stage(name, fn) {
    const stageStartedAt = Date.now();
    console.log(`[ICA][job=${jobId}] START ${name}`);

    try {
      const result = await fn();
      const stageMs = Date.now() - stageStartedAt;
      const totalMs = Date.now() - jobStartedAt;
      console.log(
        `[ICA][job=${jobId}] DONE  ${name} | stageMs=${stageMs} | totalMs=${totalMs}`
      );
      return result;
    } catch (error) {
      const stageMs = Date.now() - stageStartedAt;
      const totalMs = Date.now() - jobStartedAt;
      console.error(
        `[ICA][job=${jobId}] FAIL  ${name} | stageMs=${stageMs} | totalMs=${totalMs} | error=${error?.message || error}`
      );
      throw error;
    }
  }

  function mark(name) {
    const totalMs = Date.now() - jobStartedAt;
    console.log(`[ICA][job=${jobId}] MARK  ${name} | totalMs=${totalMs}`);
  }

  function totalElapsedMs() {
    return Date.now() - jobStartedAt;
  }

  return { stage, mark, totalElapsedMs };
}
