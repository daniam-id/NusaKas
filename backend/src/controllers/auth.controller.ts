import { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';

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
      const { wa_number } = req.body;

      if (!wa_number) {
        res.status(400).json({
          success: false,
          error: 'WhatsApp number is required',
        });
        return;
      }

      const { code, expiresAt } = await authService.createOtp(wa_number);

      // Send OTP via WhatsApp if socket is available
      if (global.waSock) {
        const normalizedNumber = wa_number.replace(/\D/g, '').replace(/^0/, '62');
        const jid = `${normalizedNumber}@s.whatsapp.net`;
        
        try {
          await global.waSock.sendMessage(jid, {
            text: `🔐 *Kode OTP NusaKas*\n\nKode verifikasi Anda: *${code}*\n\nBerlaku selama 5 menit.\nJangan bagikan kode ini kepada siapapun.`,
          });
        } catch (waError) {
          console.error('Failed to send OTP via WhatsApp:', waError);
          // Continue anyway - OTP is still valid
        }
      } else {
        // Development mode: log OTP to console
        console.log(`[DEV] OTP for ${wa_number}: ${code}`);
      }

      res.json({
        success: true,
        message: 'OTP sent to WhatsApp',
        data: {
          wa_number,
          expires_at: expiresAt.toISOString(),
          // In development, include OTP for testing
          ...(process.env.NODE_ENV !== 'production' && { otp: code }),
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send OTP',
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
}

export const authController = new AuthController();
