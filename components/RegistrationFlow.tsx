import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { registerApi } from '../services/api';
import {
  Loader2,
  Phone,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  Store,
  User,
  MessageCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  Shield,
} from 'lucide-react';

type Step = 'phone' | 'otp' | 'form' | 'complete';

interface RegistrationFlowProps {
  onComplete?: () => void;
  initialPhone?: string;
}

export const RegistrationFlow: React.FC<RegistrationFlowProps> = ({
  onComplete,
  initialPhone,
}) => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState(initialPhone || '');
  const [otp, setOtp] = useState('');
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const otpParam = searchParams.get('otp');
    const phoneParam = searchParams.get('phone');
    
    if (otpParam && phoneParam) {
      setPhone(phoneParam);
      setOtp(otpParam);
      handleAutoVerify(phoneParam, otpParam);
    }
  }, [searchParams]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('62')) return digits;
    if (digits.startsWith('0')) return '62' + digits.slice(1);
    return digits;
  };

  const handleAutoVerify = async (phoneNumber: string, otpCode: string) => {
    setIsLoading(true);
    setError('');

    try {
      const res = await registerApi.verifyOTP(phoneNumber, otpCode);
      if (res.data.success) {
        setSessionId(res.data.data.session_id);
        setStep('form');
        setProgress(66);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Kode OTP tidak valid atau sudah expired');
      setStep('otp');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const formattedPhone = formatPhone(phone);
      const res = await registerApi.startWebRegistration(formattedPhone);

      if (res.data.success) {
        setExpiresAt(new Date(res.data.data.expires_at));
        setStep('otp');
        setProgress(33);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal mengirim OTP. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const formattedPhone = formatPhone(phone);
      const res = await registerApi.verifyOTP(formattedPhone, otp);

      if (res.data.success) {
        setSessionId(res.data.data.session_id);
        setStep('form');
        setProgress(66);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Kode OTP tidak valid');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setIsLoading(true);

    try {
      const formattedPhone = formatPhone(phone);
      const res = await registerApi.resendOTP(formattedPhone);

      if (res.data.success) {
        setExpiresAt(new Date(res.data.data.expires_at));
        setOtp('');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal mengirim ulang OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (pin.length !== 6) {
      setError('PIN harus 6 digit');
      return;
    }

    if (pin !== confirmPin) {
      setError('Konfirmasi PIN tidak cocok');
      return;
    }

    if (!storeName.trim() || storeName.trim().length < 3) {
      setError('Nama toko minimal 3 karakter');
      return;
    }

    setIsLoading(true);

    try {
      const res = await registerApi.completeRegistration(sessionId!, {
        store_name: storeName.trim(),
        owner_name: ownerName.trim() || undefined,
        pin,
      });

      if (res.data.success) {
        login(res.data.data.token, res.data.data.user as any);
        setStep('complete');
        setProgress(100);
        
        setTimeout(() => {
          if (onComplete) {
            onComplete();
          } else {
            navigate('/');
          }
        }, 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal menyelesaikan pendaftaran');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueViaWhatsApp = async () => {
    try {
      const formattedPhone = formatPhone(phone);
      const res = await registerApi.initiateHybrid(formattedPhone, 'web_to_whatsapp');

      if (res.data.success) {
        window.open(res.data.data.link, '_blank');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal membuat link WhatsApp');
    }
  };

  const renderProgressBar = () => (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-gray-500 mb-2">
        <span className={step === 'phone' ? 'text-emerald-600 font-medium' : ''}>Nomor HP</span>
        <span className={step === 'otp' ? 'text-emerald-600 font-medium' : ''}>Verifikasi</span>
        <span className={step === 'form' ? 'text-emerald-600 font-medium' : ''}>Data Toko</span>
        <span className={step === 'complete' ? 'text-emerald-600 font-medium' : ''}>Selesai</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );

  const renderPhoneStep = () => (
    <form onSubmit={handleStartRegistration}>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
          <Phone className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Daftar Akun Baru</h2>
        <p className="text-sm text-gray-500 mt-1">Masukkan nomor WhatsApp untuk memulai</p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nomor WhatsApp
        </label>
        <div className="relative">
          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08123456789"
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            required
            autoFocus
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !phone}
        className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            Kirim Kode OTP
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </button>
    </form>
  );

  const renderOTPStep = () => (
    <form onSubmit={handleVerifyOTP}>
      <div className="mb-4">
        <button
          type="button"
          onClick={() => { setStep('phone'); setError(''); setProgress(0); }}
          className="text-sm text-emerald-600 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Ganti nomor
        </button>
      </div>

      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
          <Shield className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Verifikasi OTP</h2>
        <p className="text-sm text-gray-500 mt-1">
          Masukkan 6 digit kode yang dikirim ke <span className="font-medium">{phone}</span>
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Kode OTP
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          maxLength={6}
          className="w-full py-4 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-center text-3xl tracking-[0.5em] font-mono"
          required
          autoFocus
        />
        {expiresAt && (
          <div className="flex items-center justify-center gap-1 mt-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Berlaku sampai {expiresAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <button
          type="submit"
          disabled={isLoading || otp.length !== 6}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Verifikasi
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleResendOTP}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className="h-5 w-5" />
          Kirim Ulang OTP
        </button>

        <button
          type="button"
          onClick={handleContinueViaWhatsApp}
          className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-3 px-4 rounded-xl font-medium hover:bg-[#20BD5A] transition-colors"
        >
          <MessageCircle className="h-5 w-5" />
          Lanjutkan via WhatsApp
        </button>
      </div>
    </form>
  );

  const renderFormStep = () => (
    <form onSubmit={handleCompleteRegistration}>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
          <Store className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Lengkapi Data Toko</h2>
        <p className="text-sm text-gray-500 mt-1">Isi informasi toko untuk menyelesaikan pendaftaran</p>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nama Toko <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Store className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Contoh: Toko Sembako Makmur"
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              required
              autoFocus
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nama Pemilik (opsional)
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Buat PIN (6 digit) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="******"
              maxLength={6}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-center text-xl tracking-widest font-mono"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Konfirmasi PIN <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="******"
              maxLength={6}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-center text-xl tracking-widest font-mono"
              required
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !storeName || pin.length !== 6 || confirmPin.length !== 6}
        className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            Selesaikan Pendaftaran
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </button>
    </form>
  );

  const renderCompleteStep = () => (
    <div className="text-center py-8">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 mb-6">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Pendaftaran Berhasil!</h2>
      <p className="text-gray-500 mb-6">
        Selamat datang di NusaKas. Akun Anda sudah aktif.
      </p>
      <div className="flex items-center justify-center gap-2 text-emerald-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Mengalihkan ke dashboard...</span>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-md mx-auto">
      {step !== 'complete' && renderProgressBar()}
      
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
        {step === 'phone' && renderPhoneStep()}
        {step === 'otp' && renderOTPStep()}
        {step === 'form' && renderFormStep()}
        {step === 'complete' && renderCompleteStep()}
      </div>

      {step === 'phone' && (
        <p className="text-center text-sm text-gray-500 mt-4">
          Sudah punya akun?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-emerald-600 hover:underline font-medium"
          >
            Masuk di sini
          </button>
        </p>
      )}
    </div>
  );
};

export default RegistrationFlow;
