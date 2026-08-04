import express from 'express';

export function createMemberRouter({ requireUser, usageService }) {
  const router = express.Router();
  router.get('/member', requireUser, async (req, res, next) => {
    try {
      const member = await usageService.getSummary(req.auth.user);
      res.json({ ok: true, member });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
