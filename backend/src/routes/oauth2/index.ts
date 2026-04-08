import { Router } from 'express';
import authorizeRouter from './authorize';
import tokenRouter from './token';
import userinfoRouter from './userinfo';
import botInviteRouter from './bot-invite';

const router = Router();

router.use('/authorize', authorizeRouter);
router.use('/token', tokenRouter);
router.use('/userinfo', userinfoRouter);
router.use('/bot-invite', botInviteRouter);

export default router;
