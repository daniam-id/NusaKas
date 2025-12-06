import { Response } from 'express';
import { settingsService } from '../services/settings.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class SettingsController {
  async get(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Tidak terautentikasi',
        });
        return;
      }

      const settings = await settingsService.getSettings(user.id);

      if (!settings) {
        res.status(404).json({
          success: false,
          error: 'Pengaturan tidak ditemukan',
        });
        return;
      }

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({
        success: false,
        error: 'Gagal mengambil pengaturan',
      });
    }
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Tidak terautentikasi',
        });
        return;
      }

      const { reminder_time, operational_days, bot_style, use_emoji } = req.body;

      const updateData: Record<string, unknown> = {};
      if (reminder_time !== undefined) updateData.reminder_time = reminder_time;
      if (operational_days !== undefined) updateData.operational_days = operational_days;
      if (bot_style !== undefined) updateData.bot_style = bot_style;
      if (use_emoji !== undefined) updateData.use_emoji = use_emoji;

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          success: false,
          error: 'Tidak ada data yang diupdate',
        });
        return;
      }

      const settings = await settingsService.updateSettings(user.id, updateData);

      res.json({
        success: true,
        message: 'Pengaturan berhasil diupdate',
        data: settings,
      });
    } catch (error) {
      console.error('Update settings error:', error);
      const message = error instanceof Error ? error.message : 'Gagal update pengaturan';
      res.status(400).json({
        success: false,
        error: message,
      });
    }
  }
}

export const settingsController = new SettingsController();
