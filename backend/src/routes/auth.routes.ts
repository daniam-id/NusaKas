import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Public routes - Check user registration status
router.post('/check-user', (req, res) => authController.checkUser(req, res));

// Public routes - Smart login (PIN for existing, OTP for new users)
router.post('/login', (req, res) => authController.login(req, res));

// Public routes - Registration flow (for new users)
router.post('/register/send-otp', (req, res) => authController.login(req, res)); // Returns WhatsApp deep link
router.post('/register/check-status', (req, res) => authController.checkVerificationStatus(req, res)); // Poll for verification
router.post('/register/verify-otp', (req, res) => authController.verifyOtpForRegistration(req, res));
router.post('/register/complete', (req, res) => authController.completeRegistration(req, res));

// Legacy routes (keep for backward compatibility)
router.post('/verify', (req, res) => authController.verify(req, res));

// Protected routes
router.get('/me', authMiddleware, (req, res) => authController.me(req, res));
router.post('/refresh', authMiddleware, (req, res) => authController.refresh(req, res));

export default router;
