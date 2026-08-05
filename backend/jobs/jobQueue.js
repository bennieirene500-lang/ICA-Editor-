export class QueueFullError extends Error {
  constructor() {
    super('ICA is currently producing the maximum number of videos. Please try again shortly.');
    this.name = 'QueueFullError';
    this.status = 503;
    this.code = 'QUEUE_FULL';
  }
}

export class JobQueue {
  constructor({ maxConcurrent = 1, maxPending = 5 } = {}) {
    this.maxConcurrent = maxConcurrent;
    this.maxPending = maxPending;
    this.active = 0;
    this.pending = [];
  }

  get state() {
    return { active: this.active, pending: this.pending.length };
  }

  run(task) {
    if (this.active >= this.maxConcurrent && this.pending.length >= this.maxPending) {
      return Promise.reject(new QueueFullError());
    }

    const enqueuedAt = Date.now();
    console.log(
      `[ICA][queue] enqueued | active=${this.active} | pending=${this.pending.length} | maxConcurrent=${this.maxConcurrent}`
    );

    return new Promise((resolve, reject) => {
      this.pending.push({ task, resolve, reject, enqueuedAt });
      this.#drain();
    });
  }

  #drain() {
    while (this.active < this.maxConcurrent && this.pending.length) {
      const entry = this.pending.shift();
      const waitedMs = Date.now() - entry.enqueuedAt;
      console.log(
        `[ICA][queue] starting job | waitedMs=${waitedMs} | active=${this.active + 1} | pending=${this.pending.length}`
      );
      this.active += 1;

      Promise.resolve()
        .then(entry.task)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          this.active -= 1;
          console.log(`[ICA][queue] job slot freed | active=${this.active} | pending=${this.pending.length}`);
          this.#drain();
        });
    }
  }
}
