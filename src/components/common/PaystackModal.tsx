import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  fetchPublicPaymentConfig,
  initPaystackPaymentOnServer,
  verifyPaystackPaymentReferenceOnServer,
} from '../../utils/apiClient';

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref: string;
        metadata?: Record<string, any>;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }) => {
        openIframe: () => void;
      };
    };
  }
}

let paystackScriptPromise: Promise<boolean> | null = null;

function loadPaystackInlineScript(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.PaystackPop) {
    return Promise.resolve(true);
  }
  if (paystackScriptPromise) {
    return paystackScriptPromise;
  }
  paystackScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.PaystackPop)));
      existing.addEventListener('error', () => {
        paystackScriptPromise = null;
        resolve(false);
      });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve(Boolean(window.PaystackPop));
    script.onerror = () => {
      paystackScriptPromise = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });
  return paystackScriptPromise;
}

export type PaystackCheckoutState =
  | 'idle'
  | 'processing'
  | 'payment received, confirming'
  | 'verified'
  | 'failed'
  | 'cancelled';

interface PaystackModalProps {
  isOpen: boolean;
  onClose: () => void;
  amountNgn: number;
  customerEmail: string;
  customerName: string;
  paymentType: 'student' | 'slots';
  albumId: string;
  submissionId?: string;
  quantity?: number;
  sponsorName?: string;
  metadata?: {
    universityName?: string;
    departmentName?: string;
    graduationYear?: number;
    classSetName?: string;
  };
  onSuccess: (reference: string, verifyResult?: any) => void;
}

export const PaystackModal: React.FC<PaystackModalProps> = ({
  isOpen,
  onClose,
  amountNgn,
  customerEmail,
  customerName,
  paymentType,
  albumId,
  submissionId,
  quantity,
  sponsorName,
  metadata,
  onSuccess,
}) => {
  const [checkoutState, setCheckoutState] = useState<PaystackCheckoutState>('idle');
  const [publicKey, setPublicKey] = useState<string>('');
  const [configLoaded, setConfigLoaded] = useState<boolean>(false);
  const [serverAmountNgn, setServerAmountNgn] = useState<number>(amountNgn);
  const [activeReference, setActiveReference] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    setCheckoutState('idle');
    setErrorMessage('');
    setActiveReference('');
    setServerAmountNgn(amountNgn);
    setConfigLoaded(false);

    let cancelled = false;
    fetchPublicPaymentConfig().then((cfg) => {
      if (cancelled) return;
      setPublicKey(cfg.paystackPublicKey || '');
      if (paymentType === 'student' && cfg.studentFeeKobo > 0) {
        setServerAmountNgn(Math.round(cfg.studentFeeKobo / 100));
      } else if (paymentType === 'slots' && cfg.slotFeeKobo > 0 && quantity) {
        setServerAmountNgn(Math.round((cfg.slotFeeKobo * quantity) / 100));
      }
      setConfigLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, amountNgn, paymentType, quantity]);

  const verifyReferenceWithServer = useCallback(
    async (referenceToVerify: string) => {
      setCheckoutState('payment received, confirming');
      setErrorMessage('');

      const verifyRes = await verifyPaystackPaymentReferenceOnServer(referenceToVerify);
      if (verifyRes.success && verifyRes.status === 'success') {
        setCheckoutState('verified');
        onSuccess(referenceToVerify, verifyRes);
      } else {
        setCheckoutState('failed');
        setErrorMessage(
          verifyRes.message ||
            'Payment received, but verification could not complete yet. Click Verify Again or contact support.'
        );
      }
    },
    [onSuccess]
  );

  const handleStartCheckout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!configLoaded || !publicKey) return;

    setCheckoutState('processing');
    setErrorMessage('');

    const scriptLoaded = await loadPaystackInlineScript();
    if (!scriptLoaded || !window.PaystackPop) {
      setCheckoutState('failed');
      setErrorMessage('Could not load Paystack checkout script. Please check your connection and try again.');
      return;
    }

    const initRes = await initPaystackPaymentOnServer({
      type: paymentType,
      albumId,
      submissionId,
      quantity,
      sponsorName,
      email: customerEmail,
      payerName: customerName,
    });

    if (!initRes.success || !initRes.reference || !initRes.amountKobo || !initRes.publicKey) {
      setCheckoutState('failed');
      setErrorMessage(initRes.message || 'Could not initialize payment with server.');
      return;
    }

    const ref = initRes.reference;
    setActiveReference(ref);
    setServerAmountNgn(Math.round(initRes.amountKobo / 100));

    try {
      const handler = window.PaystackPop.setup({
        key: initRes.publicKey,
        email: initRes.email || customerEmail || 'student@kohot.ng',
        amount: initRes.amountKobo,
        currency: 'NGN',
        ref,
        metadata: initRes.metadata || {},
        callback: (response) => {
          const verifiedRef = response?.reference || ref;
          setActiveReference(verifiedRef);
          verifyReferenceWithServer(verifiedRef);
        },
        onClose: () => {
          setCheckoutState((prev) => (prev === 'processing' ? 'cancelled' : prev));
        },
      });
      handler.openIframe();
    } catch (err: any) {
      setCheckoutState('failed');
      setErrorMessage(err?.message || 'Failed to launch Paystack checkout window.');
    }
  };

  if (!isOpen) return null;

  const isPaymentsUnavailable = configLoaded && !publicKey;
  const displayAmount = serverAmountNgn || amountNgn;

  return (
    <div
      id="paystack-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn touch-none overscroll-none"
      onClick={() => {
        if (checkoutState !== 'processing' && checkoutState !== 'payment received, confirming') {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y bg-white text-zinc-900 rounded-2xl shadow-2xl border border-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Paystack Branded Header */}
        <div className="bg-[#011b33] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0ba4db] flex items-center justify-center font-bold text-white text-sm shadow-inner">
              P
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight">Paystack Checkout</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.5 rounded font-mono">
                  NGN
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 truncate max-w-[210px]">
                {customerEmail || 'verified-payer@kohot.ng'}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-zinc-400">Pay</p>
            <p className="font-extrabold text-lg text-[#0ba4db]">
              ₦{displayAmount.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Close Button */}
        {checkoutState !== 'processing' && checkoutState !== 'payment received, confirming' && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Cancel Payment"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Order Summary Banner */}
        <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-xs text-zinc-600">
          <span className="truncate font-medium">
            {paymentType === 'slots'
              ? `Profile Slots (${quantity || 1})`
              : metadata?.departmentName
              ? `${metadata.departmentName} (${metadata.graduationYear || ''})`
              : 'Album Profile Submission'}
          </span>
          <span className="font-mono text-[11px] text-zinc-500 shrink-0 ml-2">
            {metadata?.universityName || 'KoHot Archive'}
          </span>
        </div>

        {/* Main Body */}
        <div className="p-6">
          {!configLoaded ? (
            <div className="py-10 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#0ba4db] animate-spin mx-auto" />
              <p className="text-xs text-zinc-500">Loading payment configuration...</p>
            </div>
          ) : isPaymentsUnavailable ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-base text-zinc-900">
                  Payments are not available yet
                </h4>
                <p className="text-xs text-zinc-500">
                  Live checkout has not been configured on this server yet. Please try again later or contact your Class Admin.
                </p>
              </div>
              <button
                type="button"
                disabled
                className="w-full py-3.5 rounded-xl bg-zinc-200 text-zinc-500 font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Payments are not available yet</span>
              </button>
            </div>
          ) : checkoutState === 'verified' ? (
            <div className="py-8 text-center space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-lg text-zinc-900">Payment Verified!</h4>
                <p className="text-xs text-zinc-500">
                  Reference:{' '}
                  <span className="font-mono font-semibold text-zinc-700">{activeReference}</span>
                </p>
                <p className="text-xs text-emerald-600 font-medium pt-2">
                  Confirmed with Paystack. Updating your record...
                </p>
              </div>
            </div>
          ) : checkoutState === 'payment received, confirming' ? (
            <div className="py-8 text-center space-y-4 animate-fadeIn">
              <Loader2 className="w-10 h-10 text-[#0ba4db] animate-spin mx-auto" />
              <div className="space-y-1">
                <h4 className="font-bold text-base text-zinc-900">
                  Payment received, confirming...
                </h4>
                <p className="text-xs text-zinc-500">
                  Verifying transaction{' '}
                  <span className="font-mono font-semibold text-zinc-700">{activeReference}</span>{' '}
                  with Paystack server.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {checkoutState === 'failed' && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Payment could not be completed</p>
                    <p>{errorMessage || 'Verification failed. Please try again.'}</p>
                  </div>
                </div>
              )}

              {checkoutState === 'cancelled' && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Checkout cancelled</p>
                    <p>You closed the payment window before completing checkout.</p>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Payer</span>
                  <span className="font-semibold text-zinc-800">{customerName || customerEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Amount</span>
                  <span className="font-bold text-emerald-700">
                    ₦{displayAmount.toLocaleString()} NGN
                  </span>
                </div>
                {sponsorName && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Sponsor Credit</span>
                    <span className="font-medium text-zinc-800">{sponsorName}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <button
                  id="paystack-confirm-pay-btn"
                  type="button"
                  disabled={checkoutState === 'processing'}
                  onClick={() => handleStartCheckout()}
                  className="w-full py-3.5 rounded-xl bg-[#3bb75e] hover:bg-[#32a051] disabled:opacity-60 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {checkoutState === 'processing' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Opening Paystack...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Pay ₦{displayAmount.toLocaleString()}</span>
                    </>
                  )}
                </button>

                {activeReference && checkoutState === 'failed' && (
                  <button
                    type="button"
                    onClick={() => verifyReferenceWithServer(activeReference)}
                    className="w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Verify Reference ({activeReference}) Again</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Security Seal */}
        <div className="px-6 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Secured by</span>
          <strong className="text-zinc-800">paystack</strong>
        </div>
      </div>
    </div>
  );
};
