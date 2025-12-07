import { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { registrationService } from '../services/registration.service.js';

// Global WhatsApp socket reference (will be set by WhatsApp bot module)
declare global {
  // eslint-disable-next-line no-var
  var waSock: {
    sendMessage: (jid: string, content: { text: string }) => Promise<void>;
  } | null;
}

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { wa_number, pin } = req.body;

      if (!wa_number) {
        res.status(400).json({
          success: false,
          error: 'WhatsApp number is required',
        });
        return;
      }

      // Check if user exists
      const userCheck = await authService.checkUserRegistration(wa_number);
      
      if (userCheck.isRegistered && pin) {
        // Existing user with PIN - use PIN authentication
        const result = await authService.loginWithPin(wa_number, pin);
        
        if (!result.valid) {
          res.status(401).json({
            success: false,
            error: result.error || 'PIN salah',
          });
          return;
        }

        res.json({
          success: true,
          message: 'Login berhasil',
          data: {
            token: result.token,
            user: result.user,
            auth_method: 'pin'
          },
        });
        return;
      } else if (userCheck.isRegistered && !pin) {
        // Existing user but no PIN provided
        res.json({
          success: true,
          message: 'Silakan masukkan PIN untuk login',
          data: {
            requires_pin: true,
            user: userCheck.user
          },
        });
        return;
      }

      // New user - generate OTP and return WhatsApp deep link
      const result = await registrationService.startVerification(wa_number);

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: result.message,
        });
        return;
      }

      res.json({
        success: true,
        message: result.message,
        data: {
          wa_number: result.wa_number,
          wa_link: result.wa_link,
          expires_at: result.expires_at,
          is_new_user: true,
          // In development, include OTP for testing
          ...(process.env.NODE_ENV !== 'production' && { otp: result.otp_code }),
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process login',
      });
    }
  }

  async verify(req: Request, res: Response): Promise<void> {
    try {
      const { wa_number, code } = req.body;

      if (!wa_number || !code) {
        res.status(400).json({
          success: false,
          error: 'WhatsApp number and OTP code are required',
        });
        return;
      }

      const result = await authService.verifyOtp(wa_number, code);

      if (!result.valid) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired OTP',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Authentication successful',
        data: {
          token: result.token,
          user: result.user,
        },
      });
    } catch (error) {
      console.error('Verify error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify OTP',
      });
    }
  }

  async me(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
        return;
      }

      res.json({
        success: true,
        data: { user },
      });
    } catch (error) {
      console.error('Me error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user',
      });
    }
  }

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
        return;
      }

      // Generate new token with fresh expiration
      const newToken = authService.generateToken(user);

      res.json({
        success: true,
        data: { 
          token: newToken,
          user,
        },
      });
    } catch (error) {
      console.error('Refresh error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to refresh token',
      });
    }
  }

  async checkUser(req: Request, res: Response): Promise<void> {
    try {
      const { wa_number } = req.body;

      if (!wa_number) {
        res.status(400).json({
          success: false,
          error: 'WhatsApp number is required',
        });
        return;
      }

      const result = await authService.checkUserRegistration(wa_number);

      res.json({
        success: true,
        data: {
          is_registered: result.isRegistered,
        },
      });
    } catch (error) {
      console.error('Check user error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check user',
      });
    }
  }

  async checkVerificationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { wa_number } = req.body;

      if (!wa_number) {
        res.status(400).json({
          success: false,
          error: 'WhatsApp number is required',
        });
        return;
      }

      const result = await registrationService.checkVerificationStatus(wa_number);

      res.json({
        success: result.success,
        message: result.message,
        data: result.success ? {
          token: result.token,
          user: result.user,
          wa_number: result.wa_number,
        } : undefined,
      });
    } catch (error) {
      console.error('Check verification status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check verification status',
      });
    }
  }

  async loginWithPin(req: Request, res: Response): Promise<void> {
    try {
      const { wa_number, pin } = req.body;

      if (!wa_number || !pin) {
        res.status(400).json({
          success: false,
          error: 'WhatsApp number and PIN are required',
        });
        return;
      }

      // Validate PIN format
      if (!/^\d{4,6}$/.test(pin)) {
        res.status(400).json({
          success: false,
          error: 'PIN must be 4-6 digits',
        });
        return;
      }

      const result = await authService.loginWithPin(wa_number, pin);

      if (!result.valid) {
        res.status(401).json({
          success: false,
          error: result.error || 'PIN salah',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token: result.token,
          user: result.user,
        },
      });
    } catch (error) {
      console.error('Login with PIN error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to login',
      });
    }
  }

  async verifyOtpForRegistration(req: Request, res: Response): Promise<void> {
    try {
      const { wa_number, code } = req.body;

      if (!wa_number || !code) {
        res.status(400).json({
          success: false,
          error: 'WhatsApp number and OTP code are required',
        });
        return;
      }

      const result = await authService.verifyOtpForRegistration(wa_number, code);

      if (!result.valid) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired OTP',
        });
        return;
      }

      res.json({
        success: true,
        message: 'OTP verified. Please complete registration.',
        data: {
          temp_token: result.tempToken,
        },
      });
    } catch (error) {
      console.error('Verify OTP for registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify OTP',
      });
    }
  }

  async completeRegistration(req: Request, res: Response): Promise<void> {
    try {
      const { temp_token, store_name, pin, owner_name } = req.body;

      if (!temp_token || !store_name || !pin) {
        res.status(400).json({
          success: false,
          error: 'Temporary token, store name, and PIN are required',
        });
        return;
      }

      // Verify temporary token
      const tokenResult = authService.verifyRegistrationToken(temp_token);
      if (!tokenResult.valid || !tokenResult.waNumber) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired registration token. Please start registration again.',
        });
        return;
      }

      const result = await authService.completeRegistration(
        tokenResult.waNumber,
        store_name,
        pin,
        owner_name
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to complete registration',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Registration completed successfully',
        data: {
          token: result.token,
          user: result.user,
        },
      });
    } catch (error) {
      console.error('Complete registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete registration',
      });
    }
  }
}

export const authController = new AuthController();
