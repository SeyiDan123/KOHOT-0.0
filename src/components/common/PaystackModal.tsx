import React, { useState } from 'react';
import { 
  X, 
  Shield, 
  CreditCard, 
  Building, 
  PhoneCall, 
  CheckCircle2, 
  Lock, 
  Loader2, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface PaystackModalProps {
  isOpen: boolean;
  onClose: () => void;
  amountNgn: number;
  customerEmail: string;
  customerName: string;
  metadata: {
    universityName: string;
    departmentName: string;
    graduationYear: number;
    classSetName: string;
  };
  onSuccess: (reference: string) => void;
}

import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';

export const PaystackModal: React.FC<PaystackModalProps> = ({
  isOpen,
  onClose,
  amountNgn,
  customerEmail,
  customerName,
  metadata,
  onSuccess,
}) => {
  useStaticBackdropScrollLock(isOpen);
  const [activeChannel, setActiveChannel] = useState<'card' | 'transfer' | 'ussd'>('card');
  
  // Card input states
  const [cardNumber, setCardNumber] = useState('4084 0852 3910 4429');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvv, setCardCvv] = useState('883');
  const [cardPin, setCardPin] = useState('1234');
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'form' | 'authenticating' | 'success'>('form');
  const [txReference, setTxReference] = useState('');

  if (!isOpen) return null;

  const handlePayCard = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setStep('authenticating');

    const generatedRef = `PSK-KOHOT-${Math.floor(100000 + Math.random() * 900000)}`;
    setTxReference(generatedRef);

    // Simulate authentic 3D Secure / OTP authorization
    setTimeout(() => {
      setIsProcessing(false);
      setStep('success');

      setTimeout(() => {
        onSuccess(generatedRef);
      }, 1400);
    }, 1800);
  };

  const handleTransferSent = () => {
    setIsProcessing(true);
    setStep('authenticating');

    const generatedRef = `PSK-TRF-${Math.floor(100000 + Math.random() * 900000)}`;
    setTxReference(generatedRef);

    setTimeout(() => {
      setIsProcessing(false);
      setStep('success');

      setTimeout(() => {
        onSuccess(generatedRef);
      }, 1400);
    }, 1800);
  };

  const formattedAmount = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amountNgn);

  return (
    <div 
      id="paystack-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div 
        id="paystack-modal-card"
        className="w-full max-w-lg bg-[#ffffff] text-[#1e293b] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Paystack Top Header */}
        <div className="bg-[#0b1329] px-6 py-4 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00c07f]/20 border border-[#00c07f]/40 flex items-center justify-center font-bold text-[#00c07f] font-mono text-sm">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-white">paystack</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-slate-300 font-mono">Secured</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">{customerEmail}</p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-base font-bold text-white font-mono">{formattedAmount}</div>
            <span className="text-[10px] text-[#00c07f] font-mono">One-time Album Activation</span>
          </div>
        </div>

        {step === 'authenticating' && (
          <div className="py-16 px-8 text-center space-y-4">
            <Loader2 className="w-12 h-12 text-[#0ba4db] animate-spin mx-auto" />
            <div className="space-y-1">
              <h4 className="font-semibold text-base text-slate-800">Authorizing with Issuing Bank...</h4>
              <p className="text-xs text-slate-500 font-mono">Verifying 3D-Secure credentials and securing class album license</p>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="py-16 px-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-lg text-slate-800">Payment Confirmed</h4>
              <p className="text-xs text-slate-500 font-mono">Reference: {txReference}</p>
              <p className="text-xs text-emerald-600 font-medium pt-2">Initializing Class Album and Layer 1 Dashboard...</p>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="flex flex-col sm:flex-row min-h-[380px]">
            {/* Sidebar Channels */}
            <div className="w-full sm:w-44 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-200 p-3 space-y-1.5 flex sm:flex-col justify-start">
              <button
                type="button"
                onClick={() => setActiveChannel('card')}
                className={`flex-1 sm:flex-initial w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all ${
                  activeChannel === 'card' 
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-semibold' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="w-4 h-4 text-[#0ba4db]" />
                <span>Card</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveChannel('transfer')}
                className={`flex-1 sm:flex-initial w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all ${
                  activeChannel === 'transfer' 
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-semibold' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Building className="w-4 h-4 text-emerald-600" />
                <span>Bank Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveChannel('ussd')}
                className={`flex-1 sm:flex-initial w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all ${
                  activeChannel === 'ussd' 
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-semibold' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <PhoneCall className="w-4 h-4 text-purple-600" />
                <span>USSD</span>
              </button>
            </div>

            {/* Main Channel Body */}
            <div className="flex-1 p-6 flex flex-col justify-between">
              {activeChannel === 'card' && (
                <form onSubmit={handlePayCard} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        Card Number
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">Mastercard / Visa / Verve</span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="0000 0000 0000 0000"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#0ba4db] focus:ring-1 focus:ring-[#0ba4db]"
                      />
                      <CreditCard className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Valid Till
                      </label>
                      <input
                        type="text"
                        required
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM / YY"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#0ba4db] focus:ring-1 focus:ring-[#0ba4db]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        CVV
                      </label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        placeholder="123"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#0ba4db] focus:ring-1 focus:ring-[#0ba4db]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      4-Digit Card PIN
                    </label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      value={cardPin}
                      onChange={(e) => setCardPin(e.target.value)}
                      placeholder="••••"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#0ba4db] focus:ring-1 focus:ring-[#0ba4db]"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full bg-[#00c07f] hover:bg-[#00a66d] text-white font-medium text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Pay {formattedAmount}</span>
                    </button>
                    <p className="text-center text-[10px] text-slate-400 mt-2 font-mono flex items-center justify-center gap-1">
                      <Shield className="w-3 h-3 text-slate-400" />
                      Encrypted with Paystack 256-bit security
                    </p>
                  </div>
                </form>
              )}

              {activeChannel === 'transfer' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Bank Name</span>
                      <span className="font-semibold text-slate-800">Wema Bank / Titan</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Account Number</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">9920 481 028</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Beneficiary</span>
                      <span className="text-slate-700">Paystack Checkout / KoHot</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Make a bank transfer of <strong className="text-slate-800">{formattedAmount}</strong> to the account above. Payment will be automatically confirmed within 60 seconds.
                  </p>

                  <button
                    type="button"
                    onClick={handleTransferSent}
                    className="w-full bg-[#00c07f] hover:bg-[#00a66d] text-white font-medium text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow"
                  >
                    <span>I have sent the money</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {activeChannel === 'ussd' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-600">Select your bank to generate the direct USSD payment string:</p>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button 
                      type="button"
                      onClick={handleTransferSent}
                      className="p-3 rounded-lg border border-slate-200 hover:border-slate-400 text-left font-mono hover:bg-slate-50 cursor-pointer"
                    >
                      <span className="block font-semibold text-slate-800">GTBank</span>
                      <span className="text-[10px] text-slate-500">*737*50*...#</span>
                    </button>
                    <button 
                      type="button"
                      onClick={handleTransferSent}
                      className="p-3 rounded-lg border border-slate-200 hover:border-slate-400 text-left font-mono hover:bg-slate-50 cursor-pointer"
                    >
                      <span className="block font-semibold text-slate-800">Zenith Bank</span>
                      <span className="text-[10px] text-slate-500">*966*00*...#</span>
                    </button>
                    <button 
                      type="button"
                      onClick={handleTransferSent}
                      className="p-3 rounded-lg border border-slate-200 hover:border-slate-400 text-left font-mono hover:bg-slate-50 cursor-pointer"
                    >
                      <span className="block font-semibold text-slate-800">Access Bank</span>
                      <span className="text-[10px] text-slate-500">*901*...#</span>
                    </button>
                    <button 
                      type="button"
                      onClick={handleTransferSent}
                      className="p-3 rounded-lg border border-slate-200 hover:border-slate-400 text-left font-mono hover:bg-slate-50 cursor-pointer"
                    >
                      <span className="block font-semibold text-slate-800">UBA</span>
                      <span className="text-[10px] text-slate-500">*919*...#</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-400 font-mono text-center">
                    Simulate one-tap execution with demo sandbox provider
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Close / Cancel Bar */}
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="text-[11px]">KoHot Digital Class Album • {metadata.departmentName}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
          >
            Cancel Payment
          </button>
        </div>
      </div>
    </div>
  );
};
