import { Router } from 'express';
import { registerController } from '../controllers/register.controller.js';

const router = Router();

// POST /api/register/start - Start OTP verification flow
router.post('/start', (req, res) => registerController.start(req, res));

export default router;
