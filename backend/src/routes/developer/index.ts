import { Router } from 'express';
import applicationsRouter from './applications';
import botsRouter from './bots';

const router = Router();

router.use('/applications', applicationsRouter);
router.use('/applications/:appId/bot', botsRouter);

export default router;
