import fsp from 'node:fs/promises';

export class OutputRegistry {
  constructor({ ttlMs }) {
    this.ttlMs = ttlMs;
    this.entries = new Map();
    this.timer = setInterval(() => this.cleanupExpired(), Math.min(ttlMs, 5 * 60 * 1000));
    this.timer.unref?.();
  }

  register(entry) {
    const expiresAt = Date.now() + this.ttlMs;
    this.entries.set(entry.jobId, {
      ...entry,
      expiresAt,
      noCaptionPath: null,
      noCaptionPromise: null
    });
    return this.entries.get(entry.jobId);
  }

  get(jobId, userId) {
    const entry = this.entries.get(jobId);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      void this.remove(jobId);
      return null;
    }
    if (entry.userId !== userId) return null;
    return entry;
  }

  setNoCaptionPromise(jobId, promise) {
    const entry = this.entries.get(jobId);
    if (entry) entry.noCaptionPromise = promise;
  }

  setNoCaptionPath(jobId, filePath) {
    const entry = this.entries.get(jobId);
    if (entry) {
      entry.noCaptionPath = filePath;
      entry.noCaptionPromise = null;
    }
  }

  async remove(jobId) {
    const entry = this.entries.get(jobId);
    if (!entry) return;
    this.entries.delete(jobId);
    const paths = new Set([
      entry.captionedPath,
      entry.noCaptionPath,
      entry.directedPath,
      entry.visualOnlyAssPath
    ].filter(Boolean));
    await Promise.allSettled([...paths].map(filePath => fsp.rm(filePath, { force: true })));
  }

  async cleanupExpired() {
    const expired = [...this.entries.values()]
      .filter(entry => entry.expiresAt <= Date.now())
      .map(entry => entry.jobId);
    await Promise.allSettled(expired.map(jobId => this.remove(jobId)));
  }

  async dispose() {
    clearInterval(this.timer);
    await Promise.allSettled([...this.entries.keys()].map(jobId => this.remove(jobId)));
  }
}
