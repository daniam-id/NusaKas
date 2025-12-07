import { Request, Response } from 'express';
import { registrationService } from '../services/registration.service.js';
import { webRegistrationFlow } from '../services/web-registration.js';
import { hybridRegistrationFlow } from '../services/hybrid-registration.js';
import { sessionManager } from '../services/session-manager.js';
import { registrationCompletionHandler } from '../services/registration-completion.js';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

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

  async startWebRegistration(req: Request, res: Response): Promise<void> {
    try {
      const { wa_number } = req.body;

      if (!wa_number) {
        res.status(400).json({ success: false, error: 'Nomor WhatsApp wajib diisi' });
        return;
      }

      const result = await webRegistrationFlow.startWebRegistration(wa_number);

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'OTP berhasil dikirim',
        data: {
          otp_id: result.otp?.otp_id,
          expires_at: result.otp?.expires_at,
          verification_link: result.otp?.verification_link,
        },
      });
    } catch (error) {
      console.error('Start web registration error:', error);
      res.status(500).json({ success: false, error: 'Gagal memulai registrasi web' });
    }
  }

  async verifyOTP(req: Request, res: Response): Promise<void> {
    try {
      const { wa_number, otp_code } = req.body;

      if (!wa_number || !otp_code) {
        res.status(400).json({ success: false, error: 'Nomor WhatsApp dan kode OTP wajib diisi' });
        return;
      }

      const result = await webRegistrationFlow.verifyAndCreateSession(wa_number, otp_code);

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      const token = registrationCompletionHandler.generateRegistrationToken(wa_number, result.session_id!);

      res.json({
        success: true,
        message: 'Verifikasi berhasil',
        data: {
          session_id: result.session_id,
          registration_token: token,
        },
      });
    } catch (error) {
      console.error('Verify OTP error:', error);
      res.status(500).json({ success: false, error: 'Gagal verifikasi OTP' });
    }
  }

  async resendOTP(req: Request, res: Response): Promise<void> {
    try {
      const { wa_number } = req.body;

      if (!wa_number) {
        res.status(400).json({ success: false, error: 'Nomor WhatsApp wajib diisi' });
        return;
      }

      const result = await webRegistrationFlow.resendOTP(wa_number);

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'OTP baru berhasil dikirim',
        data: {
          expires_at: result.otp?.expires_at,
        },
      });
    } catch (error) {
      console.error('Resend OTP error:', error);
      res.status(500).json({ success: false, error: 'Gagal mengirim ulang OTP' });
    }
  }

  async getSession(req: Request, res: Response): Promise<void> {
    try {
      const { session_id } = req.params;

      if (!session_id) {
        res.status(400).json({ success: false, error: 'Session ID wajib diisi' });
        return;
      }

      const session = await sessionManager.getSession(session_id);

      if (!session) {
        res.status(404).json({ success: false, error: 'Sesi tidak ditemukan' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: session.id,
          current_step: session.current_step,
          status: session.status,
          collected_data: {
            store_name: session.collected_data.store_name || null,
            owner_name: session.collected_data.owner_name || null,
            has_pin: !!session.collected_data.pin_hash,
          },
          expires_at: session.expires_at,
        },
      });
    } catch (error) {
      console.error('Get session error:', error);
      res.status(500).json({ success: false, error: 'Gagal mengambil data sesi' });
    }
  }

  async updateSession(req: Request, res: Response): Promise<void> {
    try {
      const { session_id } = req.params;
      const { store_name, owner_name, pin } = req.body;

      if (!session_id) {
        res.status(400).json({ success: false, error: 'Session ID wajib diisi' });
        return;
      }

      const session = await sessionManager.getSession(session_id);
      if (!session || session.status === 'expired' || session.status === 'completed') {
        res.status(400).json({ success: false, error: 'Sesi tidak valid atau sudah expired' });
        return;
      }

      const updateData: Record<string, string> = {};

      if (store_name) {
        if (store_name.trim().length < 3) {
          res.status(400).json({ success: false, error: 'Nama toko minimal 3 karakter' });
          return;
        }
        updateData.store_name = store_name.trim();
      }

      if (owner_name) {
        if (owner_name.trim().length < 2) {
          res.status(400).json({ success: false, error: 'Nama pemilik minimal 2 karakter' });
          return;
        }
        updateData.owner_name = owner_name.trim();
      }

      if (pin) {
        if (!/^\d{6}$/.test(pin)) {
          res.status(400).json({ success: false, error: 'PIN harus 6 digit angka' });
          return;
        }
        updateData.pin_hash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
      }

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({ success: false, error: 'Tidak ada data untuk diupdate' });
        return;
      }

      const success = await sessionManager.updateSessionData(session_id, updateData);

      if (!success) {
        res.status(500).json({ success: false, error: 'Gagal update data sesi' });
        return;
      }

      const isComplete = await sessionManager.isDataComplete(session_id);

      res.json({
        success: true,
        message: 'Data berhasil diupdate',
        data: {
          is_complete: isComplete,
        },
      });
    } catch (error) {
      console.error('Update session error:', error);
      res.status(500).json({ success: false, error: 'Gagal update sesi' });
    }
  }

  async completeRegistration(req: Request, res: Response): Promise<void> {
    try {
      const { session_id, store_name, owner_name, pin } = req.body;

      if (!session_id) {
        res.status(400).json({ success: false, error: 'Session ID wajib diisi' });
        return;
      }

      if (store_name || owner_name || pin) {
        const updateData: Record<string, string> = {};
        
        if (store_name) updateData.store_name = store_name.trim();
        if (owner_name) updateData.owner_name = owner_name.trim();
        if (pin) {
          if (!/^\d{6}$/.test(pin)) {
            res.status(400).json({ success: false, error: 'PIN harus 6 digit angka' });
            return;
          }
          updateData.pin_hash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
        }

        if (Object.keys(updateData).length > 0) {
          await sessionManager.updateSessionData(session_id, updateData);
        }
      }

      const result = await registrationCompletionHandler.completeFromSession(session_id);

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'Pendaftaran berhasil!',
        data: {
          user: {
            id: result.user?.id,
            wa_number: result.user?.wa_number,
            store_name: result.user?.store_name,
            owner_name: result.user?.owner_name,
          },
          token: result.token,
        },
      });
    } catch (error) {
      console.error('Complete registration error:', error);
      res.status(500).json({ success: false, error: 'Gagal menyelesaikan pendaftaran' });
    }
  }

  async initiateHybrid(req: Request, res: Response): Promise<void> {
    try {
      const { wa_number, direction } = req.body;

      if (!wa_number) {
        res.status(400).json({ success: false, error: 'Nomor WhatsApp wajib diisi' });
        return;
      }

      let result;
      if (direction === 'web_to_whatsapp') {
        result = await hybridRegistrationFlow.initiateWebToWhatsApp(wa_number);
      } else {
        result = await hybridRegistrationFlow.initiateWhatsAppToWeb(wa_number);
      }

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'Link hybrid berhasil dibuat',
        data: {
          link: result.link,
          otp_code: result.otp?.otp_code,
          expires_at: result.otp?.expires_at,
        },
      });
    } catch (error) {
      console.error('Initiate hybrid error:', error);
      res.status(500).json({ success: false, error: 'Gagal membuat link hybrid' });
    }
  }

  async validateHybridOTP(req: Request, res: Response): Promise<void> {
    try {
      const { wa_number, otp_code, target_platform } = req.body;

      if (!wa_number || !otp_code) {
        res.status(400).json({ success: false, error: 'Nomor WhatsApp dan kode OTP wajib diisi' });
        return;
      }

      const result = await hybridRegistrationFlow.validateHybridOTP(
        wa_number,
        otp_code,
        target_platform || 'web'
      );

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'Validasi berhasil',
        data: {
          session_id: result.session?.id,
          current_step: result.session?.current_step,
          collected_data: result.session?.collected_data,
        },
      });
    } catch (error) {
      console.error('Validate hybrid OTP error:', error);
      res.status(500).json({ success: false, error: 'Gagal validasi OTP hybrid' });
    }
  }

  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { wa_number } = req.query;

      if (!wa_number || typeof wa_number !== 'string') {
        res.status(400).json({ success: false, error: 'Nomor WhatsApp wajib diisi' });
        return;
      }

      const status = await registrationCompletionHandler.getCompletionStatus(wa_number);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Get status error:', error);
      res.status(500).json({ success: false, error: 'Gagal mengambil status' });
    }
  }

  async checkOTPStatus(req: Request, res: Response): Promise<void> {
    try {
      const { wa_number } = req.query;

      if (!wa_number || typeof wa_number !== 'string') {
        res.status(400).json({ success: false, error: 'Nomor WhatsApp wajib diisi' });
        return;
      }

      const status = await webRegistrationFlow.checkOTPStatus(wa_number);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Check OTP status error:', error);
      res.status(500).json({ success: false, error: 'Gagal mengecek status OTP' });
    }
  }
}

export const registerController = new RegisterController();
