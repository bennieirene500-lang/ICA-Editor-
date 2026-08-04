export class SupabaseGateway {
  constructor({ url, publishableKey, secretKey }) {
    this.url = String(url || '').replace(/\/$/, '');
    this.publishableKey = String(publishableKey || '');
    this.secretKey = String(secretKey || '');
  }

  get configured() {
    return Boolean(this.url && this.publishableKey && this.secretKey);
  }

  async signInWithPassword({ email, password }) {
    return this.#request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      key: this.publishableKey,
      body: { email, password }
    });
  }

  async refreshSession(refreshToken) {
    return this.#request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      key: this.publishableKey,
      body: { refresh_token: refreshToken }
    });
  }

  async getUser(accessToken) {
    return this.#request('/auth/v1/user', {
      method: 'GET',
      key: this.publishableKey,
      bearer: accessToken
    });
  }

  async getMemberSummary(userId) {
    const result = await this.#request('/rest/v1/rpc/ica_get_member_summary', {
      method: 'POST',
      key: this.secretKey,
      bearer: this.secretKey,
      body: { p_user_id: userId }
    });
    return Array.isArray(result) ? result[0] : result;
  }

  async claimVideoAllowance({ userId, jobId, durationSeconds }) {
    const result = await this.#request('/rest/v1/rpc/ica_claim_video_allowance', {
      method: 'POST',
      key: this.secretKey,
      bearer: this.secretKey,
      body: {
        p_user_id: userId,
        p_job_id: jobId,
        p_duration_seconds: Math.max(0, Math.round(durationSeconds || 0))
      }
    });
    return Array.isArray(result) ? result[0] : result;
  }

  async finishVideoJob({ jobId, status, outputCount = 0, errorCode = null }) {
    await this.#request('/rest/v1/rpc/ica_finish_video_job', {
      method: 'POST',
      key: this.secretKey,
      bearer: this.secretKey,
      body: {
        p_job_id: jobId,
        p_status: status,
        p_output_count: outputCount,
        p_error_code: errorCode
      }
    });
  }

  async ping() {
    await this.#request('/rest/v1/ica_member_profiles?select=user_id&limit=1', {
      method: 'GET',
      key: this.secretKey,
      bearer: this.secretKey
    });
    return true;
  }

  async #request(path, { method, key, bearer, body }) {
    if (!this.configured) {
      const error = new Error('Supabase is not configured.');
      error.status = 503;
      error.code = 'SUPABASE_NOT_CONFIGURED';
      throw error;
    }

    const response = await fetch(`${this.url}${path}`, {
      method,
      headers: {
        apikey: key,
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000)
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); }
      catch { payload = { message: text }; }
    }

    if (!response.ok) {
      const error = new Error(
        payload?.msg || payload?.message || payload?.error_description || payload?.error || 'Supabase request failed.'
      );
      error.status = response.status;
      error.code = payload?.code || payload?.error_code || 'SUPABASE_REQUEST_FAILED';
      throw error;
    }

    return payload;
  }
}
