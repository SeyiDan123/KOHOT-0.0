import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  CheckCircle2,
  Copy,
  Check,
  MessageCircle,
  MessageSquare,
  ChevronDown,
  Upload,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  UniversityDirectoryItem,
  ClassSet,
  WebsiteContentOverride,
  NextClassHandoffInvite,
} from '../../types';
import { getStoredNextClassInvites } from '../../data/initialData';
import { getWhatsAppDigits, formatNigerianPhoneNumber } from '../../utils/phoneFormatter';
import { logManualCommunication } from '../../utils/kohotCommunications';
import { uploadMediaToR2 } from '../../utils/apiClient';
import { compressImageToWebP } from '../../utils/imageCompressor';

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
  email?: string;
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
  const [communicationsTab, setCommunicationsTab] = useState<
    'executive_blast' | 'album_admins' | 'handoffs'
  >('executive_blast');

  // =========================================================================
  // 1. OUTREACH STATE
  // =========================================================================
  const [blastImageUrl, setBlastImageUrl] = useState<string>(
    (contentOverride as any)?.broadcastLinkContextImageUrl ||
      contentOverride?.executiveBlastImageUrl ||
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85'
  );
  const [blastMessageClip, setBlastMessageClip] = useState<string>(
    contentOverride?.executiveBlastMessageTemplate ||
      `Hello Department Executives and Student Leaders, preserve the memories and achievements of your graduating class on KoHot. Create your official class album and corridor Legacy Plaque here:\n{{website_url}}`
  );
  const [isEditingOutreachMessage, setIsEditingOutreachMessage] = useState(false);
  const [isChangingPreviewImage, setIsChangingPreviewImage] = useState(false);
  const [isUploadingPreviewImage, setIsUploadingPreviewImage] = useState(false);
  const [targetBlastAudience, setTargetBlastAudience] = useState<string>('all');
  const [copiedBlastLink, setCopiedBlastLink] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fullOutreachLink = useMemo(() => {
    const origin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://kohot.lumna.workers.dev';
    return `${origin}/?ref=dept_exec`;
  }, []);

  const displayOutreachLink = useMemo(() => {
    return fullOutreachLink.replace(/^https?:\/\//i, '');
  }, [fullOutreachLink]);

  const resolvedOutreachMessage = useMemo(() => {
    if (blastMessageClip.includes('{{website_url}}')) {
      return blastMessageClip.replace(/\{\{website_url\}\}/g, fullOutreachLink);
    }
    return `${blastMessageClip.trim()}\n${fullOutreachLink}`;
  }, [blastMessageClip, fullOutreachLink]);

  const handleUpdateBlastImage = (newUrl: string) => {
    setBlastImageUrl(newUrl);
    if (onUpdateContentOverride && contentOverride) {
      onUpdateContentOverride({
        ...contentOverride,
        executiveBlastImageUrl: newUrl,
      });
    }
    showToast('Link preview image updated.');
  };

  const handlePreviewImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPreviewImage(true);
    try {
      const compressed = await compressImageToWebP(file, 1200, 0.86);
      const uploaded = await uploadMediaToR2(compressed.dataUrl, {
        setId: 'site-hero',
        category: 'outreach-preview',
        fileName: file.name || 'outreach-preview.webp',
      });
      const finalUrl = uploaded.success && uploaded.url ? uploaded.url : compressed.dataUrl;
      handleUpdateBlastImage(finalUrl);
      setIsChangingPreviewImage(false);
    } catch {
      showToast('Could not upload image. Please try another photo.');
    } finally {
      setIsUploadingPreviewImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // =========================================================================
  // 2. REGISTERED ALBUM ADMINS STATE
  // =========================================================================
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminUniFilter, setAdminUniFilter] = useState<string>('all');
  const [isEditingAdminMessage, setIsEditingAdminMessage] = useState(false);
  const [adminMessageTemplate, setAdminMessageTemplate] = useState<string>(
    `Hello {{admin_name}}, this is KoHot Host reaching out regarding your {{department_name}} ({{institution_name}}) Class of {{graduation_year}} album:\n{{album_url}}`
  );

  const registeredAdmins = useMemo<RegisteredAdminContact[]>(() => {
    const list: RegisteredAdminContact[] = [];
    sets.forEach((set) => {
      if (set.deletedAt || set.id.startsWith('crownfield-')) return;

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
        email: set.classRepEmail || adminStudent?.email,
        departmentName: set.departmentName,
        institutionId: set.institutionId,
        institutionName: set.institutionName,
        graduationYear: set.graduationYear,
        classSetName: set.classSetName,
        isPublished: Boolean(set.isPublished),
      });

      const coAdminsList = (set as any).coAdmins;
      if (Array.isArray(coAdminsList)) {
        coAdminsList.forEach((co: any, idx: number) => {
          const coStudent = (set.students || []).find(
            (st) =>
              (co.email && st.email?.toLowerCase() === co.email.toLowerCase()) ||
              (co.fullName && st.fullName?.toLowerCase() === co.fullName.toLowerCase())
          );
          const coPhone =
            co.phone || coStudent?.whatsappNumber || (coStudent as any)?.phoneNumber || '';
          list.push({
            id: `coadmin-${set.id}-${idx}`,
            setId: set.id,
            adminName: co.fullName || coStudent?.fullName || 'Co-Admin',
            roleLabel: 'Co-Admin',
            phone: coPhone,
            email: co.email || coStudent?.email,
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
        return (
          admin.adminName.toLowerCase().includes(q) ||
          admin.departmentName.toLowerCase().includes(q) ||
          admin.institutionName.toLowerCase().includes(q) ||
          admin.phone.toLowerCase().includes(q) ||
          String(admin.graduationYear).includes(q)
        );
      }
      return true;
    });
  }, [registeredAdmins, adminUniFilter, adminSearchQuery]);

  const buildPersonalizedAdminMessage = (admin: RegisteredAdminContact) => {
    const albumUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/#album-${admin.setId}`
        : `https://kohot.lumna.workers.dev/#album-${admin.setId}`;

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
  };

  // =========================================================================
  // 3. HANDOFFS STATE
  // =========================================================================
  const [storedInvites] = useState<NextClassHandoffInvite[]>(getStoredNextClassInvites);
  const [handoffSearchQuery, setHandoffSearchQuery] = useState('');
  const [isEditingHandoffMessage, setIsEditingHandoffMessage] = useState(false);
  const [handoffMessageTemplate, setHandoffMessageTemplate] = useState<string>(
    `Hello {{contact_name}}, you have been nominated to lead the {{department_name}} ({{institution_name}}) Class of {{next_year}} digital album on KoHot. Initialize your class album here:\n{{invite_url}}`
  );

  const handoffRecords = useMemo(() => {
    const nonDemoSets = sets.filter((s) => !s.deletedAt && !s.id.startsWith('crownfield-'));
    return nonDemoSets
      .map((set) => {
        const nextYear = (set.graduationYear || new Date().getFullYear()) + 1;
        const invite = storedInvites.find(
          (i) =>
            i.fromSetId === set.id ||
            (i.targetDepartmentId === set.departmentId && i.targetClassYear === nextYear)
        );
        const contact =
          set.nextClassContact ||
          (invite
            ? {
                name: invite.targetContactName,
                phoneOrWhatsapp: invite.targetContactPhone,
                email: invite.targetContactEmail,
                graduatingYear: nextYear,
              }
            : undefined);

        const nextSetExists = nonDemoSets.some(
          (s) => s.departmentId === set.departmentId && s.graduationYear === nextYear
        );
        const status = nextSetExists ? 'approved' : invite?.status || (contact ? 'invited' : 'not_invited');

        return {
          set,
          invite,
          contact,
          nextYear,
          status,
        };
      })
      .filter((r) => Boolean(r.contact?.name || r.invite));
  }, [sets, storedInvites]);

  const filteredHandoffs = useMemo(() => {
    if (!handoffSearchQuery.trim()) return handoffRecords;
    const q = handoffSearchQuery.toLowerCase();
    return handoffRecords.filter(
      (rec) =>
        rec.set.departmentName.toLowerCase().includes(q) ||
        rec.set.institutionName.toLowerCase().includes(q) ||
        (rec.contact?.name || '').toLowerCase().includes(q) ||
        String(rec.nextYear).includes(q)
    );
  }, [handoffRecords, handoffSearchQuery]);

  const buildHandoffInviteLink = (rec: (typeof handoffRecords)[0]) => {
    const origin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://kohot.lumna.workers.dev';
    const params = new URLSearchParams();
    params.set('relay', '1');
    params.set('uni', rec.set.institutionId);
    if (rec.set.departmentId) params.set('deptId', rec.set.departmentId);
    params.set('dept', rec.set.departmentName);
    params.set('year', String(rec.nextYear));
    if (rec.contact?.name) params.set('repName', rec.contact.name);
    if (rec.contact?.phoneOrWhatsapp) params.set('repPhone', rec.contact.phoneOrWhatsapp);
    return `${origin}/?${params.toString()}`;
  };

  const handleDispatchHandoff = (rec: (typeof handoffRecords)[0], channel: 'whatsapp' | 'sms') => {
    const inviteUrl = buildHandoffInviteLink(rec);
    const msg = handoffMessageTemplate
      .replace(/\{\{contact_name\}\}/g, rec.contact?.name || 'Class Representative')
      .replace(/\{\{department_name\}\}/g, rec.set.departmentName)
      .replace(/\{\{institution_name\}\}/g, rec.set.institutionName)
      .replace(/\{\{next_year\}\}/g, String(rec.nextYear))
      .replace(/\{\{invite_url\}\}/g, inviteUrl);
    const encoded = encodeURIComponent(msg);
    const phone = rec.contact?.phoneOrWhatsapp || '';

    if (channel === 'whatsapp') {
      const waDigits = getWhatsAppDigits(phone);
      const waUrl = waDigits
        ? `https://wa.me/${waDigits}?text=${encoded}`
        : `https://api.whatsapp.com/send?text=${encoded}`;
      window.open(waUrl, '_blank');
    } else {
      const formattedPhone = formatNigerianPhoneNumber(phone);
      const smsUrl = formattedPhone
        ? `sms:${formattedPhone}?body=${encoded}`
        : `sms:?body=${encoded}`;
      window.location.href = smsUrl;
    }
  };

  return (
    <div id="master-communications-module" className="max-w-xl mx-auto space-y-5 animate-fadeIn pb-10">
      {/* =========================================================================
          TOP SEGMENTED PILL BAR: Outreach | Admins N | Handoffs N
          ========================================================================= */}
      <div className="p-1.5 rounded-full bg-white dark:bg-[#12151e] border border-slate-200/90 dark:border-white/10 grid grid-cols-3 items-center shadow-xs">
        <button
          type="button"
          id="comm-tab-executive-blast"
          onClick={() => setCommunicationsTab('executive_blast')}
          className={`py-2.5 px-3 rounded-full text-xs sm:text-sm font-syne transition-all cursor-pointer text-center truncate ${
            communicationsTab === 'executive_blast'
              ? 'bg-[#d4af37] text-black font-bold shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-medium'
          }`}
        >
          Outreach
        </button>

        <button
          type="button"
          id="comm-tab-album-admins"
          onClick={() => setCommunicationsTab('album_admins')}
          className={`py-2.5 px-3 rounded-full text-xs sm:text-sm font-syne transition-all cursor-pointer text-center truncate ${
            communicationsTab === 'album_admins'
              ? 'bg-[#d4af37] text-black font-bold shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-medium'
          }`}
        >
          Admins {registeredAdmins.length}
        </button>

        <button
          type="button"
          id="comm-tab-handoffs"
          onClick={() => setCommunicationsTab('handoffs')}
          className={`py-2.5 px-3 rounded-full text-xs sm:text-sm font-syne transition-all cursor-pointer text-center truncate ${
            communicationsTab === 'handoffs'
              ? 'bg-[#d4af37] text-black font-bold shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-medium'
          }`}
        >
          Handoffs {handoffRecords.length}
        </button>
      </div>

      {toastMessage && (
        <div className="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-body flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          TAB 1: OUTREACH MESSAGE (MATCHING SCREENSHOTS 1 & 3)
          ========================================================================= */}
      {communicationsTab === 'executive_blast' && (
        <div
          id="executive-blast-section"
          className="rounded-3xl bg-white dark:bg-[#12151e] border border-slate-200/90 dark:border-white/10 p-5 sm:p-6 space-y-5 shadow-xs"
        >
          {/* Card Header */}
          <div className="space-y-1">
            <h2 className="font-syne font-bold text-lg sm:text-xl text-slate-900 dark:text-white">
              Outreach message
            </h2>
            <p className="font-body text-xs sm:text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
              Invite department executives to create their class album. Links open the KoHot homepage.
            </p>
          </div>

          {/* Send to */}
          <div className="space-y-2">
            <label className="block font-body text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
              Send to
            </label>
            <div className="relative">
              <select
                value={targetBlastAudience}
                onChange={(e) => setTargetBlastAudience(e.target.value)}
                className="w-full appearance-none px-4 py-3.5 pr-10 rounded-2xl bg-white dark:bg-[#12151e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-body text-sm focus:outline-none focus:border-[#d4af37] cursor-pointer"
              >
                <option value="all">All universities and departments</option>
                {universities.map((uni) => (
                  <option key={uni.id} value={uni.id}>
                    {uni.name} ({uni.departments?.length || 0} departments)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 dark:text-zinc-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-body text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                Message
              </label>
              <button
                type="button"
                onClick={() => {
                  if (isEditingOutreachMessage && onUpdateContentOverride && contentOverride) {
                    onUpdateContentOverride({
                      ...contentOverride,
                      executiveBlastMessageTemplate: blastMessageClip,
                    });
                    showToast('Outreach message saved.');
                  }
                  setIsEditingOutreachMessage((prev) => !prev);
                }}
                className="font-body font-semibold text-xs sm:text-sm text-[#9a7b1c] dark:text-[#d4af37] hover:underline cursor-pointer"
              >
                {isEditingOutreachMessage ? 'Done' : 'Edit'}
              </button>
            </div>

            {isEditingOutreachMessage ? (
              <div className="space-y-2">
                <textarea
                  rows={5}
                  value={blastMessageClip}
                  onChange={(e) => setBlastMessageClip(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-[#f8f7f4] dark:bg-[#161a24] border border-[#d4af37] text-slate-900 dark:text-white font-body text-sm leading-relaxed focus:outline-none resize-y"
                />
                <div className="flex items-center justify-between text-[11px] font-mono-tech text-slate-500 dark:text-zinc-400">
                  <span>Include {'{{website_url}}'} to place the link automatically</span>
                  <button
                    type="button"
                    onClick={() => setBlastMessageClip((prev) => `${prev.trim()} {{website_url}}`)}
                    className="text-[#9a7b1c] dark:text-[#d4af37] hover:underline cursor-pointer"
                  >
                    + Insert {'{{website_url}}'}
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingOutreachMessage(true)}
                className="p-4 rounded-2xl bg-[#f8f7f4] dark:bg-[#161a24]/80 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-zinc-100 font-body text-sm leading-relaxed max-h-36 overflow-y-auto cursor-pointer"
              >
                {blastMessageClip.replace(/\{\{website_url\}\}/g, displayOutreachLink)}
              </div>
            )}
          </div>

          {/* Link */}
          <div className="space-y-2">
            <label className="block font-body text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
              Link
            </label>
            <div className="flex items-center gap-2.5">
              <div className="flex-1 min-w-0 px-4 py-3.5 rounded-2xl bg-white dark:bg-[#12151e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-body text-sm truncate select-all">
                {displayOutreachLink}
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(fullOutreachLink);
                  setCopiedBlastLink(true);
                  setTimeout(() => setCopiedBlastLink(false), 2500);
                }}
                className="px-5 py-3.5 rounded-2xl bg-white hover:bg-slate-50 dark:bg-[#161a24] dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-syne font-semibold text-sm transition-colors cursor-pointer shrink-0"
              >
                {copiedBlastLink ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Link preview image */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePreviewImageFileChange}
              className="hidden"
            />
            <div className="p-3 rounded-2xl bg-[#f8f7f4] dark:bg-[#161a24]/80 border border-slate-200/90 dark:border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-10 rounded-xl overflow-hidden bg-slate-300 dark:bg-zinc-700 border border-slate-200 dark:border-white/10 shrink-0">
                  {blastImageUrl && (
                    <img
                      src={blastImageUrl}
                      alt="Link preview"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <span className="font-body font-medium text-sm text-slate-900 dark:text-white truncate">
                  {isUploadingPreviewImage ? 'Uploading image...' : 'Link preview image'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsChangingPreviewImage((prev) => !prev)}
                className="font-body font-semibold text-xs sm:text-sm text-[#9a7b1c] dark:text-[#d4af37] hover:underline cursor-pointer shrink-0 pr-1"
              >
                {isChangingPreviewImage ? 'Close' : 'Change'}
              </button>
            </div>

            {isChangingPreviewImage && (
              <div className="p-4 rounded-2xl bg-[#f8f7f4] dark:bg-[#161a24] border border-slate-200 dark:border-white/10 space-y-3 animate-fadeIn">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPreviewImage}
                    className="px-4 py-2 rounded-xl bg-[#d4af37] hover:bg-[#c49f27] text-black font-syne font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingPreviewImage ? 'Uploading...' : 'Upload Photo'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdateBlastImage(
                        'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85'
                      );
                      setIsChangingPreviewImage(false);
                    }}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 text-xs font-body cursor-pointer"
                  >
                    Reset Default
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={blastImageUrl}
                    onChange={(e) => setBlastImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-[#12151e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs font-mono-tech focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdateBlastImage(blastImageUrl);
                      setIsChangingPreviewImage(false);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-syne font-bold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* WhatsApp & SMS Action Pill Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              id="exec-blast-whatsapp-btn"
              onClick={() => {
                window.open(
                  `https://api.whatsapp.com/send?text=${encodeURIComponent(resolvedOutreachMessage)}`,
                  '_blank'
                );
              }}
              className="h-12 rounded-full bg-[#e6f5ec] hover:bg-[#d5eedf] dark:bg-[#0d2818] dark:hover:bg-[#133822] border border-[#b8e2c8] dark:border-[#1e4d30] text-[#15803d] dark:text-[#34d399] font-syne font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              id="exec-blast-sms-btn"
              onClick={() => {
                window.location.href = `sms:?body=${encodeURIComponent(resolvedOutreachMessage)}`;
              }}
              className="h-12 rounded-full bg-white hover:bg-slate-50 dark:bg-[#161a24] dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-syne font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>SMS</span>
            </button>
          </div>

          <p className="text-center font-body text-xs text-slate-500 dark:text-zinc-400">
            Opens your WhatsApp or SMS app. Nothing is sent automatically.
          </p>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ADMINS (CLEAN UNIFIED CARD MATCHING OUTREACH DESIGN)
          ========================================================================= */}
      {communicationsTab === 'album_admins' && (
        <div
          id="registered-album-admins-messaging-section"
          className="rounded-3xl bg-white dark:bg-[#12151e] border border-slate-200/90 dark:border-white/10 p-5 sm:p-6 space-y-5 shadow-xs"
        >
          <div className="space-y-1">
            <h2 className="font-syne font-bold text-lg sm:text-xl text-slate-900 dark:text-white">
              Registered album admins
            </h2>
            <p className="font-body text-xs sm:text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
              Reach out to class album admins and co-admins using their registered contact details.
            </p>
          </div>

          {/* Filter by university */}
          <div className="space-y-2">
            <label className="block font-body text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
              Filter by institution
            </label>
            <div className="relative">
              <select
                value={adminUniFilter}
                onChange={(e) => setAdminUniFilter(e.target.value)}
                className="w-full appearance-none px-4 py-3.5 pr-10 rounded-2xl bg-white dark:bg-[#12151e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-body text-sm focus:outline-none focus:border-[#d4af37] cursor-pointer"
              >
                <option value="all">All universities and departments ({registeredAdmins.length})</option>
                {universities.map((uni) => (
                  <option key={uni.id} value={uni.id}>
                    {uni.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 dark:text-zinc-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Message Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-body text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                Message
              </label>
              <button
                type="button"
                onClick={() => setIsEditingAdminMessage((prev) => !prev)}
                className="font-body font-semibold text-xs sm:text-sm text-[#9a7b1c] dark:text-[#d4af37] hover:underline cursor-pointer"
              >
                {isEditingAdminMessage ? 'Done' : 'Edit'}
              </button>
            </div>

            {isEditingAdminMessage ? (
              <textarea
                rows={4}
                value={adminMessageTemplate}
                onChange={(e) => setAdminMessageTemplate(e.target.value)}
                className="w-full p-4 rounded-2xl bg-[#f8f7f4] dark:bg-[#161a24] border border-[#d4af37] text-slate-900 dark:text-white font-body text-sm leading-relaxed focus:outline-none resize-y"
              />
            ) : (
              <div
                onClick={() => setIsEditingAdminMessage(true)}
                className="p-4 rounded-2xl bg-[#f8f7f4] dark:bg-[#161a24]/80 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-zinc-100 font-body text-sm leading-relaxed cursor-pointer"
              >
                {adminMessageTemplate}
              </div>
            )}
          </div>

          {/* Search input if admins exist */}
          {registeredAdmins.length > 0 && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={adminSearchQuery}
                onChange={(e) => setAdminSearchQuery(e.target.value)}
                placeholder="Search admin name, department, or phone..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#f8f7f4] dark:bg-[#161a24]/80 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white font-body text-sm focus:outline-none focus:border-[#d4af37]"
              />
            </div>
          )}

          {/* Admin List */}
          {filteredAdmins.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#f8f7f4] dark:bg-[#161a24]/60 border border-slate-200/90 dark:border-white/10 text-center space-y-1">
              <p className="font-syne font-bold text-sm text-slate-900 dark:text-white">
                No registered album admins yet
              </p>
              <p className="font-body text-xs text-slate-500 dark:text-zinc-400">
                When class representatives create their department albums, their contact cards appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {filteredAdmins.map((admin) => (
                <div
                  key={admin.id}
                  className="p-4 rounded-2xl bg-[#f8f7f4] dark:bg-[#161a24]/80 border border-slate-200/90 dark:border-white/10 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-syne font-bold text-sm text-slate-900 dark:text-white truncate">
                        {admin.adminName}
                      </h4>
                      <p className="font-body text-xs text-slate-500 dark:text-zinc-400 truncate">
                        {admin.departmentName} · {admin.institutionName} ({admin.graduationYear})
                      </p>
                      {admin.phone && (
                        <p className="font-mono-tech text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                          {admin.phone}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech font-semibold shrink-0 ${
                        admin.isPublished
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {admin.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleSendAdminMessage(admin, 'whatsapp')}
                      className="h-10 rounded-full bg-[#e6f5ec] hover:bg-[#d5eedf] dark:bg-[#0d2818] dark:hover:bg-[#133822] border border-[#b8e2c8] dark:border-[#1e4d30] text-[#15803d] dark:text-[#34d399] font-syne font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendAdminMessage(admin, 'sms')}
                      className="h-10 rounded-full bg-white hover:bg-slate-50 dark:bg-[#12151e] dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-syne font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>SMS</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-center font-body text-xs text-slate-500 dark:text-zinc-400">
            Opens your WhatsApp or SMS app. Nothing is sent automatically.
          </p>
        </div>
      )}

      {/* =========================================================================
          TAB 3: HANDOFFS (CLEAN UNIFIED CARD MATCHING OUTREACH DESIGN)
          ========================================================================= */}
      {communicationsTab === 'handoffs' && (
        <div
          id="next-class-handoffs-section"
          className="rounded-3xl bg-white dark:bg-[#12151e] border border-slate-200/90 dark:border-white/10 p-5 sm:p-6 space-y-5 shadow-xs"
        >
          <div className="space-y-1">
            <h2 className="font-syne font-bold text-lg sm:text-xl text-slate-900 dark:text-white">
              Next-class handoffs
            </h2>
            <p className="font-body text-xs sm:text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
              Follow up with incoming class representatives nominated by graduating sets.
            </p>
          </div>

          {/* Message Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-body text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                Message
              </label>
              <button
                type="button"
                onClick={() => setIsEditingHandoffMessage((prev) => !prev)}
                className="font-body font-semibold text-xs sm:text-sm text-[#9a7b1c] dark:text-[#d4af37] hover:underline cursor-pointer"
              >
                {isEditingHandoffMessage ? 'Done' : 'Edit'}
              </button>
            </div>

            {isEditingHandoffMessage ? (
              <textarea
                rows={4}
                value={handoffMessageTemplate}
                onChange={(e) => setHandoffMessageTemplate(e.target.value)}
                className="w-full p-4 rounded-2xl bg-[#f8f7f4] dark:bg-[#161a24] border border-[#d4af37] text-slate-900 dark:text-white font-body text-sm leading-relaxed focus:outline-none resize-y"
              />
            ) : (
              <div
                onClick={() => setIsEditingHandoffMessage(true)}
                className="p-4 rounded-2xl bg-[#f8f7f4] dark:bg-[#161a24]/80 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-zinc-100 font-body text-sm leading-relaxed cursor-pointer"
              >
                {handoffMessageTemplate}
              </div>
            )}
          </div>

          {handoffRecords.length > 0 && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={handoffSearchQuery}
                onChange={(e) => setHandoffSearchQuery(e.target.value)}
                placeholder="Search incoming representative or department..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#f8f7f4] dark:bg-[#161a24]/80 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white font-body text-sm focus:outline-none focus:border-[#d4af37]"
              />
            </div>
          )}

          {filteredHandoffs.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#f8f7f4] dark:bg-[#161a24]/60 border border-slate-200/90 dark:border-white/10 text-center space-y-1">
              <p className="font-syne font-bold text-sm text-slate-900 dark:text-white">
                No next-class handoffs recorded yet
              </p>
              <p className="font-body text-xs text-slate-500 dark:text-zinc-400">
                When album admins enter the next set representative during publishing, their handoff details appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {filteredHandoffs.map((rec) => (
                <div
                  key={`${rec.set.id}-${rec.nextYear}`}
                  className="p-4 rounded-2xl bg-[#f8f7f4] dark:bg-[#161a24]/80 border border-slate-200/90 dark:border-white/10 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-syne font-bold text-sm text-slate-900 dark:text-white truncate">
                        {rec.contact?.name || `Class of ${rec.nextYear} Representative`}
                      </h4>
                      <p className="font-body text-xs text-slate-500 dark:text-zinc-400 truncate">
                        {rec.set.departmentName} · {rec.set.institutionName} (Class of {rec.nextYear})
                      </p>
                      {rec.contact?.phoneOrWhatsapp && (
                        <p className="font-mono-tech text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                          {rec.contact.phoneOrWhatsapp}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech font-semibold shrink-0 ${
                        rec.status === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {rec.status === 'approved' ? 'Onboarded' : 'Invited'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleDispatchHandoff(rec, 'whatsapp')}
                      className="h-10 rounded-full bg-[#e6f5ec] hover:bg-[#d5eedf] dark:bg-[#0d2818] dark:hover:bg-[#133822] border border-[#b8e2c8] dark:border-[#1e4d30] text-[#15803d] dark:text-[#34d399] font-syne font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDispatchHandoff(rec, 'sms')}
                      className="h-10 rounded-full bg-white hover:bg-slate-50 dark:bg-[#12151e] dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-syne font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>SMS</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-center font-body text-xs text-slate-500 dark:text-zinc-400">
            Opens your WhatsApp or SMS app. Nothing is sent automatically.
          </p>
        </div>
      )}
    </div>
  );
};
