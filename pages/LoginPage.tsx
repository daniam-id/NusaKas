import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { Loader2, Phone, KeyRound, ArrowRight, ArrowLeft, Leaf, Store, User, MessageCircle, RefreshCw } from 'lucide-react';

type Step = 'phone' | 'pin' | 'otp' | 'setup';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  
  // New OTP flow state
  const [waLink, setWaLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [hasSentOtp, setHasSentOtp] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('62')) return digits;
    if (digits.startsWith('0')) return '62' + digits.slice(1);
    return digits;
  };

  const resetForm = () => {
    setPin('');
    setOtp('');
    setStoreName('');
    setOwnerName('');
    setNewPin('');
    setConfirmPin('');
    setTempToken('');
    setError('');
    setWaLink(null);
    setExpiresAt(null);
    setIsPolling(false);
    setHasSentOtp(false);
    stopPolling();
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, []);

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // Start polling for verification status
  const startPolling = (formattedPhone: string) => {
    setIsPolling(true);
    stopPolling(); // Clear any existing interval
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await authApi.checkVerificationStatus(formattedPhone);
        
        if (res.data.success && res.data.data) {
          // Verification successful!
          stopPolling();
          setIsPolling(false);
          
          // User is verified - go to setup step
          setTempToken('verified'); // Mark as verified
          setStep('setup');
        }
      } catch (err) {
        console.error('Polling error:', err);
        // Continue polling unless it's a critical error
      }
    }, 3000); // Poll every 3 seconds
  };

  // Step 1: Check if user is registered
  const handleCheckUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const formattedPhone = formatPhone(phone);
      const res = await authApi.checkUser(formattedPhone);

      if (res.data.success) {
        if (res.data.data.is_registered) {
          // User exists with PIN - show PIN input
          setStep('pin');
        } else {
          // New user - get OTP and WhatsApp deep link
          const otpRes = await authApi.sendOtp(formattedPhone);
          if (otpRes.data.success) {
            setWaLink(otpRes.data.data.wa_link);
            setExpiresAt(new Date(otpRes.data.data.expires_at));
            setStep('otp');
          }
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal memverifikasi nomor. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle WhatsApp button click - open link and start polling
  const handleSendOtpViaWhatsApp = () => {
    if (waLink) {
      setHasSentOtp(true);
      window.open(waLink, '_blank');
      // Start polling for verification
      const formattedPhone = formatPhone(phone);
      startPolling(formattedPhone);
    }
  };

  // Resend OTP - get new code
  const handleResendOtp = async () => {
    setError('');
    setIsLoading(true);
    stopPolling();
    setHasSentOtp(false);

    try {
      const formattedPhone = formatPhone(phone);
      const otpRes = await authApi.sendOtp(formattedPhone);
      if (otpRes.data.success) {
        setWaLink(otpRes.data.data.wa_link);
        setExpiresAt(new Date(otpRes.data.data.expires_at));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal mengirim ulang OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // Login with PIN (for registered users)
  const handleLoginWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const formattedPhone = formatPhone(phone);
      const res = await authApi.login(formattedPhone, pin);

      if (res.data.success) {
        login(res.data.data.token, res.data.data.user);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'PIN salah. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP for registration
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const formattedPhone = formatPhone(phone);
      const res = await authApi.verifyOtp(formattedPhone, otp);

      if (res.data.success) {
        setTempToken(res.data.data.temp_token);
        setStep('setup');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Kode OTP tidak valid.');
    } finally {
      setIsLoading(false);
    }
  };

  // Complete registration with store name and PIN
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate PIN
    if (!/^\d{4,6}$/.test(newPin)) {
      setError('PIN harus 4-6 digit angka');
      return;
    }

    if (newPin !== confirmPin) {
      setError('Konfirmasi PIN tidak cocok');
      return;
    }

    if (!storeName.trim()) {
      setError('Nama toko wajib diisi');
      return;
    }

    setIsLoading(true);

    try {
      const res = await authApi.completeRegistration(tempToken, storeName.trim(), newPin, ownerName.trim() || undefined);

      if (res.data.success) {
        login(res.data.data.token, res.data.data.user);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal menyelesaikan registrasi.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderPhoneStep = () => (
    <form onSubmit={handleCheckUser}>
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
        className="w-full flex items-center justify-center gap-2 bg-[#31694E] text-white py-3 px-4 rounded-xl font-semibold hover:bg-[#27543f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            Lanjut
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </button>
    </form>
  );

  const renderPinStep = () => (
    <form onSubmit={handleLoginWithPin}>
      <div className="mb-4">
        <button
          type="button"
          onClick={() => { setStep('phone'); resetForm(); }}
          className="text-sm text-emerald-600 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Ganti nomor
        </button>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Masukkan PIN
        </label>
        <p className="text-sm text-gray-500 mb-4">
          Masuk dengan PIN untuk <span className="font-medium">{phone}</span>
        </p>
        <div className="relative">
          <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="****"
            maxLength={6}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-center text-2xl tracking-widest font-mono"
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
        disabled={isLoading || pin.length < 4}
        className="w-full flex items-center justify-center gap-2 bg-[#31694E] text-white py-3 px-4 rounded-xl font-semibold hover:bg-[#27543f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            Masuk
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </button>
    </form>
  );

  const renderOtpStep = () => (
    <div>
      <div className="mb-4">
        <button
          type="button"
          onClick={() => { setStep('phone'); resetForm(); }}
          className="text-sm text-emerald-600 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Ganti nomor
        </button>
      </div>

      <div className="mb-6">
        <div className="text-center mb-4">

          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Verifikasi via WhatsApp
          </h3>
          <p className="text-sm text-gray-500">
            Klik tombol di bawah untuk mengirim kode OTP ke bot NusaKas via WhatsApp
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Nomor: <span className="font-medium">{phone}</span>
          </p>
        </div>

        {/* WhatsApp Send Button */}
        {!hasSentOtp ? (
          <button
            type="button"
            onClick={handleSendOtpViaWhatsApp}
            disabled={!waLink || isLoading}
            className="w-full flex items-center justify-center gap-3 bg-[#25D366] text-white py-4 px-4 rounded-xl font-semibold hover:bg-[#20BD5A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            <MessageCircle className="h-6 w-6" />
            Kirim OTP via WhatsApp
          </button>
        ) : (
          <div className="space-y-4">
            {/* Polling status */}
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-3">
                {isPolling ? (
                  <>
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Menunggu verifikasi...</p>
                      <p className="text-xs text-blue-600">Kirim pesan OTP ke bot WhatsApp, lalu kembali ke sini</p>
                    </div>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">WhatsApp terbuka</p>
                      <p className="text-xs text-blue-600">Kirim pesan OTP, verifikasi akan otomatis</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Resend button */}
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="h-5 w-5" />
                  Minta Kode OTP Baru
                </>
              )}
            </button>

            {/* Re-open WhatsApp button */}
            <button
              type="button"
              onClick={handleSendOtpViaWhatsApp}
              className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-3 px-4 rounded-xl font-medium hover:bg-[#20BD5A] transition-colors"
            >
              <MessageCircle className="h-5 w-5" />
              Buka WhatsApp Lagi
            </button>
          </div>
        )}



        {/* Expiry warning */}
        {expiresAt && (
          <p className="mt-4 text-xs text-gray-500 text-center">
            Kode berlaku sampai {expiresAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Manual OTP entry fallback */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center mb-3">
          Atau masukkan kode OTP manual:
        </p>
        <form onSubmit={handleVerifyOtp} className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="1234"
            maxLength={6}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-center text-lg tracking-widest font-mono"
          />
          <button
            type="submit"
            disabled={isLoading || otp.length < 4}
            className="px-4 py-2 bg-[#31694E] text-white rounded-lg font-medium hover:bg-[#27543f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
          </button>
        </form>
      </div>
    </div>
  );

  const renderSetupStep = () => (
    <form onSubmit={handleCompleteRegistration}>
      <div className="mb-4">
        <button
          type="button"
          onClick={() => { setStep('phone'); resetForm(); }}
          className="text-sm text-emerald-600 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Mulai ulang
        </button>
      </div>

      <div className="mb-4 p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">
        OTP terverifikasi! Lengkapi data untuk membuat akun.
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
              placeholder="Contoh: Toko Sejahtera"
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              required
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
              placeholder="Contoh: Pak Budi"
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Buat PIN (4-6 digit) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="****"
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
              placeholder="****"
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
        disabled={isLoading || !storeName || newPin.length < 4 || confirmPin.length < 4}
        className="w-full flex items-center justify-center gap-2 bg-[#31694E] text-white py-3 px-4 rounded-xl font-semibold hover:bg-[#27543f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            Daftar & Masuk
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </button>
    </form>
  );

  const getStepTitle = () => {
    switch (step) {
      case 'phone':
        return 'Masuk ke dashboard';
      case 'pin':
        return 'Masukkan PIN';
      case 'otp':
        return 'Verifikasi OTP';
      case 'setup':
        return 'Lengkapi Data';
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: 'url(/images/background.webp)',
      }}
    >
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-black/20"></div>

      {/* Top-left Logo */}
      <div className="absolute top-6 left-6 z-10">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/90 backdrop-blur-sm shadow-sm">
          <Leaf className="h-6 w-6 text-emerald-700" />
        </div>
      </div>

      {/* Main Login Card */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold tracking-tight text-white drop-shadow-lg mb-2">
              Nusa<span className="text-emerald-400">Kas</span>
            </h1>
            <p className="text-white/90">{getStepTitle()}</p>
          </div>

          {/* Login Card */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8">
            {step === 'phone' && renderPhoneStep()}
            {step === 'pin' && renderPinStep()}
            {step === 'otp' && renderOtpStep()}
            {step === 'setup' && renderSetupStep()}
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-white/80 mt-6">
            {step === 'phone'
              ? 'Masukkan nomor WhatsApp untuk masuk atau daftar'
              : step === 'pin'
              ? 'Lupa PIN? Hubungi admin NusaKas.'
              : step === 'otp'
              ? 'Klik tombol hijau untuk mengirim OTP via WhatsApp'
              : 'PIN akan digunakan untuk login selanjutnya.'}
          </p>
        </div>
      </div>
    </div>
  );
};
