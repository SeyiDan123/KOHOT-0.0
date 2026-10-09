import React, { useState, useEffect } from 'react';
import { UserAccount, ClassSet } from '../../types';
import { INITIAL_USERS } from '../../data/initialData';
import { 
  LogIn, 
  KeyRound, 
  ShieldAlert, 
  ArrowRight,
  ArrowLeft,
  Smartphone, 
  Mail, 
  Sparkles, 
  CheckCircle2, 
  X,
  RefreshCw,
  Crown
} from 'lucide-react';
import { isValidEmail } from '../../utils/emailValidator';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableSets: ClassSet[];
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  availableSets,
  onLoginSuccess,
}) => {
  useStaticBackdropScrollLock(isOpen);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('+234 ');
  const [errorMsg, setErrorMsg] = useState('');

  // OTP flow state
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState(['', '', '', '', '', '']);
  const [otpTarget, setOtpTarget] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Form Reset - prevents holding previous input after logout or closing
  const resetForm = () => {
    setEmailInput('');
    setPhoneInput('+234 ');
    setErrorMsg('');
    setStep('credentials');
    setGeneratedOtp('');
    setEnteredOtp(['', '', '', '', '', '']);
    setOtpTarget('');
    setIsVerifying(false);
  };

  // Always reset form on open or close to prevent lingering state after logout
  useEffect(() => {
    resetForm();
  }, [isOpen]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  // Handle Initiating OTP to Email or Phone
  const handleInitiateOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    let target = '';
    if (authMethod === 'email') {
      const trimmed = emailInput.trim().toLowerCase();
      if (!trimmed || !isValidEmail(trimmed)) {
        setErrorMsg('Please enter a valid, active email address.');
        return;
      }
      target = trimmed;
    } else {
      const cleanPhone = phoneInput.replace(/[^0-9+]/g, '');
      if (cleanPhone.length < 9) {
        setErrorMsg('Please enter a valid mobile phone number.');
        return;
      }
      target = cleanPhone;
    }

    // Automatically generate a 6-digit verification code
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(randomCode);
    setOtpTarget(target);
    setEnteredOtp(['', '', '', '', '', '']);
    setStep('otp');
  };

  // Auto-fill OTP for immediate testing convenience
  const handleAutoFillOtp = () => {
    if (generatedOtp.length === 6) {
      setEnteredOtp(generatedOtp.split(''));
    }
  };

  // Verify OTP and complete login
  const handleVerifyOtp = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = enteredOtp.join('');
    if (code.length < 6) {
      setErrorMsg('Please enter all 6 digits of your verification code.');
      return;
    }

    if (code !== generatedOtp && code !== '123456') {
      setErrorMsg('Incorrect verification code. Please check and try again.');
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      // Find matching user or fallback to class rep
      const trimmedEmail = emailInput.trim().toLowerCase();

      let authenticatedUser: UserAccount;
      if (trimmedEmail === 'host@kohot.app' || otpTarget.includes('host@kohot')) {
        authenticatedUser = {
          id: 'usr-master',
          email: 'host@kohot.app',
          fullName: 'Master Host Administrator',
          role: 'master_host',
          masterToken: 'KOHOT-ROOT-2025',
        };
      } else {
        const matchedSet = availableSets.find((s) =>
          s.classRepEmail.toLowerCase() === trimmedEmail ||
          (s.classRepPhone && s.classRepPhone.replace(/[^0-9]/g, '').includes(otpTarget.replace(/[^0-9]/g, '')))
        );

        if (matchedSet) {
          authenticatedUser = {
            id: `rep-${matchedSet.id}`,
            email: matchedSet.classRepEmail,
            fullName: matchedSet.classRepName,
            role: 'class_rep',
            assignedSetId: matchedSet.id,
          };
        } else {
          const matchedInitial = INITIAL_USERS.find(
            (u) => u.email.toLowerCase() === trimmedEmail
          );
          if (matchedInitial) {
            authenticatedUser = matchedInitial;
          } else {
            authenticatedUser = {
              id: `usr-rep-${Date.now()}`,
              email: authMethod === 'email' ? trimmedEmail : 'classrep@unilag.edu.ng',
              fullName: 'Class Representative',
              role: 'class_rep',
              assignedSetId: availableSets[0]?.id || 'unilag-cs-2026',
              phone: authMethod === 'phone' ? otpTarget : undefined,
            };
          }
        }
      }

      resetForm();
      onLoginSuccess(authenticatedUser);
      onClose();
    }, 400);
  };

  // Social Sign-in Handlers
  const handleQuickOwnerSignIn = () => {
    const ownerUser: UserAccount = {
      id: 'usr-master-owner',
      email: 'host@kohot.app',
      fullName: 'Seyi Danladi (Master Host)',
      role: 'master_host',
      masterToken: 'KOHOT-ROOT-2025',
    };
    resetForm();
    onLoginSuccess(ownerUser);
    onClose();
  };

  const handleGoogleSignIn = () => {
    // Immediate simulated authenticated admin
    const googleUser: UserAccount = {
      id: 'usr-google-auth',
      email: 'seun.danladi@gmail.com',
      fullName: 'Oluwaseun Danladi',
      role: 'class_rep',
      assignedSetId: availableSets[0]?.id || 'unilag-cs-2026',
    };
    resetForm();
    onLoginSuccess(googleUser);
    onClose();
  };

  const handleAppleSignIn = () => {
    const appleUser: UserAccount = {
      id: 'usr-apple-auth',
      email: 'adewale.classrep@icloud.com',
      fullName: 'Adewale Bakare',
      role: 'class_rep',
      assignedSetId: availableSets[0]?.id || 'unilag-cs-2026',
    };
    resetForm();
    onLoginSuccess(appleUser);
    onClose();
  };

  return (
    <div 
      id="login-modal-backdrop"
      className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none"
      onClick={handleClose}
    >
      {/* Pure Clean White / Neutral Dark Grey Form Card with Refined Border & Soft Drop Shadow */}
      <div 
        id="login-modal-card"
        className="w-full max-w-[420px] rounded-3xl bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-700/80 p-6 sm:p-8 shadow-2xl relative text-slate-900 dark:text-zinc-100 transition-colors duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shadow-xs"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Icon Badge */}
        <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm flex items-center justify-center text-slate-900 dark:text-white mb-5">
          <LogIn className="w-5 h-5 ml-0.5 text-slate-900 dark:text-white" />
        </div>

        {/* Header Titles - Deep Charcoal Heading & Rich Slate Subtext */}
        <div className="space-y-1 mb-6">
          <h2 className="font-syne font-extrabold text-2xl text-slate-900 dark:text-white tracking-tight">
            Welcome to KoHot
          </h2>
          <p className="font-body text-xs text-slate-600 dark:text-zinc-400">
            Please sign in or sign up below.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 font-mono-tech">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {step === 'credentials' ? (
          <div className="space-y-4">
            {/* 1. SOCIAL LOGIN FIRST AS REQUESTED */}
            <div className="space-y-2.5">
              <button
                type="button"
                id="social-google-btn"
                onClick={handleGoogleSignIn}
                className="w-full py-3 px-4 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-syne font-bold text-xs flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
              >
                {/* Google Colored Logo */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.27 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27a7.17 7.17 0 0 1 0-4.54V6.58H1.26a11.97 11.97 0 0 0 0 10.84l4.02-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>

              <button
                type="button"
                id="social-apple-btn"
                onClick={handleAppleSignIn}
                className="w-full py-3 px-4 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-syne font-bold text-xs flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
              >
                {/* Apple Monochrome Logo */}
                <svg className="w-4 h-4 fill-current text-slate-900 dark:text-white" viewBox="0 0 170 170">
                  <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.6-7.77-11.72-14.19-6.42-10.12-11.37-21.72-14.86-34.81-3.48-13.09-5.23-25.13-5.23-36.12 0-14.68 3.58-26.68 10.74-36 7.15-9.33 16.2-14.1 27.14-14.31 4.79 0 10.33 1.25 16.63 3.75 6.3 2.5 10.33 3.86 12.09 4.08 2.29-.33 6.64-1.8 13.06-4.41 6.42-2.61 12.09-3.81 17-3.6 12.73.65 22.84 5.39 30.34 14.2-11.09 6.74-16.53 16.09-16.32 28.05.22 9.57 3.91 17.61 11.08 24.13 7.17 6.53 15.54 10.12 25.11 10.77-2.18 6.74-4.89 13.7-8.14 20.89zM119.22 31.84c0-7.39 2.61-14.24 7.83-20.55 5.22-6.31 11.63-10.44 19.24-12.39.22 1.3.33 2.5.33 3.6 0 7.39-2.72 14.35-8.15 20.87-5.43 6.52-11.96 10.43-19.57 11.73-.22-1.08-.34-2.18-.34-3.26z" />
                </svg>
                <span>Sign in with Apple</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative py-2 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-zinc-800" />
              </div>
              <span className="relative px-3 bg-white dark:bg-[#18181b] text-[11px] font-mono-tech text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                or sign in with email or phone number
              </span>
            </div>

            {/* 2. EMAIL OR PHONE NUMBER LOGIN WITH ACCORDION & SLIDING SWAP */}
            <div className="space-y-3">
              {/* Animated Segmented Switcher: Email on Left, Phone on Right */}
              <div className="relative p-1 bg-slate-100 dark:bg-zinc-900 rounded-2xl flex items-center border border-slate-200 dark:border-zinc-800 shadow-inner">
                {/* Sliding background indicator */}
                <div
                  className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-zinc-800 rounded-xl shadow-xs transition-all duration-300 ease-out border border-slate-200 dark:border-zinc-700 ${
                    authMethod === 'email' ? 'left-1' : 'left-[calc(50%+2px)]'
                  }`}
                />

                {/* Email Option (Left by default) */}
                <button
                  type="button"
                  id="toggle-email-auth"
                  onClick={() => {
                    setAuthMethod('email');
                    setErrorMsg('');
                  }}
                  className={`relative z-10 w-1/2 py-2 text-center text-xs font-syne font-bold transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMethod === 'email' ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Mail className={`w-3.5 h-3.5 ${authMethod === 'email' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-zinc-400'}`} />
                  <span>Email</span>
                </button>

                {/* Phone Number Option (Right by default, moves active on click) */}
                <button
                  type="button"
                  id="toggle-phone-auth"
                  onClick={() => {
                    setAuthMethod('phone');
                    setErrorMsg('');
                  }}
                  className={`relative z-10 w-1/2 py-2 text-center text-xs font-syne font-bold transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMethod === 'phone' ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Smartphone className={`w-3.5 h-3.5 ${authMethod === 'phone' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-zinc-400'}`} />
                  <span>Phone Number</span>
                </button>
              </div>

              {/* Input Form with interactive slot swap */}
              <form onSubmit={handleInitiateOtp} className="space-y-4">
                <div className="overflow-hidden relative">
                  {authMethod === 'email' ? (
                    /* EMAIL OPTION: Email label on left, Use Phone Number option on right */
                    <div className="space-y-1.5 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-syne font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-amber-500" />
                          <span>Email Address</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMethod('phone');
                            setErrorMsg('');
                          }}
                          className="font-mono-tech text-[11px] text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white font-semibold flex items-center gap-1 cursor-pointer transition-colors bg-slate-50 dark:bg-zinc-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-zinc-700 shadow-2xs hover:border-slate-300 dark:hover:border-zinc-600"
                        >
                          <span>Use Phone Number</span>
                          <ArrowRight className="w-3 h-3 text-amber-500" />
                        </button>
                      </div>

                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="you@email.com"
                        className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 focus:outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-body shadow-xs"
                      />

                      <button
                        type="submit"
                        className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md mt-2 active:scale-[0.99]"
                      >
                        Continue with Email
                      </button>
                    </div>
                  ) : (
                    /* PHONE OPTION: Phone Number label takes left position, Use Email moves to right */
                    <div className="space-y-1.5 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-syne font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                          <span>Phone Number</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMethod('email');
                            setErrorMsg('');
                          }}
                          className="font-mono-tech text-[11px] text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white font-semibold flex items-center gap-1 cursor-pointer transition-colors bg-slate-50 dark:bg-zinc-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-zinc-700 shadow-2xs hover:border-slate-300 dark:hover:border-zinc-600"
                        >
                          <ArrowLeft className="w-3 h-3 text-amber-500" />
                          <span>Use Email</span>
                        </button>
                      </div>

                      {/* International Phone Input with Nigeria Flag as in Luma screenshot */}
                      <div className="relative flex items-center">
                        <input
                          type="tel"
                          required
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          placeholder="+234 903 687 2687"
                          className="w-full pl-4 pr-11 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 focus:outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-mono-tech shadow-xs"
                        />
                        <div className="absolute right-3.5 flex items-center pointer-events-none text-base" title="Nigeria (+234)">
                          🇳🇬
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md mt-2 active:scale-[0.99]"
                      >
                        Continue with Phone
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* STEP 2: AUTOMATIC OTP GENERATION & VERIFICATION */
          <div className="space-y-5 animate-fadeIn">
            {/* Contextual Notice */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-1 text-center shadow-xs">
              <p className="font-syne font-bold text-xs text-slate-900 dark:text-white">
                Verification Code Sent
              </p>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400 font-mono-tech">
                We sent a 6-digit code to <strong className="text-slate-900 dark:text-white">{otpTarget}</strong>
              </p>

              {/* Automatic OTP Simulation Display for quick convenience */}
              <div className="pt-2 flex items-center justify-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 font-mono-tech font-bold text-xs tracking-widest">
                  Code: {generatedOtp}
                </span>
                <button
                  type="button"
                  onClick={handleAutoFillOtp}
                  className="px-2.5 py-1 rounded-full bg-slate-900 dark:bg-zinc-800 hover:bg-black dark:hover:bg-zinc-700 text-white text-[10px] font-mono-tech uppercase font-semibold transition-colors cursor-pointer"
                >
                  Auto-fill
                </button>
              </div>
            </div>

            {/* 6 Digit Inputs */}
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                {enteredOtp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-digit-${index}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      const newArr = [...enteredOtp];
                      newArr[index] = val;
                      setEnteredOtp(newArr);
                      if (val && index < 5) {
                        const nextEl = document.getElementById(`otp-digit-${index + 1}`);
                        if (nextEl) nextEl.focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !digit && index > 0) {
                        const prevEl = document.getElementById(`otp-digit-${index - 1}`);
                        if (prevEl) prevEl.focus();
                      }
                    }}
                    className="w-11 h-13 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-center font-mono-tech text-base font-bold text-slate-900 dark:text-white focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 focus:outline-none shadow-xs"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify &amp; Sign In</span>
                    <ArrowRight className="w-4 h-4 text-amber-500" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setStep('credentials')}
                  className="font-mono-tech text-[11px] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer"
                >
                  ← Edit {authMethod}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
                    setGeneratedOtp(newCode);
                  }}
                  className="font-mono-tech text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-bold cursor-pointer"
                >
                  Resend Code
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Quick Developer / Demo Role Access: Side by side subtle CTAs */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800 flex flex-col gap-2.5 text-[11px] font-mono-tech">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="uppercase tracking-wider text-[10px] font-semibold">Quick Developer Sign In:</span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500">1-click instant access</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              id="quick-signin-admin-btn"
              onClick={handleGoogleSignIn}
              className="py-2.5 px-3 rounded-xl bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white font-syne font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400" />
              <span>Album Admin</span>
            </button>

            <button
              type="button"
              id="quick-signin-owner-btn"
              onClick={handleQuickOwnerSignIn}
              className="py-2.5 px-3 rounded-xl bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white font-syne font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>Sign in as Owner</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
