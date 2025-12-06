import { Request, Response } from 'express';
import { registrationService } from '../services/registration.service.js';

export class RegisterController {
  async start(req: Request, res: Response): Promise<void> {
    try {
      const { wa_number } = req.body;

      if (!wa_number) {
        res.status(400).json({
          success: false,
          error: 'Nomor WhatsApp wajib diisi',
        });
        return;
      }

      const result = await registrationService.startVerification(wa_number);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.message,
        });
        return;
      }

      res.json({
        success: true,
        message: result.message,
        data: {
          wa_link: result.wa_link,
        },
      });
    } catch (error) {
      console.error('Register start error:', error);
      res.status(500).json({
        success: false,
        error: 'Gagal memulai proses registrasi',
      });
    }
  }
}

export const registerController = new RegisterController();
