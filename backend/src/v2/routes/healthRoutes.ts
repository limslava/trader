import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    version: 'v2',
    timestamp: new Date().toISOString()
  });
});

export default router;
