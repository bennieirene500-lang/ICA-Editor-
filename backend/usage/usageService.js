export class UsageService {
  constructor({ gateway, enabled, defaultAllowance = 5 }) {
    this.gateway = gateway;
    this.enabled = enabled;
    this.defaultAllowance = defaultAllowance;
  }

  async getSummary(user) {
    if (!this.enabled || user.localPreview) {
      return {
        displayName: user.user_metadata?.display_name || 'Founder Preview',
        monthlyVideoAllowance: null,
        videosUsed: 0,
        videosRemaining: null,
        periodStart: null,
        isActive: true,
        unlimited: true
      };
    }

    const row = await this.gateway.getMemberSummary(user.id);
    if (!row) {
      const error = new Error('Your ICA beta profile has not been created yet.');
      error.status = 403;
      error.code = 'MEMBER_PROFILE_MISSING';
      throw error;
    }
    return normalizeSummary(row);
  }

  async claim({ user, jobId, durationSeconds }) {
    if (!this.enabled || user.localPreview) {
      return { allowed: true, videosRemaining: null, reason: 'founder-preview', unlimited: true };
    }

    const row = await this.gateway.claimVideoAllowance({
      userId: user.id,
      jobId,
      durationSeconds
    });

    return {
      allowed: Boolean(row?.allowed),
      videosRemaining: Number(row?.videos_remaining ?? 0),
      reason: row?.reason || 'unknown',
      unlimited: false
    };
  }

  async finish({ jobId, status, outputCount = 0, errorCode = null }) {
    if (!this.enabled) return;
    await this.gateway.finishVideoJob({ jobId, status, outputCount, errorCode });
  }
}

function normalizeSummary(row) {
  return {
    displayName: row.display_name || 'ICA Member',
    monthlyVideoAllowance: Number(row.monthly_video_allowance ?? 0),
    videosUsed: Number(row.videos_used ?? 0),
    videosRemaining: Number(row.videos_remaining ?? 0),
    periodStart: row.period_start || null,
    isActive: Boolean(row.is_active),
    unlimited: false
  };
}
