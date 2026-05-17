import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Smartphone, Clock, CheckCircle, Copy, Eye, EyeOff } from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type TwoFAStep = 'idle' | 'enrolling' | 'verifying' | 'success';

interface EnrolledFactor {
  id: string;
  type: string;
  friendly_name?: string;
  status: string;
}

// Six individual digit input boxes
const OTPInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const next = value.slice(0, idx) + value.slice(idx + 1);
        onChange(next.padEnd(idx, ''));
      } else if (idx > 0) {
        inputRefs.current[idx - 1]?.focus();
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    if (!char) return;
    const arr = digits.map((d, i) => (i === idx ? char : d));
    onChange(arr.join(''));
    if (idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    const nextIdx = Math.min(pasted.length, 5);
    inputRefs.current[nextIdx]?.focus();
  };

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={el => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKeyDown(e, i)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          style={{
            width: 48,
            height: 56,
            textAlign: 'center',
            fontSize: 24,
            fontWeight: 700,
            fontFamily: 'Manrope, sans-serif',
            color: '#0F1F3D',
            border: `1.5px solid ${digit ? '#00D4FF' : '#E5E7EB'}`,
            borderRadius: 8,
            background: 'white',
            outline: 'none',
            transition: 'border-color 0.15s',
            WebkitAppearance: 'none',
          }}
        />
      ))}
    </div>
  );
};

const CMSecurity = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [twoFAStep, setTwoFAStep] = useState<TwoFAStep>('idle');
  const [enrolledFactors, setEnrolledFactors] = useState<EnrolledFactor[]>([]);
  const [factorsLoading, setFactorsLoading] = useState(true);

  // Enrollment state
  const [enrollData, setEnrollData] = useState<{
    id: string;
    qrCode: string;
    secret: string;
    uri: string;
  } | null>(null);
  const [enrollCode, setEnrollCode] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showBackupInfo, setShowBackupInfo] = useState(false);

  const is2FAEnabled = enrolledFactors.some(f => f.status === 'verified');

  useEffect(() => {
    loadFactors();
  }, []);

  const loadFactors = async () => {
    setFactorsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setEnrolledFactors(data?.all || []);
    } catch (e) {
      console.error('Failed to load MFA factors:', e);
    } finally {
      setFactorsLoading(false);
    }
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'TenisX',
        friendlyName: 'Authenticator App',
      });
      if (error) throw error;
      setEnrollData({
        id: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      });
      setTwoFAStep('enrolling');
    } catch (e: any) {
      toast({ title: 'Setup failed', description: e.message || 'Could not start 2FA setup.', variant: 'destructive' });
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerifyEnroll = async () => {
    if (!enrollData || enrollCode.length !== 6) return;
    setVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollData.id,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollData.id,
        challengeId: challengeData.id,
        code: enrollCode,
      });
      if (verifyError) throw verifyError;

      setTwoFAStep('success');
      await loadFactors();
    } catch (e: any) {
      toast({ title: 'Verification failed', description: e.message || 'Invalid code. Please try again.', variant: 'destructive' });
      setEnrollCode('');
    } finally {
      setVerifying(false);
    }
  };

  const handleDisable = async () => {
    const factor = enrolledFactors.find(f => f.status === 'verified');
    if (!factor) return;
    setDisabling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
      toast({ title: '2FA disabled', description: 'Two-factor authentication has been removed.' });
      setEnrolledFactors([]);
      setTwoFAStep('idle');
    } catch (e: any) {
      toast({ title: 'Failed to disable', description: e.message || 'Could not remove 2FA.', variant: 'destructive' });
    } finally {
      setDisabling(false);
    }
  };

  const copySecret = () => {
    if (enrollData?.secret) {
      navigator.clipboard.writeText(enrollData.secret);
      toast({ title: 'Copied', description: 'Secret key copied to clipboard.' });
    }
  };

  const renderTwoFASetup = () => {
    if (twoFAStep === 'enrolling' && enrollData) {
      return (
        <div
          className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden"
          style={{ boxShadow: '0px 2px 8px rgba(15,31,61,0.04), 0px 12px 32px rgba(15,31,61,0.04)' }}
        >
          <div className="p-5">
            <div className="text-[15px] font-bold mb-1" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
              Scan QR Code
            </div>
            <div className="text-[13px] mb-5" style={{ color: '#4B5563', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
              Open your authenticator app (Google Authenticator, Authy, etc.) and scan this QR code.
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-5">
              <div
                className="p-3 rounded-2xl"
                style={{ background: 'white', boxShadow: '0px 4px 16px rgba(15,31,61,0.08)', border: '1px solid rgba(15,31,61,0.08)' }}
              >
                <img
                  src={enrollData.qrCode}
                  alt="2FA QR Code"
                  style={{ width: 180, height: 180, display: 'block' }}
                />
              </div>
            </div>

            {/* Manual entry toggle */}
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="w-full text-center mb-4"
              style={{ fontSize: 13, color: '#00D4FF', fontFamily: 'Inter, sans-serif', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              {showSecret ? 'Hide' : 'Can\'t scan? Enter key manually'}
            </button>

            {showSecret && (
              <div
                className="rounded-xl p-4 mb-5 flex items-center gap-3"
                style={{ background: '#F9FAFB', border: '1px solid rgba(15,31,61,0.08)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase font-semibold mb-1" style={{ color: '#8892A4', letterSpacing: '0.08em' }}>
                    Manual Entry Key
                  </div>
                  <div
                    className="font-mono text-[14px] font-bold tracking-wider"
                    style={{ color: '#0F1F3D', wordBreak: 'break-all' }}
                  >
                    {showSecret ? enrollData.secret : '•'.repeat(enrollData.secret.length)}
                  </div>
                </div>
                <button onClick={copySecret} className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#E0F9FF' }}>
                  <Copy className="h-4 w-4" style={{ color: '#0369A1' }} />
                </button>
              </div>
            )}

            {/* Verification code input */}
            <div className="text-[13px] font-semibold mb-3 text-center" style={{ color: '#0F1F3D', fontFamily: 'Inter, sans-serif' }}>
              Enter the 6-digit code from your app
            </div>
            <OTPInput value={enrollCode} onChange={setEnrollCode} disabled={verifying} />

            <button
              onClick={handleVerifyEnroll}
              disabled={enrollCode.length !== 6 || verifying}
              className="w-full mt-6 rounded-[12px] text-white font-bold active:scale-[0.97] transition-transform"
              style={{
                minHeight: 52,
                background: (enrollCode.length !== 6 || verifying) ? '#8892A4' : '#0F1F3D',
                fontSize: 16,
                fontFamily: 'Manrope, sans-serif',
                border: 'none',
                cursor: enrollCode.length !== 6 || verifying ? 'not-allowed' : 'pointer',
              }}
            >
              {verifying ? 'Verifying…' : 'Verify & Enable 2FA'}
            </button>
            <button
              onClick={() => { setTwoFAStep('idle'); setEnrollData(null); setEnrollCode(''); }}
              className="w-full mt-3 text-center"
              style={{ fontSize: 14, color: '#8892A4', fontFamily: 'Inter, sans-serif', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    if (twoFAStep === 'success') {
      return (
        <div
          className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-center"
          style={{ boxShadow: '0px 2px 8px rgba(15,31,61,0.04), 0px 12px 32px rgba(15,31,61,0.04)' }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: '#E0F9FF' }}
          >
            <CheckCircle className="h-7 w-7" style={{ color: '#0369A1' }} />
          </div>
          <div className="text-[18px] font-bold mb-2" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
            2FA Enabled!
          </div>
          <div className="text-[14px] mb-5" style={{ color: '#4B5563', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
            Your account is now protected with two-factor authentication. You'll be asked for a code each time you sign in.
          </div>

          {/* Backup info */}
          <button
            onClick={() => setShowBackupInfo(!showBackupInfo)}
            className="w-full rounded-xl py-3 mb-3 font-semibold text-[14px] transition-colors"
            style={{
              background: '#F9FAFB',
              border: '1px solid rgba(15,31,61,0.08)',
              color: '#0F1F3D',
              fontFamily: 'Inter, sans-serif',
              cursor: 'pointer',
            }}
          >
            {showBackupInfo ? 'Hide' : 'View'} recovery key
          </button>

          {showBackupInfo && enrollData && (
            <div
              className="rounded-xl p-4 mb-4 text-left"
              style={{ background: '#F9FAFB', border: '1px solid rgba(15,31,61,0.08)' }}
            >
              <div className="text-[11px] uppercase font-semibold mb-2" style={{ color: '#8892A4', letterSpacing: '0.08em' }}>
                Save this key somewhere safe
              </div>
              <div className="font-mono text-[13px] font-bold tracking-wider mb-3" style={{ color: '#0F1F3D', wordBreak: 'break-all' }}>
                {enrollData.secret}
              </div>
              <button onClick={copySecret} className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: '#00D4FF', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Copy className="h-3.5 w-3.5" />
                Copy key
              </button>
            </div>
          )}

          <button
            onClick={() => setTwoFAStep('idle')}
            className="w-full rounded-[12px] text-white font-bold"
            style={{ minHeight: 48, background: '#0F1F3D', fontSize: 15, fontFamily: 'Manrope, sans-serif', border: 'none', cursor: 'pointer' }}
          >
            Done
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <CMHeader compact>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <span className="text-xl font-extrabold">Security</span>
        </div>
      </CMHeader>

      <div className="px-4 pt-4 pb-24 space-y-4">

        {/* 2FA Card */}
        {twoFAStep === 'enrolling' || twoFAStep === 'success' ? (
          renderTwoFASetup()
        ) : (
          <div
            className="bg-white rounded-2xl p-5 border border-[#E5E7EB]"
            style={{ boxShadow: '0px 2px 8px rgba(15,31,61,0.04), 0px 12px 32px rgba(15,31,61,0.04)' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3">
                <div
                  className="p-2.5 rounded-xl flex-shrink-0"
                  style={{ background: is2FAEnabled ? '#E0F9FF' : '#F9FAFB' }}
                >
                  <Shield className="h-4 w-4" style={{ color: is2FAEnabled ? '#0369A1' : '#4B5563' }} />
                </div>
                <div>
                  <p className="font-bold text-[15px]" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
                    Two-Factor Authentication
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>
                    Add an extra layer of security to your account
                  </p>
                </div>
              </div>
              {!factorsLoading && (
                <Switch
                  checked={is2FAEnabled}
                  onCheckedChange={(checked) => {
                    if (checked && !is2FAEnabled) handleEnroll();
                    else if (!checked && is2FAEnabled) handleDisable();
                  }}
                  disabled={enrolling || disabling}
                  className="data-[state=checked]:bg-[#00D4FF] flex-shrink-0"
                />
              )}
            </div>

            <div className="ml-[52px]">
              {factorsLoading ? (
                <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(0,212,255,0.2)', borderTopColor: '#00D4FF' }} />
              ) : is2FAEnabled ? (
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: '#E0F9FF', color: '#0369A1', border: '1px solid #00D4FF' }}
                >
                  Enabled
                </span>
              ) : (
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: '#F9FAFB', color: '#9CA3AF' }}
                >
                  Not enabled
                </span>
              )}
            </div>

            {!is2FAEnabled && !factorsLoading && (
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="w-full mt-4 rounded-[12px] text-white font-bold active:scale-[0.97] transition-transform"
                style={{
                  minHeight: 44,
                  background: enrolling ? '#8892A4' : '#0F1F3D',
                  fontSize: 14,
                  fontFamily: 'Manrope, sans-serif',
                  border: 'none',
                  cursor: enrolling ? 'not-allowed' : 'pointer',
                }}
              >
                {enrolling ? 'Starting setup…' : 'Enable Two-Factor Auth'}
              </button>
            )}

            {is2FAEnabled && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(15,31,61,0.08)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-4 w-4" style={{ color: '#0369A1' }} />
                  <span className="text-[13px] font-medium" style={{ color: '#4B5563', fontFamily: 'Inter, sans-serif' }}>
                    Authenticator app is active
                  </span>
                </div>
                <button
                  onClick={handleDisable}
                  disabled={disabling}
                  className="text-[13px] font-semibold"
                  style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', opacity: disabling ? 0.5 : 1 }}
                >
                  {disabling ? 'Removing…' : 'Remove 2FA'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Active Sessions */}
        <div
          className="bg-white rounded-2xl p-5 border border-[#E5E7EB]"
          style={{ boxShadow: '0px 2px 8px rgba(15,31,61,0.04), 0px 12px 32px rgba(15,31,61,0.04)' }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-[#F9FAFB] rounded-lg">
              <Smartphone className="h-4 w-4 text-[#4B5563]" />
            </div>
            <p className="font-bold text-[14px]" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>Active Sessions</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: '#F9FAFB' }}>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: '#0F1F3D' }}>Current Device</p>
                <p className="text-[11px]" style={{ color: '#9CA3AF' }}>Web Browser · Active now</p>
              </div>
              <span
                className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(0,212,255,0.08)', color: '#00D4FF' }}
              >
                This device
              </span>
            </div>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut({ scope: 'others' });
              toast({ title: 'Signed out', description: 'All other devices have been signed out.' });
            }}
            className="mt-4 w-full py-2.5 rounded-[10px] text-[13px] font-bold"
            style={{ border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', background: 'transparent', cursor: 'pointer' }}
          >
            Sign Out All Other Devices
          </button>
        </div>

        {/* Last Password Change */}
        <div
          className="bg-white rounded-2xl p-5 border border-[#E5E7EB]"
          style={{ boxShadow: '0px 2px 8px rgba(15,31,61,0.04), 0px 12px 32px rgba(15,31,61,0.04)' }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F9FAFB] rounded-lg">
              <Clock className="h-4 w-4 text-[#4B5563]" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold" style={{ color: '#0F1F3D' }}>Password</p>
              <p className="text-[11px]" style={{ color: '#9CA3AF' }}>Keep your account secure</p>
            </div>
            <button
              onClick={() => navigate('/cm/settings/account')}
              className="text-[12px] font-bold"
              style={{ color: '#00D4FF', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Change
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CMSecurity;
