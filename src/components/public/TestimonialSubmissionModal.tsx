import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  MessageSquare, 
  CheckCircle2, 
  Upload, 
  AlertCircle,
  ShieldCheck,
  Lock,
  Globe2
} from 'lucide-react';
import { TestimonialRecord, TestimonialPublicationPermission } from '../../types';
import { getStoredTestimonials, saveStoredTestimonials } from '../../data/initialData';
import { UniversalModal } from '../common/UniversalModal';

interface TestimonialSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultData?: {
    name?: string;
    email?: string;
    phone?: string;
    university?: string;
    faculty?: string;
    department?: string;
    classYear?: number;
    setId?: string;
  };
  onSuccess?: () => void;
}

export const TestimonialSubmissionModal: React.FC<TestimonialSubmissionModalProps> = ({
  isOpen,
  onClose,
  defaultData,
  onSuccess,
}) => {
  const [fullName, setFullName] = useState(defaultData?.name || '');
  const [email, setEmail] = useState(defaultData?.email || '');
  const [phone, setPhone] = useState(defaultData?.phone || '');
  const [university, setUniversity] = useState(defaultData?.university || 'University of Lagos (UNILAG)');
  const [faculty, setFaculty] = useState(defaultData?.faculty || 'Faculty of Science');
  const [department, setDepartment] = useState(defaultData?.department || 'Computer Science');
  const [classYear, setClassYear] = useState<number>(defaultData?.classYear || 2026);
  const [role] = useState('Class Album Admin');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [testimonialText, setTestimonialText] = useState('');
  const [consent, setConsent] = useState<TestimonialPublicationPermission>('public');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please provide your full name.');
      return;
    }
    if (!testimonialText.trim() || testimonialText.trim().length < 20) {
      setError('Please share at least a short sentence or two about your experience (minimum 20 characters).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const current = getStoredTestimonials();
      const newRecord: TestimonialRecord = {
        id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        avatarUrl: avatarUrl || undefined,
        role: 'Class Album Admin',
        university: university.trim(),
        faculty: faculty.trim(),
        department: department.trim(),
        classYear: Number(classYear) || new Date().getFullYear(),
        setId: defaultData?.setId,
        testimonialText: testimonialText.trim(),
        submissionDate: new Date().toISOString().split('T')[0],
        publicationPermission: consent,
        // If private, marked pending/internal only; if public, pending review for Owner
        reviewStatus: 'pending',
        isFeatured: false,
        requestStatus: 'submitted',
      };

      saveStoredTestimonials([newRecord, ...current]);
      setIsSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setError('Failed to record submission. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <UniversalModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
    >

        {isSubmitted ? (
          <div className="py-8 text-center space-y-5 text-black">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="font-syne font-extrabold text-2xl text-black">
                Thank You for Sharing
              </h3>
              <p className="font-body text-sm text-zinc-600 leading-relaxed">
                Your experience has been securely received by KoHot.
                {consent === 'public' 
                  ? ' Our team will review your words and we may feature them on the official KoHot website.'
                  : ' Your feedback will remain completely private and confidential for our internal records only.'}
              </p>
            </div>
            <div className="pt-4">
              <button
                onClick={onClose}
                className="px-8 py-3 rounded-full bg-black text-white font-syne font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-all cursor-pointer shadow-lg"
              >
                Close Window
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="space-y-2 pr-8 text-black">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-300 text-black font-mono-tech text-[10px] uppercase tracking-wider font-bold">
                <MessageSquare className="w-3 h-3 text-[#b89728]" />
                <span>Class Album Admin Feedback</span>
              </div>
              <h2 className="font-syne font-extrabold text-2xl sm:text-3xl text-black">
                Share Your KoHot Experience
              </h2>
              <p className="font-body text-xs sm:text-sm text-zinc-600 leading-relaxed">
                We'd love to hear what the experience of preserving your class legacy with KoHot was like.
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-100 border border-red-300 text-red-800 text-xs flex items-center gap-2.5 font-mono-tech">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5 text-left text-black">
              
              {/* Profile Photo (Optional) & Basic Details */}
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-white border border-zinc-300 shadow-xs">
                <div className="relative group shrink-0">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-6 h-6 text-zinc-400" />
                    )}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl text-[10px] font-mono-tech text-white">
                    <span>Change</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleAvatarUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>
                <div className="space-y-1 text-center sm:text-left flex-1">
                  <span className="font-syne font-bold text-xs text-black block">
                    Profile Photo (Optional)
                  </span>
                  <p className="text-[11px] font-body text-zinc-500">
                    Upload an authentic portrait or graduation photo to display alongside your remarks.
                  </p>
                  <label className="inline-block mt-1 font-mono-tech text-[10px] text-[#b89728] underline cursor-pointer font-bold">
                    Upload Photo
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleAvatarUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>

              {/* Name & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-700 font-bold">
                    Full Name *
                  </label>
                  <input
                    required
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Babatunde Adeleke"
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-zinc-300 text-black text-xs font-body focus:outline-none focus:border-[#d4af37] shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-700 font-bold">
                    Role in Class
                  </label>
                  <input
                    readOnly
                    type="text"
                    value={role}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-600 text-xs font-mono-tech cursor-not-allowed shadow-xs"
                  />
                </div>
              </div>

              {/* Institution Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-700 font-bold">
                    University *
                  </label>
                  <input
                    required
                    type="text"
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    placeholder="e.g. University of Lagos"
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-zinc-300 text-black text-xs font-body focus:outline-none focus:border-[#d4af37] shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-700 font-bold">
                    Faculty *
                  </label>
                  <input
                    required
                    type="text"
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    placeholder="e.g. Faculty of Science"
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-zinc-300 text-black text-xs font-body focus:outline-none focus:border-[#d4af37] shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-700 font-bold">
                    Department &amp; Year *
                  </label>
                  <div className="flex gap-2">
                    <input
                      required
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Computer Science"
                      className="w-2/3 px-3.5 py-2 rounded-xl bg-white border border-zinc-300 text-black text-xs font-body focus:outline-none focus:border-[#d4af37] shadow-xs"
                    />
                    <input
                      required
                      type="number"
                      value={classYear}
                      onChange={(e) => setClassYear(parseInt(e.target.value, 10))}
                      className="w-1/3 px-2.5 py-2 rounded-xl bg-white border border-zinc-300 text-black text-xs font-mono-tech focus:outline-none focus:border-[#d4af37] text-center shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Testimonial / Experience Text */}
              <div className="space-y-1.5">
                <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-700 font-bold">
                  Your Testimonial / Experience *
                </label>
                <textarea
                  required
                  rows={4}
                  value={testimonialText}
                  onChange={(e) => setTestimonialText(e.target.value)}
                  placeholder="Tell us what organizing the Class Album was like, how your classmates responded, and how having a permanent digital legacy feels..."
                  className="w-full px-4 py-3 rounded-xl bg-white border border-zinc-300 text-black text-xs font-body leading-relaxed focus:outline-none focus:border-[#d4af37] resize-y shadow-xs"
                />
              </div>

              {/* PUBLICATION CONSENT — MANDATORY EXPLICIT CHOICE */}
              <div className="p-5 rounded-2xl bg-white border border-zinc-300 space-y-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#b89728]" />
                  <span className="font-syne font-bold text-xs uppercase tracking-wider text-black">
                    Can we share your experience?
                  </span>
                </div>

                <div className="space-y-2.5">
                  {/* Option 1: Public */}
                  <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    consent === 'public'
                      ? 'bg-zinc-50 border-[#d4af37] text-black shadow-xs'
                      : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                  }`}>
                    <input
                      type="radio"
                      name="consentOption"
                      checked={consent === 'public'}
                      onChange={() => setConsent('public')}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-syne font-bold text-xs text-black">
                        <Globe2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Yes, you can feature it</span>
                      </div>
                      <p className="text-[11px] font-body text-zinc-600 leading-normal">
                        “I’m happy for KoHot to feature my testimonial on its website and KoHot promotional materials.”
                      </p>
                    </div>
                  </label>

                  {/* Option 2: Private */}
                  <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    consent === 'private'
                      ? 'bg-zinc-50 border-[#d4af37] text-black shadow-xs'
                      : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                  }`}>
                    <input
                      type="radio"
                      name="consentOption"
                      checked={consent === 'private'}
                      onChange={() => setConsent('private')}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-syne font-bold text-xs text-black">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <span>No, keep it private</span>
                      </div>
                      <p className="text-[11px] font-body text-zinc-600 leading-normal">
                        “I’m happy for KoHot to keep my feedback for its records, but I do not want it published publicly.”
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-full bg-black hover:bg-zinc-800 text-white font-syne font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl disabled:opacity-50 active:scale-95"
                >
                  {isSubmitting ? (
                    <span>Submitting Experience...</span>
                  ) : (
                    <span>Submit Experience</span>
                  )}
                </button>
                <span className="font-mono-tech text-[10px] text-zinc-500 text-center block mt-2">
                  {consent === 'public' 
                    ? 'Submissions are reviewed before public publication on the KoHot website.'
                    : 'Your choice will be strictly honored. Private feedback is never published.'}
                </span>
              </div>
            </form>
          </>
        )}
    </UniversalModal>
  );
};
