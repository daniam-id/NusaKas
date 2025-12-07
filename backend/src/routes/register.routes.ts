import { Router } from 'express';
import { registerController } from '../controllers/register.controller.js';

const router = Router();

// Legacy: Start OTP verification flow (WhatsApp deep link)
router.post('/start', (req, res) => registerController.start(req, res));

// Web Registration Flow
router.post('/web/start', (req, res) => registerController.startWebRegistration(req, res));
router.post('/web/verify-otp', (req, res) => registerController.verifyOTP(req, res));
router.post('/web/resend-otp', (req, res) => registerController.resendOTP(req, res));

// Session Management
router.get('/session/:session_id', (req, res) => registerController.getSession(req, res));
router.patch('/session/:session_id', (req, res) => registerController.updateSession(req, res));

// Complete Registration
router.post('/complete', (req, res) => registerController.completeRegistration(req, res));

// Hybrid Registration Flow
router.post('/hybrid/initiate', (req, res) => registerController.initiateHybrid(req, res));
router.post('/hybrid/validate-otp', (req, res) => registerController.validateHybridOTP(req, res));

// Status Checks
router.get('/status', (req, res) => registerController.getStatus(req, res));
router.get('/otp-status', (req, res) => registerController.checkOTPStatus(req, res));

export default router;
