import React, { useState, useEffect } from 'react';
import { X, Send, HelpCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserAccount, ClassSet } from '../../types';
import { sendSupportMessage } from '../../utils/apiClient';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserAccount | null;
  currentSet?: ClassSet | null;
}

const MAX_CHAR_COUNT = 2000;

export const ContactSupportModal: React.FC<ContactSupportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentSet,
}) => {
  useStaticBackdropScrollLock(isOpen);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Prefill Google email and name for signed-in admins
  useEffect(() => {
    if (isOpen) {
      if (currentUser?.email) {
        setEmail(currentUser.email);
        setName(currentUser.fullName || '');
      } else {
        setName('');
        setEmail('');
      }
      setMessage('');
      setIsSuccess(false);
      setErrorMsg('');
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const isEmailReadOnly = Boolean(currentUser?.email);
  const charsRemaining = MAX_CHAR_COUNT - message.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    if (message.length > MAX_CHAR_COUNT) {
      setErrorMsg(`Message must not exceed ${MAX_CHAR_COUNT} characters.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await sendSupportMessage({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        message: message.trim(),
        albumId: currentSet?.id,
      });

      if (res.success) {
        setIsSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2200);
      } else {
        setErrorMsg(res.error || 'Failed to send support message.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error connecting to support service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-support-modal-title"
      className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-[#14151a] border border-white/15 p-6 sm:p-8 shadow-2xl flex flex-col space-y-5 text-white select-auto overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 id="contact-support-modal-title" className="font-syne font-bold text-lg text-white">
              Contact Support
            </h3>
            <p className="font-body text-xs text-zinc-400">
              Send a direct message to the KoHot support team.
            </p>
          </div>
        </div>

        {/* Success View */}
        {isSuccess ? (
          <div className="py-8 text-center space-y-3 animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="font-syne font-bold text-base text-white">Message Sent Successfully</h4>
            <p className="font-body text-xs text-zinc-300 max-w-xs mx-auto leading-relaxed">
              Our team will review your inquiry and follow up directly at{' '}
              <span className="font-mono-tech text-white font-semibold">{email}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1.5">
                Your Full Name *
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Oluwaseun Adeleke"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0c10] border border-white/15 text-white placeholder:text-zinc-600 font-body text-xs focus:border-[#d4af37] focus:outline-none transition-colors"
              />
            </div>

            {/* Email (Read-only if signed in) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                  Email Address *
                </label>
                {isEmailReadOnly && (
                  <span className="font-mono-tech text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Google Verified
                  </span>
                )}
              </div>
              <input
                required
                type="email"
                value={email}
                readOnly={isEmailReadOnly}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@university.edu.ng"
                className={`w-full px-3.5 py-2.5 rounded-xl font-mono-tech text-xs transition-colors ${
                  isEmailReadOnly
                    ? 'bg-white/5 border-white/10 text-zinc-300 cursor-not-allowed'
                    : 'bg-[#0b0c10] border-white/15 text-white placeholder:text-zinc-600 focus:border-[#d4af37] focus:outline-none'
                }`}
              />
            </div>

            {/* Message */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                  Message *
                </label>
                <span
                  className={`font-mono-tech text-[10px] ${
                    charsRemaining < 100 ? 'text-amber-400' : 'text-zinc-500'
                  }`}
                >
                  {charsRemaining} chars remaining
                </span>
              </div>
              <textarea
                required
                rows={5}
                maxLength={MAX_CHAR_COUNT}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help? Please provide as much detail as possible..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0c10] border border-white/15 text-white placeholder:text-zinc-600 font-body text-xs focus:border-[#d4af37] focus:outline-none resize-none transition-colors"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim() || !email.trim() || !message.trim()}
                className="px-6 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#e6c158] disabled:opacity-50 disabled:cursor-not-allowed text-black font-syne font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md"
              >
                {isSubmitting ? (
                  <span>Sending...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
