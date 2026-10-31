import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Send,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Edit3,
  Image as ImageIcon,
  MessageCircle,
  Share2,
  Smartphone,
  Building2,
  GraduationCap,
} from 'lucide-react';
import {
  UniversityDirectoryItem,
  ClassSet,
  WebsiteContentOverride,
} from '../../types';
import { ImageDropzone } from '../common/ImageDropzone';
import { MasterNextClassHandoffsSection } from './MasterNextClassHandoffsSection';
import { getWhatsAppDigits, formatNigerianPhoneNumber } from '../../utils/phoneFormatter';
import { logManualCommunication } from '../../utils/kohotCommunications';

interface MasterAnnualRemindersSectionProps {
  universities: UniversityDirectoryItem[];
  sets: ClassSet[];
  contentOverride?: WebsiteContentOverride;
  onUpdateContentOverride?: (content: WebsiteContentOverride) => void;
  onViewDepartmentLegacyWall?: (deptId: string, uniId?: string) => void;
}

interface RegisteredAdminContact {
  id: string;
  setId: string;
  adminName: string;
  roleLabel: 'Album Admin' | 'Co-Admin';
  phone: string;
  departmentName: string;
  institutionId: string;
  institutionName: string;
  graduationYear: number;
  classSetName: string;
  isPublished: boolean;
}

export const MasterAnnualRemindersSection: React.FC<MasterAnnualRemindersSectionProps> = ({
  universities,
  sets,
  contentOverride,
  onUpdateContentOverride,
  onViewDepartmentLegacyWall,
}) => {
  // 3 Sub-Clips under KoHot Communications:
  // 1. Department Executives Blast ('executive_blast')
  // 2. Message Registered Album Admins ('album_admins')
  // 3. Next-Class Handoffs ('handoffs')
  const [communicationsTab, setCommunicationsTab] = useState<
    'executive_blast' | 'album_admins' | 'handoffs'
  >('executive_blast');

  // =========================================================================
  // SUB-CLIP 1 STATE: DEPARTMENT EXECUTIVES BLAST (WHATSAPP & SMS ONLY)
  // =========================================================================
  const [blastImageUrl, setBlastImageUrl] = useState<string>(
    (contentOverride as any)?.broadcastLinkContextImageUrl ||
      contentOverride?.executiveBlastImageUrl ||
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85'
  );
  const [blastMessageClip, setBlastMessageClip] = useState<string>(
    contentOverride?.executiveBlastMessageTemplate ||
      `Hello Department Executive Team,\n\nGive your graduating class a permanent digital home and a physical Legacy Plaque in your department corridor.\n\nCreate your official Department Class Album on KoHot today:\n{{website_url}}\n\nPreserve your classmates, portraits, moments, and stories forever.`
  );
  const [targetBlastAudience, setTargetBlastAudience] = useState<string>('all');
  const [execBlastToast, setExecBlastToast] = useState<string | null>(null);
  const [copiedBlastLink, setCopiedBlastLink] = useState(false);
  const [copiedBlastMessage, setCopiedBlastMessage] = useState(false);
  const [imageSaveToast, setImageSaveToast] = useState(false);

  const handleUpdateBlastImage = (newUrl: string) => {
    setBlastImageUrl(newUrl);
    if (onUpdateContentOverride && contentOverride) {
      onUpdateContentOverride({
        ...contentOverride,
        executiveBlastImageUrl: newUrl,
      });
      setImageSaveToast(true);
      setTimeout(() => setImageSaveToast(false), 3000);
    }
  };

  // =========================================================================
  // SUB-CLIP 2 STATE: REGISTERED ALBUM ADMINS (WHATSAPP & SMS MESSAGING)
  // =========================================================================
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminUniFilter, setAdminUniFilter] = useState<string>('all');
  const [adminMessageTemplate, setAdminMessageTemplate] = useState<string>(
    `Hello {{admin_name}},\n\nThis is KoHot Host reaching out regarding your {{department_name}} ({{institution_name}}) — Class of {{graduation_year}} album.\n\nAccess your class album here:\n{{album_url}}`
  );
  const [copiedAdminPhone, setCopiedAdminPhone] = useState<string | null>(null);
  const [copiedAllPhones, setCopiedAllPhones] = useState(false);
  const [copiedAdminTemplate, setCopiedAdminTemplate] = useState(false);
  const [adminMessageToast, setAdminMessageToast] = useState<string | null>(null);

  // Extract all registered Album Admins (and Co-Admins) from existing sets
  const registeredAdmins = useMemo<RegisteredAdminContact[]>(() => {
    const list: RegisteredAdminContact[] = [];

    sets.forEach((set) => {
      if (set.deletedAt) return;

      // Primary Album Admin phone resolution from existing data
      const adminStudent = (set.students || []).find(
        (st) =>
          ((set as any).classAdminStudentId && st.id === (set as any).classAdminStudentId) ||
          (set.classRepEmail && st.email?.toLowerCase() === set.classRepEmail.toLowerCase()) ||
          (set.classRepName && st.fullName?.toLowerCase() === set.classRepName.toLowerCase())
      );

      const resolvedPrimaryPhone =
        set.classRepPhone ||
        adminStudent?.whatsappNumber ||
        (adminStudent as any)?.phoneNumber ||
        '';

      list.push({
        id: `admin-${set.id}`,
        setId: set.id,
        adminName: set.classRepName || adminStudent?.fullName || 'Class Album Admin',
        roleLabel: 'Album Admin',
        phone: resolvedPrimaryPhone,
        departmentName: set.departmentName,
        institutionId: set.institutionId,
        institutionName: set.institutionName,
        graduationYear: set.graduationYear,
        classSetName: set.classSetName,
        isPublished: Boolean(set.isPublished),
      });

      // Include any registered Co-Admins if they have existing data
      const coAdminsList = (set as any).coAdmins;
      if (Array.isArray(coAdminsList)) {
        coAdminsList.forEach((co: any, idx: number) => {
          const coStudent = (set.students || []).find(
            (st) =>
              (co.email && st.email?.toLowerCase() === co.email.toLowerCase()) ||
              (co.fullName && st.fullName?.toLowerCase() === co.fullName.toLowerCase())
          );
          const coPhone = co.phone || coStudent?.whatsappNumber || (coStudent as any)?.phoneNumber || '';
          list.push({
            id: `coadmin-${set.id}-${idx}`,
            setId: set.id,
            adminName: co.fullName || coStudent?.fullName || 'Co-Admin',
            roleLabel: 'Co-Admin',
            phone: coPhone,
            departmentName: set.departmentName,
            institutionId: set.institutionId,
            institutionName: set.institutionName,
            graduationYear: set.graduationYear,
            classSetName: set.classSetName,
            isPublished: Boolean(set.isPublished),
          });
        });
      }
    });

    return list;
  }, [sets]);

  const filteredAdmins = useMemo(() => {
    return registeredAdmins.filter((admin) => {
      if (adminUniFilter !== 'all' && admin.institutionId !== adminUniFilter) {
        return false;
      }
      if (adminSearchQuery.trim()) {
        const q = adminSearchQuery.toLowerCase();
        const matchName = admin.adminName.toLowerCase().includes(q);
        const matchDept = admin.departmentName.toLowerCase().includes(q);
        const matchUni = admin.institutionName.toLowerCase().includes(q);
        const matchPhone = admin.phone.toLowerCase().includes(q);
        const matchYear = String(admin.graduationYear).includes(q);
        return matchName || matchDept || matchUni || matchPhone || matchYear;
      }
      return true;
    });
  }, [registeredAdmins, adminUniFilter, adminSearchQuery]);

  const buildPersonalizedAdminMessage = (admin: RegisteredAdminContact) => {
    const albumUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/#album-${admin.setId}`
        : `https://kohot.com/#album-${admin.setId}`;

    return adminMessageTemplate
      .replace(/\{\{admin_name\}\}/g, admin.adminName)
      .replace(/\{\{department_name\}\}/g, admin.departmentName)
      .replace(/\{\{institution_name\}\}/g, admin.institutionName)
      .replace(/\{\{graduation_year\}\}/g, String(admin.graduationYear))
      .replace(/\{\{album_url\}\}/g, albumUrl);
  };

  const handleSendAdminMessage = (admin: RegisteredAdminContact, channel: 'whatsapp' | 'sms') => {
    const personalizedMsg = buildPersonalizedAdminMessage(admin);
    const encoded = encodeURIComponent(personalizedMsg);

    logManualCommunication({
      channel,
      recipientContact: admin.phone || 'Direct Client Launch',
      recipientName: admin.adminName,
      event: 'host_manual_whatsapp_followup',
      subjectOrSummary: `Host ${channel.toUpperCase()} to Album Admin: ${admin.departmentName} (${admin.graduationYear})`,
      bodySnippet: personalizedMsg,
      metadata: {
        setId: admin.setId,
        departmentName: admin.departmentName,
        graduationYear: admin.graduationYear,
        initiatedBy: 'KoHot Master Host',
      },
    });

    if (channel === 'whatsapp') {
      const waDigits = getWhatsAppDigits(admin.phone);
      const waUrl = waDigits
        ? `https://wa.me/${waDigits}?text=${encoded}`
        : `https://api.whatsapp.com/send?text=${encoded}`;
      window.open(waUrl, '_blank');
    } else {
      const formattedPhone = formatNigerianPhoneNumber(admin.phone);
      const smsUrl = formattedPhone
        ? `sms:${formattedPhone}?body=${encoded}`
        : `sms:?body=${encoded}`;
      window.location.href = smsUrl;
    }

    setAdminMessageToast(
      `Opened ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} for ${admin.adminName} (${admin.departmentName}).`
    );
    setTimeout(() => setAdminMessageToast(null), 3500);
  };

  const handleBulkSmsAllFilteredAdmins = () => {
    const phones = filteredAdmins
      .map((a) => formatNigerianPhoneNumber(a.phone))
      .filter((p) => Boolean(p));

    const genericMsg = adminMessageTemplate
      .replace(/\{\{admin_name\}\}/g, 'Class Album Admin')
      .replace(/\{\{department_name\}\}/g, 'your department')
      .replace(/\{\{institution_name\}\}/g, 'your institution')
      .replace(/\{\{graduation_year\}\}/g, 'your graduating class')
      .replace(
        /\{\{album_url\}\}/g,
        typeof window !== 'undefined' ? window.location.origin : 'https://kohot.com'
      );

    const recipientsJoined = phones.join(',');
    const smsUrl = recipientsJoined
      ? `sms:${recipientsJoined}?body=${encodeURIComponent(genericMsg)}`
      : `sms:?body=${encodeURIComponent(genericMsg)}`;
    window.location.href = smsUrl;
  };

  const handleCopyAllAdminPhones = () => {
    const phones = filteredAdmins
      .map((a) => formatNigerianPhoneNumber(a.phone) || a.phone)
      .filter(Boolean)
      .join(', ');
    navigator.clipboard.writeText(phones);
    setCopiedAllPhones(true);
    setTimeout(() => setCopiedAllPhones(false), 2500);
  };

  return (
    <div id="master-communications-module" className="space-y-8 animate-fadeIn">
      {/* =========================================================================
          HEADER & SUB-CLIP NAVIGATION (WHATSAPP & SMS ONLY)
          ========================================================================= */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#0e1017] via-[#131622] to-[#0a0b10] border border-white/15 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] font-mono-tech text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <MessageCircle className="w-3 h-3" />
                <span>WhatsApp &amp; SMS Direct Outreach</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 font-mono-tech text-[10px] uppercase tracking-wider">
                Existing Cohort Data
              </span>
            </div>

            <h2 className="font-syne font-bold text-2xl sm:text-3xl text-white flex items-center gap-3">
              <MessageCircle className="w-7 h-7 text-[#d4af37]" />
              <span>KoHot Communications</span>
            </h2>

            <p className="font-body text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Centralized WhatsApp and SMS messaging hub for Department Executives outreach, registered Class Album Admins, and sequential Next-Class Handoffs.
            </p>
          </div>

          {/* SUB-CLIP NAVIGATION PILLS */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-black/60 border border-white/10 self-start">
            <button
              type="button"
              id="comm-tab-executive-blast"
              onClick={() => setCommunicationsTab('executive_blast')}
              className={`px-4 py-2 rounded-xl text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                communicationsTab === 'executive_blast'
                  ? 'bg-[#d4af37] text-black font-bold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Department Executives Blast</span>
            </button>

            <button
              type="button"
              id="comm-tab-album-admins"
              onClick={() => setCommunicationsTab('album_admins')}
              className={`px-4 py-2 rounded-xl text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                communicationsTab === 'album_admins'
                  ? 'bg-[#25D366] text-black font-bold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Registered Album Admins</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono-tech font-bold ${
                  communicationsTab === 'album_admins'
                    ? 'bg-black/20 text-black'
                    : 'bg-white/10 text-zinc-300'
                }`}
              >
                {registeredAdmins.length}
              </span>
            </button>

            <button
              type="button"
              id="comm-tab-handoffs"
              onClick={() => setCommunicationsTab('handoffs')}
              className={`px-4 py-2 rounded-xl text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                communicationsTab === 'handoffs'
                  ? 'bg-white text-black font-bold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Next-Class Handoffs</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SUB-CLIP 1: DEPARTMENT EXECUTIVES BLAST (WHATSAPP & SMS ONLY)
          ========================================================================= */}
      {communicationsTab === 'executive_blast' && (
        <div className="space-y-8 animate-fadeIn" id="executive-blast-section">
          {/* Section Overview Header */}
          <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-[#d4af37]">
              <Sparkles className="w-4 h-4" />
              <span className="font-mono-tech text-[11px] uppercase tracking-wider font-bold">
                Executive Outreach &amp; Album Creation Engine • WhatsApp &amp; SMS
              </span>
            </div>
            <h3 className="font-syne font-black text-xl sm:text-2xl text-white">
              Blast Outreach to Department Executives
            </h3>
            <p className="font-body text-xs sm:text-sm text-zinc-300 max-w-3xl leading-relaxed">
              Compose and dispatch broadcast messages via WhatsApp and SMS directly to department executive leadership and student union representatives across universities inviting them to create their graduating class album. Links sent here land directly on the <strong>KoHot website homepage</strong>.
            </p>
          </div>

          {/* Toast notices */}
          {execBlastToast && (
            <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-mono-tech flex items-center gap-3 animate-fadeIn shadow-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{execBlastToast}</span>
            </div>
          )}

          {imageSaveToast && (
            <div className="p-4 rounded-2xl bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#d4af37] text-xs font-mono-tech flex items-center gap-3 animate-fadeIn shadow-xl">
              <Check className="w-4 h-4 text-[#d4af37] shrink-0" />
              <span>Broadcast Link Context Image updated and saved permanently to platform assets!</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LEFT COLUMN: CONTEXT IMAGE EDITOR & MESSAGE COMPOSER */}
            <div className="lg:col-span-7 space-y-6">
              {/* AREA 1: CONTEXT IMAGE MANAGER (GRADUATES PHOTO) */}
              <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10 space-y-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-2">
                  <div className="flex items-center gap-2.5">
                    <ImageIcon className="w-5 h-5 text-[#d4af37]" />
                    <div>
                      <h4 className="font-syne font-bold text-sm text-white">
                        Platform Links Context Image (Graduates Photo)
                      </h4>
                      <p className="text-zinc-400 text-xs font-body mt-0.5">
                        Carried across blast message links, Next Class relay links, and Other Department invites.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateBlastImage(
                        'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85'
                      )
                    }
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-mono-tech text-xs self-start sm:self-auto cursor-pointer transition-colors"
                  >
                    Reset to Default
                  </button>
                </div>

                <div className="space-y-4">
                  <ImageDropzone
                    value={blastImageUrl}
                    onChange={(url) => handleUpdateBlastImage(url)}
                    aspectRatio="16:9"
                    maxDimension={1200}
                    helperText="Upload or drag & drop a high-resolution photo of graduating students/celebration. Automatically optimized for social cards."
                  />

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-mono-tech uppercase text-zinc-400 font-semibold">
                      Direct Context Image URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={blastImageUrl}
                        onChange={(e) => setBlastImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/photo-..."
                        className="flex-1 px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-mono-tech focus:outline-none focus:border-[#d4af37]"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateBlastImage(blastImageUrl)}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs cursor-pointer border border-white/20 transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-[11px] font-mono-tech">
                    <span className="text-zinc-500 shrink-0 font-semibold">Presets:</span>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateBlastImage(
                          'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85'
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 shrink-0 cursor-pointer"
                    >
                      Graduation Caps
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateBlastImage(
                          'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1600&auto=format&fit=crop&q=85'
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 shrink-0 cursor-pointer"
                    >
                      Cohort Convocation
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateBlastImage(
                          'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1600&auto=format&fit=crop&q=85'
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 shrink-0 cursor-pointer"
                    >
                      Alumni Group Smile
                    </button>
                  </div>
                </div>
              </div>

              {/* AREA 2: MESSAGE CLIP COMPOSER */}
              <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10 space-y-5 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-[#d4af37]" />
                    <h4 className="font-syne font-bold text-sm text-white">
                      Executive Outreach Message Clip (WhatsApp &amp; SMS)
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono-tech text-zinc-500 uppercase">
                    Variable: {'{{website_url}}'}
                  </span>
                </div>

                {/* Audience Selector */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono-tech uppercase text-zinc-400 font-semibold">
                    Target Department Executives Audience
                  </label>
                  <select
                    value={targetBlastAudience}
                    onChange={(e) => setTargetBlastAudience(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-mono-tech focus:outline-none focus:border-[#d4af37]"
                  >
                    <option value="all">
                      All Universities &amp; All Departments (
                      {universities.reduce((acc, u) => acc + (u.departments?.length || 0), 0)}{' '}
                      Departments)
                    </option>
                    {universities.map((uni) => (
                      <option key={uni.id} value={uni.id}>
                        {uni.name} ({uni.departments?.length || 0} Departments)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination Link Info Box */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tech text-[10px] uppercase text-zinc-400 font-bold">
                      Destination Landing Link
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-tech text-[10px]">
                      Lands on Website Homepage
                    </span>
                  </div>
                  <p className="font-mono-tech text-xs text-[#d4af37] break-all select-all">
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}/?ref=dept_exec_blast`
                      : 'https://kohot.com/?ref=dept_exec_blast'}
                  </p>
                </div>

                {/* Textarea */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-mono-tech uppercase text-zinc-400 font-semibold">
                      Outreach Message Text *
                    </label>
                    <button
                      type="button"
                      onClick={() => setBlastMessageClip((prev) => prev + ' {{website_url}}')}
                      className="text-[10px] font-mono-tech text-[#d4af37] hover:underline cursor-pointer"
                    >
                      + Insert {'{{website_url}}'}
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    value={blastMessageClip}
                    onChange={(e) => setBlastMessageClip(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-black/60 border border-white/15 text-white text-xs font-body leading-relaxed focus:outline-none focus:border-[#d4af37] resize-y"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-mono-tech text-zinc-500">
                    Auto-interpolates website URL when dispatched via WhatsApp or SMS
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onUpdateContentOverride && contentOverride) {
                        onUpdateContentOverride({
                          ...contentOverride,
                          executiveBlastMessageTemplate: blastMessageClip,
                        });
                        setExecBlastToast('Message template saved to platform configuration!');
                        setTimeout(() => setExecBlastToast(null), 3000);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs transition-colors cursor-pointer border border-white/15"
                  >
                    Save As Default Template
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: LIVE CONTEXT CARD PREVIEW & WHATSAPP / SMS DISPATCH BAR */}
            <div className="lg:col-span-5 space-y-6">
              {/* LIVE SOCIAL / MESSAGING CARD PREVIEW */}
              <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-[#d4af37]" />
                    <h4 className="font-syne font-bold text-sm text-white">
                      Shared Link Card Preview
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono-tech text-emerald-400">
                    Live Context Preview
                  </span>
                </div>

                <p className="text-zinc-400 text-xs font-body">
                  When recipients receive this link via WhatsApp or SMS, it displays the visual card below with your graduate image:
                </p>

                {/* Preview Social Card */}
                <div className="rounded-2xl border border-white/15 bg-black overflow-hidden shadow-2xl transition-all hover:border-[#d4af37]/40">
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/80">
                    <img
                      src={blastImageUrl}
                      alt="Graduates Context"
                      className="w-full h-full object-cover filter contrast-[1.05]"
                    />
                    <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-[10px] font-mono-tech uppercase text-[#d4af37] font-bold">
                      KoHot Album Platform
                    </div>
                  </div>

                  <div className="p-4 space-y-2 bg-[#121420]">
                    <span className="text-[10px] font-mono-tech uppercase text-zinc-500 font-bold block">
                      kohot.com • Direct Department Invitation
                    </span>
                    <h5 className="font-syne font-bold text-sm text-white leading-snug">
                      Preserve Your Department Class Album — KoHot
                    </h5>
                    <p className="text-zinc-400 text-xs line-clamp-2 leading-relaxed">
                      Establish the official permanent archive and corridor Legacy Plaque for your graduating class. Beautiful graduate memories live here.
                    </p>
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[10px] font-mono-tech text-emerald-400 font-semibold">
                        Destination: Website Homepage
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* WHATSAPP & SMS DISPATCH BAR (NO EMAIL BUTTON) */}
              <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10 space-y-4 shadow-xl">
                <h4 className="font-syne font-bold text-sm text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#d4af37]" />
                  <span>WhatsApp &amp; SMS Dispatch Channels</span>
                </h4>

                {/* Messaging Channels Grid: Limited to WhatsApp & SMS */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* WhatsApp */}
                  <button
                    type="button"
                    id="exec-blast-whatsapp-btn"
                    onClick={() => {
                      const webUrl =
                        typeof window !== 'undefined'
                          ? `${window.location.origin}/?ref=dept_exec_blast`
                          : 'https://kohot.com/?ref=dept_exec_blast';
                      const msg = blastMessageClip.replace(/{{website_url}}/g, webUrl);
                      window.open(
                        `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`,
                        '_blank'
                      );
                    }}
                    className="p-3.5 rounded-2xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-white flex items-center justify-center gap-2 font-mono-tech text-xs font-bold cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    <MessageCircle className="w-4 h-4 text-[#25D366]" />
                    <span>Send via WhatsApp</span>
                  </button>

                  {/* SMS */}
                  <button
                    type="button"
                    id="exec-blast-sms-btn"
                    onClick={() => {
                      const webUrl =
                        typeof window !== 'undefined'
                          ? `${window.location.origin}/?ref=dept_exec_blast`
                          : 'https://kohot.com/?ref=dept_exec_blast';
                      const msg = blastMessageClip.replace(/{{website_url}}/g, webUrl);
                      window.location.href = `sms:?body=${encodeURIComponent(msg)}`;
                    }}
                    className="p-3.5 rounded-2xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-white flex items-center justify-center gap-2 font-mono-tech text-xs font-bold cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    <Smartphone className="w-4 h-4 text-sky-400" />
                    <span>Send via SMS</span>
                  </button>
                </div>

                {/* Copy Helpers */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const webUrl =
                        typeof window !== 'undefined'
                          ? `${window.location.origin}/?ref=dept_exec_blast`
                          : 'https://kohot.com/?ref=dept_exec_blast';
                      navigator.clipboard.writeText(webUrl);
                      setCopiedBlastLink(true);
                      setTimeout(() => setCopiedBlastLink(false), 3000);
                    }}
                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-white flex items-center justify-center gap-2 font-mono-tech text-xs cursor-pointer transition-all"
                  >
                    {copiedBlastLink ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span>{copiedBlastLink ? 'Link Copied!' : 'Copy Link'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const webUrl =
                        typeof window !== 'undefined'
                          ? `${window.location.origin}/?ref=dept_exec_blast`
                          : 'https://kohot.com/?ref=dept_exec_blast';
                      const msg = blastMessageClip.replace(/{{website_url}}/g, webUrl);
                      navigator.clipboard.writeText(msg);
                      setCopiedBlastMessage(true);
                      setTimeout(() => setCopiedBlastMessage(false), 3000);
                    }}
                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-white flex items-center justify-center gap-2 font-mono-tech text-xs cursor-pointer transition-all"
                  >
                    {copiedBlastMessage ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span>{copiedBlastMessage ? 'Message Copied!' : 'Copy Message'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-CLIP 2: MESSAGE REGISTERED ALBUM ADMINS (WHATSAPP & SMS USING EXISTING DATA)
          ========================================================================= */}
      {communicationsTab === 'album_admins' && (
        <div className="space-y-8 animate-fadeIn" id="registered-album-admins-messaging-section">
          {/* Overview Header & Quick Metrics */}
          <div className="p-6 sm:p-7 rounded-3xl bg-[#0c0d14] border border-white/15 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xl">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[#25D366] font-mono-tech text-[11px] uppercase tracking-wider font-bold">
                <MessageCircle className="w-4 h-4" />
                <span>Direct Cohort Admin Outreach • WhatsApp &amp; SMS Only</span>
              </div>
              <h3 className="font-syne font-bold text-xl sm:text-2xl text-white">
                Message Registered Class Album Admins
              </h3>
              <p className="font-body text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
                Reach out directly to already-registered Class Album Admins and Co-Admins via WhatsApp or SMS using their existing contact records from album registration.
              </p>
            </div>

            {/* Quick Counts */}
            <div className="flex flex-wrap items-center gap-3 shrink-0 font-mono-tech text-xs">
              <div className="px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="text-[10px] uppercase text-zinc-500 block">Registered Admins</span>
                <span className="font-bold text-base text-white">{registeredAdmins.length}</span>
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/25">
                <span className="text-[10px] uppercase text-[#25D366]/80 block">With Phone / WhatsApp</span>
                <span className="font-bold text-base text-[#25D366]">
                  {registeredAdmins.filter((a) => Boolean(a.phone)).length}
                </span>
              </div>
            </div>
          </div>

          {adminMessageToast && (
            <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-mono-tech flex items-center gap-3 animate-fadeIn shadow-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{adminMessageToast}</span>
            </div>
          )}

          {/* Message Template Composer + Bulk SMS/WhatsApp Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 p-6 rounded-3xl bg-[#0c0d14] border border-white/10 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[#25D366]" />
                  <h4 className="font-syne font-bold text-sm text-white">
                    Album Admin WhatsApp &amp; SMS Message Composer
                  </h4>
                </div>
                <span className="text-[10px] font-mono-tech text-zinc-400">
                  Auto-fills each admin&apos;s existing data
                </span>
              </div>

              {/* Dynamic Variable Insertion Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-mono-tech uppercase text-zinc-500 mr-1">
                  Insert Variable:
                </span>
                {[
                  '{{admin_name}}',
                  '{{department_name}}',
                  '{{institution_name}}',
                  '{{graduation_year}}',
                  '{{album_url}}',
                ].map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => setAdminMessageTemplate((prev) => `${prev} ${token}`)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[#d4af37] font-mono-tech text-[11px] cursor-pointer transition-colors"
                  >
                    {token}
                  </button>
                ))}
              </div>

              <textarea
                rows={5}
                value={adminMessageTemplate}
                onChange={(e) => setAdminMessageTemplate(e.target.value)}
                placeholder="Write WhatsApp or SMS message for registered Album Admins..."
                className="w-full p-4 rounded-2xl bg-black/60 border border-white/15 text-white text-xs font-body leading-relaxed focus:outline-none focus:border-[#25D366] resize-y"
              />
            </div>

            {/* Bulk Actions & Existing Data Dispatch Card */}
            <div className="lg:col-span-5 p-6 rounded-3xl bg-[#0c0d14] border border-white/10 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="space-y-2">
                <h4 className="font-syne font-bold text-sm text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#25D366]" />
                  <span>Quick Broadcast to Registered Admins</span>
                </h4>
                <p className="text-zinc-400 text-xs font-body leading-relaxed">
                  Use the buttons below to launch a multi-recipient SMS or WhatsApp broadcast using the phone numbers already captured from registered Album Admins, or message individual admins in the table below.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const genericMsg = adminMessageTemplate
                        .replace(/\{\{admin_name\}\}/g, 'Class Album Admin')
                        .replace(/\{\{department_name\}\}/g, 'your department')
                        .replace(/\{\{institution_name\}\}/g, 'your institution')
                        .replace(/\{\{graduation_year\}\}/g, 'your graduating class')
                        .replace(
                          /\{\{album_url\}\}/g,
                          typeof window !== 'undefined' ? window.location.origin : 'https://kohot.com'
                        );
                      window.open(
                        `https://api.whatsapp.com/send?text=${encodeURIComponent(genericMsg)}`,
                        '_blank'
                      );
                    }}
                    className="p-3 rounded-2xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-white font-mono-tech text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <MessageCircle className="w-4 h-4 text-[#25D366]" />
                    <span>WhatsApp Broadcast</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkSmsAllFilteredAdmins}
                    className="p-3 rounded-2xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-white font-mono-tech text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Smartphone className="w-4 h-4 text-sky-400" />
                    <span>SMS All Admins</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleCopyAllAdminPhones}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-mono-tech text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {copiedAllPhones ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedAllPhones ? 'Phones Copied!' : 'Copy All Phone Nos'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(adminMessageTemplate);
                      setCopiedAdminTemplate(true);
                      setTimeout(() => setCopiedAdminTemplate(false), 2500);
                    }}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-mono-tech text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {copiedAdminTemplate ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedAdminTemplate ? 'Template Copied!' : 'Copy Message Text'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="p-4 rounded-2xl bg-[#0c0d14] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={adminSearchQuery}
                onChange={(e) => setAdminSearchQuery(e.target.value)}
                placeholder="Search admin name, WhatsApp/phone, department, or institution..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={adminUniFilter}
                onChange={(e) => setAdminUniFilter(e.target.value)}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-zinc-300 font-mono-tech text-xs focus:outline-none"
              >
                <option value="all">All Institutions ({universities.length})</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Registered Album Admins Table */}
          <div className="rounded-3xl bg-[#0c0d14] border border-white/10 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#25D366]" />
                <span className="font-syne font-bold text-sm text-white">
                  Registered Class Album Admins Directory
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-zinc-400 text-[10px] font-mono-tech">
                  {filteredAdmins.length} admins
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-black/40 font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                    <th className="p-4">Album Admin</th>
                    <th className="p-4">Department &amp; Institution</th>
                    <th className="p-4">Cohort / Set</th>
                    <th className="p-4">WhatsApp / SMS Phone</th>
                    <th className="p-4 text-right">Direct Messaging (WhatsApp &amp; SMS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono-tech">
                  {filteredAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-zinc-500 font-mono-tech text-xs">
                        No registered Class Album Admins match your filter criteria yet.
                      </td>
                    </tr>
                  ) : (
                    filteredAdmins.map((admin) => (
                      <tr key={admin.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4">
                          <div className="space-y-0.5">
                            <p className="font-body font-bold text-white text-sm">
                              {admin.adminName}
                            </p>
                            <span className="inline-block px-2 py-0.5 rounded bg-white/10 text-[#d4af37] text-[10px] uppercase">
                              {admin.roleLabel}
                            </span>
                          </div>
                        </td>

                        <td className="p-4">
                          <p className="font-body font-semibold text-zinc-200">
                            {admin.departmentName}
                          </p>
                          <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3" />
                            <span>{admin.institutionName}</span>
                          </p>
                        </td>

                        <td className="p-4">
                          <span className="text-white font-semibold">
                            Class of {admin.graduationYear}
                          </span>
                          <span className="block text-[10px] text-zinc-500 mt-0.5">
                            {admin.isPublished ? 'Published Live' : 'In Progress'}
                          </span>
                        </td>

                        <td className="p-4">
                          {admin.phone ? (
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-400 font-semibold">
                                {admin.phone}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(admin.phone);
                                  setCopiedAdminPhone(admin.id);
                                  setTimeout(() => setCopiedAdminPhone(null), 2000);
                                }}
                                title="Copy phone number"
                                className="text-zinc-500 hover:text-white cursor-pointer"
                              >
                                {copiedAdminPhone === admin.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-zinc-600 italic">No phone on record</span>
                          )}
                        </td>

                        <td className="p-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleSendAdminMessage(admin, 'whatsapp')}
                            className="px-3.5 py-2 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-[#25D366] font-mono-tech text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSendAdminMessage(admin, 'sms')}
                            className="px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-400 font-mono-tech text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>SMS</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-CLIP 3: NEXT-CLASS HANDOFFS (WHATSAPP & SMS RELAY TRACKER)
          ========================================================================= */}
      {communicationsTab === 'handoffs' && (
        <MasterNextClassHandoffsSection
          sets={sets}
          universities={universities}
          onViewDepartmentLegacyWall={onViewDepartmentLegacyWall}
        />
      )}
    </div>
  );
};
