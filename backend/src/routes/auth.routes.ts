import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Public routes
router.post('/login', (req, res) => authController.login(req, res));
router.post('/verify', (req, res) => authController.verify(req, res));

// Protected routes
router.get('/me', authMiddleware, (req, res) => authController.me(req, res));

export default router;
