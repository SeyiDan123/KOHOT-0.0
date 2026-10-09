import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Search, 
  HelpCircle, 
  ChevronDown, 
  ArrowRight, 
  ShieldCheck, 
  Send, 
  Smartphone, 
  Users, 
  BookOpen, 
  Award, 
  Lock, 
  Mail,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOnboarding?: () => void;
  initialCategory?: string;
}

interface SupportTopic {
  id: string;
  category: string;
  title: string;
  answer: string;
  popular?: boolean;
}

const SUPPORT_TOPICS: SupportTopic[] = [
  // 1. Getting Started
  {
    id: 'how-to-create-album',
    category: 'Getting Started',
    title: 'How do I start and claim our class album?',
    popular: true,
    answer: 'Select "Create Class Album", verify your university and department, specify your graduating year and estimated class size, provide your contact and backup contact information, and submit your request. Once verified by the department and KoHot, your album workspace is activated immediately.',
  },
  {
    id: 'class-size-estimate',
    category: 'Getting Started',
    title: 'What if our exact class size is not yet confirmed?',
    answer: 'Provide your best estimate during request submission. Your class album can accommodate all classmates regardless of small variations, and additional students can be added or invited at any time before final publishing.',
  },

  // 2. Managing Your Album
  {
    id: 'how-to-invite-classmates',
    category: 'Managing Your Album',
    title: 'How do I invite classmates to add their portraits and story?',
    popular: true,
    answer: 'In your Album Workspace, click "Invite Classmates" to copy your dedicated broadcast link or share directly via WhatsApp or Telegram. Classmates tap the link on their phones, upload their portrait photo, enter their details, and submit in less than a minute with zero app installation required.',
  },
  {
    id: 'how-to-approve-profiles',
    category: 'Managing Your Album',
    title: 'How do student submissions get approved?',
    popular: true,
    answer: 'All incoming classmate submissions arrive in your "Pending Approvals" queue. The administrator reviews each entry to ensure accuracy and appropriate framing, then taps "Approve" to make it part of the official class roster.',
  },
  {
    id: 'completing-album',
    category: 'Managing Your Album',
    title: 'How do we complete our album and publish it?',
    popular: true,
    answer: 'Ensure your approved graduate portraits are complete, upload your milestone moments (matriculation, dinners, project defense), add superlatives or awards, and verify your class story. When ready, click "Publish Album" to make it live for the department and alumni.',
  },

  // 3. Inviting the Next Class
  {
    id: 'how-to-invite-next-class',
    category: 'Inviting the Next Class',
    title: 'How do we invite the subsequent class to continue the legacy?',
    popular: true,
    answer: 'In your Album Workspace, click "Invite Next Class". Enter the next class graduating year (e.g. 2027) and the incoming class representative\'s contact info. They receive a secure handoff link that pre-fills your department and university details so they can seamlessly establish their chapter.',
  },
  {
    id: 'plaque-continuity',
    category: 'Inviting the Next Class',
    title: 'Does the next class need a separate physical plaque?',
    answer: 'No. The 10 × 12 inch physical departmental Legacy Plaque installed in your faculty corridor features a permanent QR gateway that links to your department Legacy Wall. Every succeeding class automatically connects under the same departmental gateway.',
  },

  // 4. Administration
  {
    id: 'how-to-transfer-admin',
    category: 'Administration',
    title: 'How do I transfer administrative responsibilities?',
    popular: true,
    answer: 'Open your Profile menu, select "Class Admin", and open "Transfer Admin". Your saved Backup Contact is suggested by default, or you can specify a classmate. Send them the secure transfer link. Once they sign in and accept the responsibility agreement, they become the sole current administrator and your personal class profile remains intact.',
  },
  {
    id: 'exceptional-recovery',
    category: 'Administration',
    title: 'What if an administrator has graduated or is unreachable?',
    popular: true,
    answer: 'Exceptional administration recovery is strictly governed for class security. The class committee or department representative must contact KoHot Support using the form below with student body identification to initiate administrative reassignment.',
  },

  // 5. Your Account
  {
    id: 'pwa-home-screen',
    category: 'Your Account',
    title: 'How do I add KoHot to my phone Home Screen?',
    popular: true,
    answer: 'On iPhone/iPad: Open Safari, tap the Share button at the bottom of the screen, and choose "Add to Home Screen". On Android: Open Chrome, tap the three dots in the top right corner, and select "Add to Home screen" or "Install App". KoHot will launch instantly like a native app.',
  },
  {
    id: 'change-email-phone',
    category: 'Your Account',
    title: 'How do I update my email address or WhatsApp contact?',
    answer: 'Open the Profile Menu and click "Account Settings". You can update your contact phone number, preferred notifications, and profile details.',
  },

  // 6. Privacy & Sharing
  {
    id: 'privacy-policy-overview',
    category: 'Privacy & Sharing',
    title: 'Is our Class Album public on social media or search engines?',
    popular: true,
    answer: 'No. A KoHot Class Album is not an indexed public social media feed. It is preserved respectfully as part of your department\'s living legacy, accessible through your physical corridor plaque QR code and shared among classmates and alumni.',
  },
];

const CATEGORIES = [
  'All',
  'Getting Started',
  'Managing Your Album',
  'Inviting the Next Class',
  'Administration',
  'Your Account',
  'Privacy & Sharing',
  'Contact KoHot Support'
];

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  onOpenOnboarding,
  initialCategory = 'All'
}) => {
  useStaticBackdropScrollLock(isOpen);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>('how-to-create-album');

  // Contact support form state
  const [supportName, setSupportName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportDepartment, setSupportDepartment] = useState('');
  const [supportType, setSupportType] = useState<'general' | 'recovery' | 'verification'>('general');
  const [supportMessage, setSupportMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Universal scroll lock
  useStaticBackdropScrollLock(isOpen);

  // Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredTopics = SUPPORT_TOPICS.filter((topic) => {
    const matchesCat = selectedCategory === 'All' || topic.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || topic.title.toLowerCase().includes(q) || topic.answer.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportName || !supportEmail || !supportMessage) return;
    setIsSubmitted(true);
  };

  const modalElement = (
    <div 
      id="help-support-modal-backdrop"
      className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden animate-fadeIn select-none"
      onClick={onClose}
    >
      <div 
        id="help-support-modal-dialog"
        className="relative w-full max-w-4xl h-[680px] max-h-[88vh] bg-[#f0f2f5] dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-700/80 rounded-2xl sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col text-black dark:text-zinc-100 select-auto transition-colors duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 sm:px-8 pt-5 pb-4 border-b border-zinc-200 dark:border-zinc-800 bg-[#eef0f4]/95 dark:bg-[#1f1f23]/95 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-black dark:text-white shadow-xs">
              <HelpCircle className="w-5 h-5 text-[#b89728] dark:text-[#d4af37]" />
            </div>
            <div>
              <h2 className="font-syne font-extrabold text-lg sm:text-xl text-black dark:text-white">
                KoHot Support Centre
              </h2>
              <p className="font-mono-tech text-xs text-zinc-600 dark:text-zinc-400">
                Official guides for album creators, administrators, and graduating classes.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
            aria-label="Close Help Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Category Pills */}
        <div className="px-6 sm:px-8 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-[#e8ebf0] dark:bg-[#151518] space-y-3 shrink-0 z-10">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guides, admin workflows, plaque installation..."
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-mono-tech text-xs focus:outline-none focus:border-[#d4af37] shadow-xs"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full font-mono-tech text-[11px] uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer shadow-xs ${
                  selectedCategory === cat
                    ? 'bg-black dark:bg-white text-white dark:text-zinc-950 font-bold'
                    : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-6 text-black dark:text-zinc-100">
          {/* Contact Support View */}
          {selectedCategory === 'Contact KoHot Support' ? (
            <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
              <div className="p-5 rounded-3xl bg-white border border-zinc-300 space-y-2 shadow-xs">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#b89728]" />
                  <h3 className="font-syne font-bold text-base text-black">Contact KoHot Support</h3>
                </div>
                <p className="font-body text-xs text-zinc-600 leading-relaxed">
                  Have questions about departmental archival, plaque installation, or need <strong>Exceptional Administration Recovery</strong> for an unreachable administrator? Our preservation team responds within 24 hours.
                </p>
              </div>

              {isSubmitted ? (
                <div className="p-8 rounded-3xl bg-emerald-50 border border-emerald-300 text-center space-y-3 animate-fadeIn">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h4 className="font-syne font-bold text-lg text-black">Support Request Dispatched</h4>
                  <p className="font-body text-xs text-zinc-600 max-w-md mx-auto leading-relaxed">
                    Thank you, {supportName}. Our preservation team has received your ticket and will follow up directly at {supportEmail}.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSubmitted(false);
                      setSupportMessage('');
                    }}
                    className="px-5 py-2 rounded-full bg-black text-white font-mono-tech text-xs uppercase tracking-wider font-semibold cursor-pointer shadow-xs"
                  >
                    Send Another Inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSupportSubmit} className="p-6 rounded-3xl bg-white border border-zinc-300 space-y-4 font-body text-xs shadow-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-700 font-bold mb-1.5">
                        Your Full Name *
                      </label>
                      <input
                        required
                        type="text"
                        value={supportName}
                        onChange={(e) => setSupportName(e.target.value)}
                        placeholder="e.g. Tunde Adeyemi"
                        className="w-full px-4 py-2.5 rounded-xl bg-[#f8f9fa] border border-zinc-300 text-black placeholder:text-zinc-400 focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                    <div>
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-700 font-bold mb-1.5">
                        Email Address *
                      </label>
                      <input
                        required
                        type="email"
                        value={supportEmail}
                        onChange={(e) => setSupportEmail(e.target.value)}
                        placeholder="e.g. tunde@alumni.edu"
                        className="w-full px-4 py-2.5 rounded-xl bg-[#f8f9fa] border border-zinc-300 text-black placeholder:text-zinc-400 focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-700 font-bold mb-1.5">
                        Department & University
                      </label>
                      <input
                        type="text"
                        value={supportDepartment}
                        onChange={(e) => setSupportDepartment(e.target.value)}
                        placeholder="e.g. UNILAG Computer Science"
                        className="w-full px-4 py-2.5 rounded-xl bg-[#f8f9fa] border border-zinc-300 text-black placeholder:text-zinc-400 focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                    <div>
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-700 font-bold mb-1.5">
                        Inquiry Nature
                      </label>
                      <select
                        value={supportType}
                        onChange={(e) => setSupportType(e.target.value as any)}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#f8f9fa] border border-zinc-300 text-black font-mono-tech text-xs focus:outline-none focus:border-[#d4af37] cursor-pointer"
                      >
                        <option value="general">General Support & Guidance</option>
                        <option value="recovery">Exceptional Administration Recovery</option>
                        <option value="verification">Plaque & Department Verification</option>
                      </select>
                    </div>
                  </div>

                  {supportType === 'recovery' && (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-[#b89728] shrink-0 mt-0.5" />
                      <p className="font-mono-tech text-[11px] leading-relaxed">
                        <strong>Administrative Security Notice:</strong> Exceptional recovery is reserved for situations where the current administrator is unreachable or has graduated. We will verify your departmental or class standing before reassignment.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-700 font-bold mb-1.5">
                      Details / Message *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="Explain your inquiry or recovery circumstance..."
                      className="w-full p-3 rounded-xl bg-[#f8f9fa] border border-zinc-300 text-black placeholder:text-zinc-400 focus:outline-none focus:border-[#d4af37] resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-full bg-black text-white font-syne font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                    <span>Send Message to Support</span>
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* Topic Accordion List */
            <div className="space-y-3">
              {filteredTopics.length === 0 ? (
                <div className="text-center py-12 space-y-2 text-zinc-500 dark:text-zinc-400">
                  <p className="font-mono-tech text-xs">No matching guides found for "{searchQuery}".</p>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('Contact KoHot Support')}
                    className="text-black dark:text-[#d4af37] font-bold underline font-mono-tech text-xs cursor-pointer"
                  >
                    Contact KoHot Support directly &rarr;
                  </button>
                </div>
              ) : (
                filteredTopics.map((topic) => {
                  const isExpanded = expandedId === topic.id;
                  return (
                    <div
                      key={topic.id}
                      className={`rounded-2xl border transition-all ${
                        isExpanded
                          ? 'bg-white dark:bg-[#202024] border-[#d4af37] shadow-md ring-1 ring-[#d4af37]/30'
                          : 'bg-white dark:bg-[#202024] border-zinc-300 dark:border-zinc-700/80 hover:border-zinc-400 dark:hover:border-zinc-600 shadow-xs'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : topic.id)}
                        className="w-full p-4 sm:p-5 flex items-center justify-between text-left gap-3 cursor-pointer"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono-tech text-[10px] uppercase tracking-wider text-[#b89728] dark:text-[#d4af37] font-bold">
                              {topic.category}
                            </span>
                            {topic.popular && (
                              <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-black dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 font-mono-tech text-[9px] uppercase tracking-wider font-bold">
                                Popular
                              </span>
                            )}
                          </div>
                          <h4 className="font-syne font-bold text-sm sm:text-base text-black dark:text-white">
                            {topic.title}
                          </h4>
                        </div>
                        <div className={`p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-transform ${isExpanded ? 'rotate-180 text-black dark:text-white' : ''}`}>
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 sm:px-5 pb-5 pt-1 text-xs font-body text-zinc-700 dark:text-zinc-300 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 animate-fadeIn">
                          <p>{topic.answer}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Bottom Quick Help Contact Banner */}
              <div className="mt-8 p-5 rounded-3xl bg-white dark:bg-[#202024] border border-zinc-300 dark:border-zinc-700/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-xs">
                <div>
                  <h4 className="font-syne font-bold text-sm text-black dark:text-white">
                    Need personalized assistance with your class?
                  </h4>
                  <p className="font-mono-tech text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Our team is on standby to help department reps and class executives.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('Contact KoHot Support')}
                  className="px-5 py-2 rounded-full bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-mono-tech text-xs uppercase tracking-wider transition-colors cursor-pointer shrink-0 shadow-xs"
                >
                  Contact Support
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalElement, document.body);
  }
  return modalElement;
};
