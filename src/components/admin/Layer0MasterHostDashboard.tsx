import React, { useState, useEffect } from 'react';
import { 
  UniversityDirectoryItem, 
  DepartmentItem,
  ClassSet, 
  FinancialTransaction, 
  DepartmentAdditionRequest, 
  FoundingClassRequest,
  WebsiteContentOverride,
  UserAccount 
} from '../../types';
import { 
  INITIAL_UNIVERSITIES, 
  calculateTotalImages 
} from '../../data/initialData';
import { CROWNFIELD_PUBLIC_LAW_SETS } from '../../data/crownfieldLawDemos';
import { Layer1ClassRepDashboard } from './Layer1ClassRepDashboard';
import { getTheme, applyTheme } from '../../utils/theme';
import { ImageDropzone } from '../common/ImageDropzone';
import { 
  ArrowLeft,
  Database, 
  Sliders, 
  BarChart3, 
  DollarSign, 
  ShieldCheck, 
  Shield,
  RefreshCw, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  ExternalLink, 
  Eye, 
  EyeOff,
  LogOut, 
  Layers,
  Inbox,
  Sparkles,
  QrCode,
  Edit3,
  Clock,
  Image as ImageIcon,
  FolderPlus,
  Award,
  BookOpen,
  GraduationCap,
  Video,
  Upload,
  Play,
  Trash2,
  Calendar,
  Music,
  Volume2,
  Mail,
  Film,
  TrendingUp,
  ShoppingBag,
  Coins,
  Share2,
  Palette,
  Users,
  Camera,
  Sun,
  Moon
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { DepartmentLegacyPlaqueModal } from './DepartmentLegacyPlaqueModal';
import { EditDepartmentModal } from './EditDepartmentModal';
import { EditUniversityModal } from './EditUniversityModal';
import { MasterLegacyPlaquesSection } from './MasterLegacyPlaquesSection';
import { MasterAnnualRemindersSection } from './MasterAnnualRemindersSection';
import { MasterFoundingRequestsSection } from './MasterFoundingRequestsSection';
import { MasterWebsiteStatsSection } from './MasterWebsiteStatsSection';
import { MasterTestimonialsSection } from './MasterTestimonialsSection';
import { MasterDisputesSection } from './MasterDisputesSection';
import { MasterNextClassHandoffsSection } from './MasterNextClassHandoffsSection';
import { MasterAlbumMediaSection } from './MasterAlbumMediaSection';
import { MasterAlbumVisualsSection } from './MasterAlbumVisualsSection';
import { DashboardProfileMenu } from '../common/DashboardProfileMenu';

interface Layer0MasterHostDashboardProps {
  currentUser: UserAccount;
  universities: UniversityDirectoryItem[];
  sets: ClassSet[];
  transactions: FinancialTransaction[];
  additionRequests: DepartmentAdditionRequest[];
  foundingRequests: FoundingClassRequest[];
  contentOverride: WebsiteContentOverride;
  onUpdateUniversities: (unis: UniversityDirectoryItem[]) => void;
  onUpdateContentOverride: (content: WebsiteContentOverride) => void;
  onUpdateAdditionRequests: (reqs: DepartmentAdditionRequest[]) => void;
  onApproveFoundingRequest: (requestId: string, reviewNotes?: string) => void;
  onRejectFoundingRequest: (requestId: string, reason?: string) => void;
  onViewDepartmentAlbum: (setId: string) => void;
  onViewDepartmentLegacyWall?: (deptId: string, uniId?: string) => void;
  onEditDemoAlbum?: (setId: string) => void;
  onUpdateSingleSet?: (updatedSet: ClassSet) => void;
  onSwitchRole: (role: 'visitor') => void;
}

export const Layer0MasterHostDashboard: React.FC<Layer0MasterHostDashboardProps> = ({
  currentUser,
  universities,
  sets,
  transactions,
  additionRequests,
  foundingRequests,
  contentOverride,
  onUpdateUniversities,
  onUpdateContentOverride,
  onUpdateAdditionRequests,
  onApproveFoundingRequest,
  onRejectFoundingRequest,
  onViewDepartmentAlbum,
  onViewDepartmentLegacyWall,
  onEditDemoAlbum,
  onUpdateSingleSet,
  onSwitchRole,
}) => {
  const [activeTab, setActiveTab] = useState<
    'album_demos' | 'seeder' | 'founding_requests' | 'plaque' | 'reminders' | 'handoffs' | 'editor' | 'analytics' | 'requests' | 'testimonials' | 'disputes'
  >('album_demos');
  const [editingDemoSetId, setEditingDemoSetId] = useState<string | null>(null);
  const [seedingSuccessMsg, setSeedingSuccessMsg] = useState('');
  
  // Modals State
  const [selectedDeptForPlaque, setSelectedDeptForPlaque] = useState<{ dept: DepartmentItem; uni: UniversityDirectoryItem } | null>(null);
  const [selectedDeptForEdit, setSelectedDeptForEdit] = useState<{ dept: DepartmentItem; uni: UniversityDirectoryItem } | null>(null);
  const [selectedUniForEdit, setSelectedUniForEdit] = useState<UniversityDirectoryItem | null>(null);
  const [isAddUniOpen, setIsAddUniOpen] = useState(false);
  const [addingDeptUniId, setAddingDeptUniId] = useState<string | null>(null);

  // New University Seeding Form State
  const [newUniName, setNewUniName] = useState('');
  const [newUniShortCode, setNewUniShortCode] = useState('');
  const [newUniLogoUrl, setNewUniLogoUrl] = useState('');
  const [newUniOrderNumber, setNewUniOrderNumber] = useState<number>(universities.length + 1);
  const [newUniMotto, setNewUniMotto] = useState('');
  const [newUniWebsite, setNewUniWebsite] = useState('');
  const [newUniFaculty, setNewUniFaculty] = useState('');
  const [newUniDepartments, setNewUniDepartments] = useState('');

  // New Department Modal Form State
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptFaculty, setNewDeptFaculty] = useState('');
  const [newDeptLogoUrl, setNewDeptLogoUrl] = useState('');
  const [newDeptHeroUrl, setNewDeptHeroUrl] = useState('');
  const [newDeptCaption, setNewDeptCaption] = useState('');
  const [newDeptHod, setNewDeptHod] = useState('');
  const [newDeptPortal, setNewDeptPortal] = useState('');

  // Edit Module Form State
  const [editPlatformTitle, setEditPlatformTitle] = useState(contentOverride.platformTitle);
  const [editAnnouncement, setEditAnnouncement] = useState(contentOverride.platformAnnouncement);
  const [editAnnouncementActive, setEditAnnouncementActive] = useState(contentOverride.announcementActive);
  const [editMaxCap, setEditMaxCap] = useState(contentOverride.globalMaxImageCap);
  const [editSupportEmail, setEditSupportEmail] = useState(contentOverride.supportEmail);
  const [editCompressionResolution, setEditCompressionResolution] = useState(contentOverride.defaultCompressionResolution || 720);
  const [editCompressionQuality, setEditCompressionQuality] = useState(contentOverride.compressionQualityPercentage || 85);
  const [editMaxImagesPerAlbum, setEditMaxImagesPerAlbum] = useState(contentOverride.maxImagesPerAlbum || 400);
  const [editAlbumBgMusicUrl, setEditAlbumBgMusicUrl] = useState(contentOverride.albumBackgroundMusicUrl || '');
  const [editHeroVideoUrl, setEditHeroVideoUrl] = useState(contentOverride.heroVideoUrl || '');
  const [editClassAlbumTourUrl, setEditClassAlbumTourUrl] = useState(contentOverride.classAlbumCardVideoUrl || contentOverride.classAlbumTourUrl || '');
  const [editLegacyPlaqueTourUrl, setEditLegacyPlaqueTourUrl] = useState(contentOverride.legacyPlaqueCardVideoUrl || contentOverride.legacyPlaqueTourUrl || '');
  const [editAnnualReminderTourUrl, setEditAnnualReminderTourUrl] = useState(contentOverride.annualReminderTourUrl || contentOverride.annualReminderCardVideoUrl || '');
  
  // Website Sections Editable Text States
  // 1. Hero Section
  const [editHeroHeadlineLine1, setEditHeroHeadlineLine1] = useState(contentOverride.heroHeadlineLine1 || 'Beautiful');
  const [editHeroHeadlineLine2, setEditHeroHeadlineLine2] = useState(contentOverride.heroHeadlineLine2 || 'graduate memories');
  const [editHeroHeadlineLine3, setEditHeroHeadlineLine3] = useState(contentOverride.heroHeadlineLine3 || 'live here');
  const [editHeroSubtitle, setEditHeroSubtitle] = useState(contentOverride.heroSubtitle || 'From your classmates and portraits to the moments, words and stories you shared, KoHot gives your graduating class a beautiful place to remember it all.');
  const [editHeroCtaButtonText, setEditHeroCtaButtonText] = useState(contentOverride.heroCtaButtonText || 'Create Class Album');
  const [editHeroExploreButtonText, setEditHeroExploreButtonText] = useState(contentOverride.heroExploreButtonText || 'Explore Demo Albums');
  const [editHeroVideoCaptionTitle, setEditHeroVideoCaptionTitle] = useState(contentOverride.heroVideoCaptionTitle || 'The Physical to Digital Gateway');
  const [editHeroVideoCaptionSubtext, setEditHeroVideoCaptionSubtext] = useState(contentOverride.heroVideoCaptionSubtext || 'Scan the corridor plaque • Open your preserved class album');

  // 2. Pillars Section
  const [editPillarsEyebrow, setEditPillarsEyebrow] = useState(contentOverride.pillarsEyebrow || 'THE THREE PILLARS');
  const [editPillarsHeading, setEditPillarsHeading] = useState(contentOverride.pillarsHeading || 'Everything your class needs to leave a legacy');
  const [editPillarsSubtitle, setEditPillarsSubtitle] = useState(contentOverride.pillarsSubtitle || 'Three essential elements to preserve your people, your memories, and your story.');
  const [editPillar1Title, setEditPillar1Title] = useState(contentOverride.pillar1Title || 'The Class Album');
  const [editPillar1Description, setEditPillar1Description] = useState(contentOverride.pillar1Description || 'A private, interactive digital home for your class. Full individual graduate profiles, memorable moments, candid stories, and shared photos.');
  const [editPillar2Title, setEditPillar2Title] = useState(contentOverride.pillar2Title || 'The Legacy Plaque');
  const [editPillar2Description, setEditPillar2Description] = useState(contentOverride.pillar2Description || 'A physical, beautifully cast plaque installed permanently in your faculty corridor. A scannable gateway connecting campus corridors to your class album.');
  const [editPillar3Title, setEditPillar3Title] = useState(contentOverride.pillar3Title || 'The Annual Reminder');
  const [editPillar3Description, setEditPillar3Description] = useState(contentOverride.pillar3Description || 'An automated anniversary tradition. Every year on convocation day, every graduate receives a nostalgic notification reconnecting them to their memories.');

  // 3. How It Works & Department Legacy
  const [editHowItWorksEyebrow, setEditHowItWorksEyebrow] = useState(contentOverride.howItWorksEyebrow || 'THE JOURNEY');
  const [editHowItWorksHeading, setEditHowItWorksHeading] = useState(contentOverride.howItWorksHeading || 'How Your Class Leaves a Lasting Legacy');
  const [editDepartmentLegacyTitle, setEditDepartmentLegacyTitle] = useState(contentOverride.departmentLegacyTitle || 'ONE DEPARTMENT. MANY GENERATIONS.');
  const [editDepartmentLegacyDescription, setEditDepartmentLegacyDescription] = useState(contentOverride.departmentLegacyDescription || 'A living archive for your department. Preceding classes hand the baton forward, creating an unbroken chain of student milestones.');
  const [editPrivacyGuaranteeTitle, setEditPrivacyGuaranteeTitle] = useState(contentOverride.privacyGuaranteeTitle || 'Reassuring, Private & Student-Controlled');
  const [editPrivacyGuaranteeDescription, setEditPrivacyGuaranteeDescription] = useState(contentOverride.privacyGuaranteeDescription || 'Only classmates with verified invite links can upload or view unlisted albums. Student data is never sold or used for advertising.');

  // 4. Testimonials Section
  const [editTestimonialsEyebrow, setEditTestimonialsEyebrow] = useState(contentOverride.testimonialsEyebrow || 'THE LEGACY, IN THEIR WORDS');
  const [editTestimonialsHeading, setEditTestimonialsHeading] = useState(contentOverride.testimonialsHeading || 'What Graduating Classes Say');
  const [editTestimonialsSubtitle, setEditTestimonialsSubtitle] = useState(contentOverride.testimonialsSubtitle || 'Real experiences from class representatives and graduates who archived their milestones on KoHot.');

  // 5. KoHot Awards Section
  const [editAwardsEyebrow, setEditAwardsEyebrow] = useState(contentOverride.awardsEyebrow || 'OFFICIAL SPONSOR OF KOHOT’S LEGACY PRESERVATION');
  const [editAwardsHeading, setEditAwardsHeading] = useState(contentOverride.awardsHeading || 'KoHot Excellence & Class Legacy Awards');
  const [editAwardsBadge, setEditAwardsBadge] = useState(contentOverride.awardsBadge || 'COMING SOON');
  const [editAwardsDescription, setEditAwardsDescription] = useState(contentOverride.awardsDescription || 'Annual recognition celebrating the most creative class albums, outstanding department preservation, and legendary cohort class albums across universities.');

  const DEFAULT_LEGACY_BANNER_IMAGES = [
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1600&auto=format&fit=crop',
  ];
  const [editLegacyBannerImages, setEditLegacyBannerImages] = useState<string[]>(
    contentOverride.legacyBannerImages && contentOverride.legacyBannerImages.length === 4
      ? contentOverride.legacyBannerImages
      : DEFAULT_LEGACY_BANNER_IMAGES
  );

  // Dashboards permanently remain dark with grey shades
  const isLightMode = false;
  const [displayedOwnerName, setDisplayedOwnerName] = useState(currentUser.fullName || 'Seyi Dan');

  useEffect(() => {
    if (currentUser.fullName) setDisplayedOwnerName(currentUser.fullName);
  }, [currentUser.fullName]);

  useEffect(() => {
    const handleProfileUpdated = (e: any) => {
      if (e.detail?.fullName) {
        setDisplayedOwnerName(e.detail.fullName);
      }
    };
    window.addEventListener('kohot_user_profile_updated', handleProfileUpdated);
    return () => window.removeEventListener('kohot_user_profile_updated', handleProfileUpdated);
  }, []);

  const [editorSavedMsg, setEditorSavedMsg] = useState(false);
  const [mediaSubTab, setMediaSubTab] = useState<'website' | 'albums'>('website');
  const [editBrandName, setEditBrandName] = useState(contentOverride.brandName || 'KOHOT');
  const [editWebsiteLogoUrl, setEditWebsiteLogoUrl] = useState(contentOverride.websiteLogoUrl || '');
  const [inspectingAlbumMediaId, setInspectingAlbumMediaId] = useState<string | null>(null);
  const [albumMediaSearch, setAlbumMediaSearch] = useState('');

  // Keep state synchronized with contentOverride so changes remain permanent across views and updates
  useEffect(() => {
    if (contentOverride) {
      setEditPlatformTitle(contentOverride.platformTitle || '');
      setEditAnnouncement(contentOverride.platformAnnouncement || '');
      setEditAnnouncementActive(Boolean(contentOverride.announcementActive));
      setEditMaxCap(contentOverride.globalMaxImageCap || 300);
      setEditSupportEmail(contentOverride.supportEmail || 'support@kohot.app');
      setEditCompressionResolution(contentOverride.defaultCompressionResolution || 720);
      setEditCompressionQuality(contentOverride.compressionQualityPercentage || 85);
      setEditMaxImagesPerAlbum(contentOverride.maxImagesPerAlbum || 400);
      setEditAlbumBgMusicUrl(contentOverride.albumBackgroundMusicUrl || '');
      setEditHeroVideoUrl(contentOverride.heroVideoUrl || '');
      setEditClassAlbumTourUrl(contentOverride.classAlbumCardVideoUrl || contentOverride.classAlbumTourUrl || '');
      setEditLegacyPlaqueTourUrl(contentOverride.legacyPlaqueCardVideoUrl || contentOverride.legacyPlaqueTourUrl || '');
      setEditAnnualReminderTourUrl(contentOverride.annualReminderTourUrl || contentOverride.annualReminderCardVideoUrl || '');

      setEditHeroHeadlineLine1(contentOverride.heroHeadlineLine1 || 'Beautiful');
      setEditHeroHeadlineLine2(contentOverride.heroHeadlineLine2 || 'graduate memories');
      setEditHeroHeadlineLine3(contentOverride.heroHeadlineLine3 || 'live here');
      setEditHeroSubtitle(contentOverride.heroSubtitle || 'From your classmates and portraits to the moments, words and stories you shared, KoHot gives your graduating class a beautiful place to remember it all.');
      setEditHeroCtaButtonText(contentOverride.heroCtaButtonText || 'Create Class Album');
      setEditHeroExploreButtonText(contentOverride.heroExploreButtonText || 'Explore Demo Albums');
      setEditHeroVideoCaptionTitle(contentOverride.heroVideoCaptionTitle || 'The Physical to Digital Gateway');
      setEditHeroVideoCaptionSubtext(contentOverride.heroVideoCaptionSubtext || 'Scan the corridor plaque • Open your preserved class album');

      setEditPillarsEyebrow(contentOverride.pillarsEyebrow || 'THE THREE PILLARS');
      setEditPillarsHeading(contentOverride.pillarsHeading || 'Everything your class needs to leave a legacy');
      setEditPillarsSubtitle(contentOverride.pillarsSubtitle || 'Three essential elements to preserve your people, your memories, and your story.');
      setEditPillar1Title(contentOverride.pillar1Title || 'The Class Album');
      setEditPillar1Description(contentOverride.pillar1Description || 'A private, interactive digital home for your class. Full individual graduate profiles, memorable moments, candid stories, and shared photos.');
      setEditPillar2Title(contentOverride.pillar2Title || 'The Legacy Plaque');
      setEditPillar2Description(contentOverride.pillar2Description || 'A physical, beautifully cast plaque installed permanently in your faculty corridor. A scannable gateway connecting campus corridors to your class album.');
      setEditPillar3Title(contentOverride.pillar3Title || 'The Annual Reminder');
      setEditPillar3Description(contentOverride.pillar3Description || 'An automated anniversary tradition. Every year on convocation day, every graduate receives a nostalgic notification reconnecting them to their memories.');

      setEditHowItWorksEyebrow(contentOverride.howItWorksEyebrow || 'THE JOURNEY');
      setEditHowItWorksHeading(contentOverride.howItWorksHeading || 'How Your Class Leaves a Lasting Legacy');
      setEditDepartmentLegacyTitle(contentOverride.departmentLegacyTitle || 'ONE DEPARTMENT. MANY GENERATIONS.');
      setEditDepartmentLegacyDescription(contentOverride.departmentLegacyDescription || 'A living archive for your department. Preceding classes hand the baton forward, creating an unbroken chain of student milestones.');
      setEditPrivacyGuaranteeTitle(contentOverride.privacyGuaranteeTitle || 'Reassuring, Private & Student-Controlled');
      setEditPrivacyGuaranteeDescription(contentOverride.privacyGuaranteeDescription || 'Only classmates with verified invite links can upload or view unlisted albums. Student data is never sold or used for advertising.');

      setEditTestimonialsEyebrow(contentOverride.testimonialsEyebrow || 'THE LEGACY, IN THEIR WORDS');
      setEditTestimonialsHeading(contentOverride.testimonialsHeading || 'What Graduating Classes Say');
      setEditTestimonialsSubtitle(contentOverride.testimonialsSubtitle || 'Real experiences from class representatives and graduates who archived their milestones on KoHot.');

      setEditAwardsEyebrow(contentOverride.awardsEyebrow || 'OFFICIAL SPONSOR OF KOHOT’S LEGACY PRESERVATION');
      setEditAwardsHeading(contentOverride.awardsHeading || 'KoHot Excellence & Class Legacy Awards');
      setEditAwardsBadge(contentOverride.awardsBadge || 'COMING SOON');
      setEditAwardsDescription(contentOverride.awardsDescription || 'Annual recognition celebrating the most creative class albums, outstanding department preservation, and legendary cohort class albums across universities.');
      setEditBrandName(contentOverride.brandName || 'KOHOT');
      setEditWebsiteLogoUrl(contentOverride.websiteLogoUrl || '');
      setEditLegacyBannerImages(
        contentOverride.legacyBannerImages && contentOverride.legacyBannerImages.length === 4
          ? contentOverride.legacyBannerImages
          : DEFAULT_LEGACY_BANNER_IMAGES
      );
    }
  }, [contentOverride]);

  const handleAudioBgUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|aac|ogg)$/i)) {
      console.warn('Invalid audio file format. Only mp3, wav, m4a, aac, or ogg are allowed.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setEditAlbumBgMusicUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleVideoTourUpload = (file: File, target: 'hero' | 'album' | 'plaque' | 'reminder') => {
    if (!file) return;
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|webm|mov|m4v)$/i)) {
      console.warn('Invalid video file format uploaded. Only .mp4, .webm, or .mov are allowed.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (target === 'hero') {
        setEditHeroVideoUrl(dataUrl);
      } else if (target === 'album') {
        setEditClassAlbumTourUrl(dataUrl);
      } else if (target === 'plaque') {
        setEditLegacyPlaqueTourUrl(dataUrl);
      } else {
        setEditAnnualReminderTourUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Analytics Metrics
  const totalActiveImages = calculateTotalImages(sets);
  const globalCap = contentOverride.globalMaxImageCap || 300;
  const usagePercentage = Math.min(100, Math.round((totalActiveImages / globalCap) * 100));

  // Financial Stats
  const totalRevenue = transactions
    .filter((t) => t.status === 'Paid')
    .reduce((acc, t) => acc + t.amount, 0);

  // Execute Automated Database Seeding Tool
  const handleExecuteDefaultSeed = () => {
    onUpdateUniversities(INITIAL_UNIVERSITIES);
    setSeedingSuccessMsg('Preloaded institutional directories and official logo URLs successfully re-seeded!');
    setTimeout(() => setSeedingSuccessMsg(''), 4000);
  };

  const handleAddNewUniversitySeed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUniName || !newUniLogoUrl) return;

    const parsedDepts = newUniDepartments
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);

    const defaultFacName = newUniFaculty.trim() || 'Faculty of Sciences';
    const deptItems: DepartmentItem[] = parsedDepts.length > 0 
      ? parsedDepts.map((dName, idx) => ({
          id: `dept-${newUniShortCode.toLowerCase()}-${idx + 1}`,
          universityId: newUniShortCode.toLowerCase() || `uni-${Date.now()}`,
          name: dName,
          code: dName.slice(0, 3).toUpperCase(),
          faculty: defaultFacName,
          logoUrl: newUniLogoUrl.trim(),
          heroImageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85',
          caption: `${dName} academic sanctum, research corridors, and collective student milestones.`,
          officialPortal: newUniWebsite || 'https://edu.ng',
        }))
      : [
          {
            id: `dept-${newUniShortCode.toLowerCase()}-1`,
            universityId: newUniShortCode.toLowerCase() || `uni-${Date.now()}`,
            name: 'Computer Science',
            code: 'CSC',
            faculty: defaultFacName,
            logoUrl: newUniLogoUrl.trim(),
            heroImageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85',
            caption: 'Computer Science academic sanctum, research corridors, and collective student milestones.',
            officialPortal: newUniWebsite || 'https://edu.ng',
          }
        ];

    const newUniItem: UniversityDirectoryItem = {
      id: newUniShortCode.toLowerCase() || `uni-${Date.now()}`,
      orderNumber: newUniOrderNumber || (universities.length + 1),
      name: newUniName.trim(),
      shortCode: newUniShortCode.trim() || 'UNI',
      location: 'Accredited Campus',
      logoUrl: newUniLogoUrl.trim(),
      motto: newUniMotto.trim() || 'Excellence & Integrity',
      officialWebsite: newUniWebsite.trim() || 'https://edu.ng',
      departments: deptItems,
      faculties: [
        {
          facultyName: defaultFacName,
          departments: deptItems.map((d) => d.name),
        },
      ],
    };

    onUpdateUniversities([newUniItem, ...universities]);
    setNewUniName('');
    setNewUniShortCode('');
    setNewUniLogoUrl('');
    setNewUniMotto('');
    setNewUniWebsite('');
    setNewUniFaculty('');
    setNewUniDepartments('');
    setNewUniOrderNumber(universities.length + 2);
    setSeedingSuccessMsg(`Successfully added University #${newUniItem.orderNumber} ${newUniItem.name}!`);
    setTimeout(() => setSeedingSuccessMsg(''), 4000);
  };

  const handleAddNewDepartment = (uniId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName) return;

    const targetUni = universities.find((u) => u.id === uniId);
    if (!targetUni) return;

    const newDept: DepartmentItem = {
      id: `dept-${targetUni.shortCode.toLowerCase()}-${(targetUni.departments?.length || 0) + 1}-${Date.now()}`,
      universityId: uniId,
      name: newDeptName.trim(),
      code: newDeptCode.trim().toUpperCase() || newDeptName.slice(0, 3).toUpperCase(),
      faculty: newDeptFaculty.trim() || targetUni.faculties[0]?.facultyName || 'Faculty of Sciences',
      logoUrl: newDeptLogoUrl.trim() || targetUni.logoUrl,
      heroImageUrl: newDeptHeroUrl.trim() || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85',
      caption: newDeptCaption.trim() || `${newDeptName} department lecture theatres, faculty laboratories, and legacy milestones.`,
      hodName: newDeptHod.trim() || undefined,
      officialPortal: newDeptPortal.trim() || targetUni.officialWebsite,
    };

    const updatedUniversities = universities.map((u) => {
      if (u.id !== uniId) return u;
      const currentDepts = u.departments || [];
      return {
        ...u,
        departments: [...currentDepts, newDept],
      };
    });

    onUpdateUniversities(updatedUniversities);
    setAddingDeptUniId(null);
    setNewDeptName('');
    setNewDeptCode('');
    setNewDeptFaculty('');
    setNewDeptLogoUrl('');
    setNewDeptHeroUrl('');
    setNewDeptCaption('');
    setNewDeptHod('');
    setNewDeptPortal('');
    setSeedingSuccessMsg(`Successfully added Department: ${newDept.name} under ${targetUni.name}!`);
    setTimeout(() => setSeedingSuccessMsg(''), 4000);
  };

  const handleSaveEditedDepartment = (updatedDept: DepartmentItem, uniId: string) => {
    const updatedUniversities = universities.map((u) => {
      if (u.id !== uniId) return u;
      const currentDepts = u.departments || [];
      const updatedDepts = currentDepts.map((d) => (d.id === updatedDept.id ? updatedDept : d));
      return {
        ...u,
        departments: updatedDepts,
      };
    });

    onUpdateUniversities(updatedUniversities);
    setSelectedDeptForEdit(null);
    setSeedingSuccessMsg(`Updated Department Hero image & metadata for ${updatedDept.name}!`);
    setTimeout(() => setSeedingSuccessMsg(''), 4000);
  };

  const handleSaveEditedUniversity = (updatedUni: UniversityDirectoryItem) => {
    const updatedUniversities = universities.map((u) => (u.id === updatedUni.id ? updatedUni : u));
    onUpdateUniversities(updatedUniversities);
    setSelectedUniForEdit(null);
    setSeedingSuccessMsg(`Successfully updated Institutional Directory for ${updatedUni.name}!`);
    setTimeout(() => setSeedingSuccessMsg(''), 4000);
  };

  const handleSaveContentOverride = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateContentOverride({
      ...contentOverride,
      platformTitle: editPlatformTitle.trim(),
      platformAnnouncement: editAnnouncement.trim(),
      announcementActive: editAnnouncementActive,
      globalMaxImageCap: Number(editMaxCap),
      supportEmail: editSupportEmail.trim(),
      defaultCompressionResolution: Number(editCompressionResolution),
      compressionQualityPercentage: Number(editCompressionQuality),
      maxImagesPerAlbum: Number(editMaxImagesPerAlbum),
      albumBackgroundMusicUrl: editAlbumBgMusicUrl.trim(),
      heroVideoUrl: editHeroVideoUrl.trim(),
      classAlbumCardVideoUrl: editClassAlbumTourUrl.trim(),
      classAlbumTourUrl: editClassAlbumTourUrl.trim(),
      legacyPlaqueCardVideoUrl: editLegacyPlaqueTourUrl.trim(),
      legacyPlaqueTourUrl: editLegacyPlaqueTourUrl.trim(),
      annualReminderCardVideoUrl: editAnnualReminderTourUrl.trim(),
      annualReminderTourUrl: editAnnualReminderTourUrl.trim(),
      // Website Section Texts
      heroHeadlineLine1: editHeroHeadlineLine1.trim(),
      heroHeadlineLine2: editHeroHeadlineLine2.trim(),
      heroHeadlineLine3: editHeroHeadlineLine3.trim(),
      heroSubtitle: editHeroSubtitle.trim(),
      heroCtaButtonText: editHeroCtaButtonText.trim(),
      heroExploreButtonText: editHeroExploreButtonText.trim(),
      heroVideoCaptionTitle: editHeroVideoCaptionTitle.trim(),
      heroVideoCaptionSubtext: editHeroVideoCaptionSubtext.trim(),
      pillarsEyebrow: editPillarsEyebrow.trim(),
      pillarsHeading: editPillarsHeading.trim(),
      pillarsSubtitle: editPillarsSubtitle.trim(),
      pillar1Title: editPillar1Title.trim(),
      pillar1Description: editPillar1Description.trim(),
      pillar2Title: editPillar2Title.trim(),
      pillar2Description: editPillar2Description.trim(),
      pillar3Title: editPillar3Title.trim(),
      pillar3Description: editPillar3Description.trim(),
      howItWorksEyebrow: editHowItWorksEyebrow.trim(),
      howItWorksHeading: editHowItWorksHeading.trim(),
      departmentLegacyTitle: editDepartmentLegacyTitle.trim(),
      departmentLegacyDescription: editDepartmentLegacyDescription.trim(),
      privacyGuaranteeTitle: editPrivacyGuaranteeTitle.trim(),
      privacyGuaranteeDescription: editPrivacyGuaranteeDescription.trim(),
      testimonialsEyebrow: editTestimonialsEyebrow.trim(),
      testimonialsHeading: editTestimonialsHeading.trim(),
      testimonialsSubtitle: editTestimonialsSubtitle.trim(),
      awardsEyebrow: editAwardsEyebrow.trim(),
      awardsHeading: editAwardsHeading.trim(),
      awardsBadge: editAwardsBadge.trim(),
      awardsDescription: editAwardsDescription.trim(),
      brandName: editBrandName.trim() || 'KOHOT',
      websiteLogoUrl: editWebsiteLogoUrl.trim() || undefined,
      legacyBannerImages: editLegacyBannerImages,
    });
    setEditorSavedMsg(true);
    setTimeout(() => setEditorSavedMsg(false), 3000);
  };

  const handleApproveRequest = (request: DepartmentAdditionRequest) => {
    const targetUni = universities.find(
      (u) => u.name.toLowerCase() === request.institutionName.toLowerCase()
    );

    if (targetUni) {
      const targetFaculty = targetUni.faculties.find(
        (f) => f.facultyName.toLowerCase() === request.facultyName.toLowerCase()
      );

      if (targetFaculty) {
        if (!targetFaculty.departments.includes(request.requestedDepartment)) {
          targetFaculty.departments.push(request.requestedDepartment);
        }
      } else {
        targetUni.faculties.push({
          facultyName: request.facultyName,
          departments: [request.requestedDepartment],
        });
      }
      onUpdateUniversities([...universities]);
    }

    const updated = additionRequests.map((r) =>
      r.id === request.id ? { ...r, status: 'Approved' as const } : r
    );
    onUpdateAdditionRequests(updated);
  };

  if (editingDemoSetId) {
    const targetSet = sets.find((s) => s.id === editingDemoSetId) || CROWNFIELD_PUBLIC_LAW_SETS.find((s) => s.id === editingDemoSetId);
    if (targetSet) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#121214]">
          <div className="sticky top-0 z-50 bg-[#18181b] border-b border-[#d4af37]/30 px-4 sm:px-8 py-3 flex items-center justify-between text-white shadow-xl">
            <div className="flex items-center gap-3">
              <button
                type="button"
                id="back-to-album-demos-btn"
                onClick={() => setEditingDemoSetId(null)}
                className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-white/20"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Owner Dashboard (Album Demos)</span>
              </button>
              <span className="text-[#d4af37] font-mono-tech text-xs hidden md:inline">
                • Editing Demo: {targetSet.classSetName} ({targetSet.departmentName}, {targetSet.institutionName})
              </span>
            </div>
            <button
              type="button"
              onClick={() => onViewDepartmentAlbum(targetSet.id)}
              className="px-3.5 py-1.5 rounded-full bg-[#d4af37] text-black font-syne font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow hover:bg-amber-400"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Preview Live Demo</span>
            </button>
          </div>
          <Layer1ClassRepDashboard
            currentUser={{
              id: 'owner-admin',
              email: targetSet.classRepEmail,
              fullName: `${targetSet.classRepName} (Owner Demo Mode)`,
              role: 'class_rep',
              assignedSetId: targetSet.id,
            }}
            currentSet={targetSet}
            contentOverride={contentOverride}
            onUpdateSet={(updated) => {
              if (onUpdateSingleSet) onUpdateSingleSet(updated);
            }}
            onViewAlbum={() => onViewDepartmentAlbum(targetSet.id)}
            onSwitchRole={() => setEditingDemoSetId(null)}
            onBackToLanding={() => setEditingDemoSetId(null)}
            onMainDashboard={() => setEditingDemoSetId(null)}
            showMainButton={true}
          />
        </div>
      );
    }
  }

  return (
    <div 
      id="master-host-dashboard" 
      data-dashboard-theme={isLightMode ? 'light' : 'dark'}
      className={`min-h-screen pb-24 font-body transition-colors selection:bg-[#d4af37]/30 ${
        isLightMode 
          ? 'bg-[#f1f3f7] text-zinc-900 dashboard-light' 
          : 'bg-[#121214] text-[#e2e4e9] dashboard-dark'
      }`}
    >
      {/* Top Command Banner - Clean, Unified Header */}
      <header className={`sticky top-0 z-30 backdrop-blur-xl border-b px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 transition-colors ${
        isLightMode 
          ? 'bg-white/95 border-zinc-300 text-black shadow-sm' 
          : 'bg-[#18181b]/95 border-zinc-800 text-white'
      }`}>
        {/* Left: KoHot Brand Logo & Owner Title and Name */}
        <div className="flex items-center gap-3.5 min-w-0">
          <BrandLogo
            logoUrl={contentOverride?.websiteLogoUrl}
            brandName={contentOverride?.brandName || 'KOHOT'}
            textSize="text-sm sm:text-base"
            textColor={isLightMode ? 'text-black' : 'text-white'}
          />
          <span className={isLightMode ? 'text-zinc-400 font-mono-tech text-xs' : 'text-zinc-600 font-mono-tech text-xs'}>|</span>
          <div className="min-w-0 leading-tight">
            <div className="font-mono-tech text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-bold">
              Owner
            </div>
            <div className="font-syne font-bold text-xs sm:text-sm truncate text-white">
              {displayedOwnerName}
            </div>
          </div>
        </div>

        {/* Right: Master Host Profile Menu (Theme switch removed) */}
        <div className="flex items-center gap-3 shrink-0">
          <DashboardProfileMenu
            currentUser={currentUser}
            roleTitle="Master Host / Owner"
            onLogout={() => onSwitchRole('visitor')}
            notifications={[
              {
                id: 'notif-owner-1',
                title: 'Command Center Active',
                description: `${sets.length} Class Albums active across ${universities.length} universities.`,
                time: 'Realtime',
                unread: true,
              },
              {
                id: 'notif-owner-2',
                title: 'Founding Inquiries',
                description: `${foundingRequests.filter(r => r.status === 'Pending').length} pending founding class sponsorship requests.`,
                time: '1h ago',
                unread: foundingRequests.filter(r => r.status === 'Pending').length > 0,
              },
              {
                id: 'notif-owner-3',
                title: 'Department Inquiries',
                description: `${additionRequests.filter(r => r.status === 'Pending').length} unlisted department inquiries pending review.`,
                time: '3h ago',
                unread: additionRequests.filter(r => r.status === 'Pending').length > 0,
              },
            ]}
          />
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 sm:pt-10 space-y-8">
        
        {/* Command Navigation Tabs */}
        <div className={`flex items-center gap-2 overflow-x-auto no-scrollbar border-b pb-4 ${
          isLightMode ? 'border-zinc-200' : 'border-white/[0.08]'
        }`}>
          <button
            id="tab-album-demos-btn"
            onClick={() => setActiveTab('album_demos')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'album_demos'
                ? 'bg-[#d4af37] text-black font-bold shadow-md'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#18181b] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Album Demos</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono-tech font-bold ${
              activeTab === 'album_demos' ? 'bg-black text-white' : 'bg-amber-400/20 text-amber-500'
            }`}>
              Crownfield Law (4)
            </span>
          </button>

          <button
            id="tab-seeder-btn"
            onClick={() => setActiveTab('seeder')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'seeder'
                ? isLightMode ? 'bg-zinc-950 text-white font-semibold shadow-md' : 'bg-white text-black font-semibold shadow'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#18181b] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>University Directory</span>
          </button>

          <button
            id="tab-founding-requests-btn"
            onClick={() => setActiveTab('founding_requests')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'founding_requests'
                ? 'bg-[#d4af37] text-black font-semibold shadow'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#18181b] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Founding Requests</span>
            {foundingRequests.filter((r) => r.status === 'Pending').length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-900 border border-amber-500/40 text-[10px] font-mono-tech font-bold">
                {foundingRequests.filter((r) => r.status === 'Pending').length}
              </span>
            )}
          </button>

          <button
            id="tab-plaque-btn"
            onClick={() => setActiveTab('plaque')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'plaque'
                ? isLightMode ? 'bg-zinc-950 text-white font-semibold shadow-md' : 'bg-white text-black font-semibold shadow'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#18181b] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Legacy Plaques</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono-tech font-bold ${
              isLightMode ? 'bg-zinc-100 text-black' : 'bg-white/10 text-zinc-300'
            }`}>
              {sets.length}
            </span>
          </button>

          <button
            id="tab-reminders-btn"
            onClick={() => setActiveTab('reminders')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'reminders'
                ? isLightMode ? 'bg-zinc-950 text-white font-semibold shadow-md' : 'bg-white text-black font-semibold shadow'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#18181b] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>KoHot Communications</span>
          </button>

          <button
            id="tab-handoffs-btn"
            onClick={() => setActiveTab('handoffs')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'handoffs'
                ? isLightMode ? 'bg-zinc-950 text-white font-semibold shadow-md' : 'bg-white text-black font-semibold shadow'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#18181b] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Next-Class Handoffs</span>
          </button>

          <button
            id="tab-editor-btn"
            onClick={() => setActiveTab('editor')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'editor'
                ? isLightMode ? 'bg-zinc-950 text-white font-semibold shadow-md' : 'bg-white text-black font-semibold shadow'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#18181b] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-blue-600" />
            <span>KoHot Media</span>
          </button>

          <button
            id="tab-analytics-btn"
            onClick={() => setActiveTab('analytics')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'analytics'
                ? isLightMode ? 'bg-zinc-950 text-white font-semibold shadow-md' : 'bg-white text-black font-semibold'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#18181b] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Moments Image Cap</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono-tech font-bold ${
              isLightMode ? 'bg-zinc-100 text-black' : 'bg-white/10'
            }`}>
              {totalActiveImages}/{globalCap}
            </span>
          </button>

          <button
            id="tab-requests-btn"
            onClick={() => setActiveTab('requests')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'requests'
                ? isLightMode ? 'bg-zinc-950 text-white font-semibold shadow-md' : 'bg-white text-black font-semibold'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#18181b] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Addition Inquiries</span>
            {additionRequests.filter((r) => r.status === 'Pending').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            id="tab-testimonials-btn"
            onClick={() => setActiveTab('testimonials')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'testimonials'
                ? isLightMode ? 'bg-zinc-950 text-white font-semibold shadow-md' : 'bg-white text-black font-semibold shadow'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#18181b] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Testimonials</span>
          </button>

          <button
            id="tab-disputes-btn"
            onClick={() => setActiveTab('disputes')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'disputes'
                ? 'bg-amber-400 text-black font-semibold shadow'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#18181b] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-500" />
            <span>Album Admin Help</span>
          </button>
        </div>

        {/* =========================================================================
            0. ALBUM DEMOS SECTION (CROWNFIELD UNIVERSITY - DEPARTMENT OF PUBLIC LAW)
            4 Classes in Ascending Order: 2023 Trailblazers, 2024 Phoenix, 2025 Frontiers, 2026 Apex
            ========================================================================= */}
        {activeTab === 'album_demos' && (
          <div id="album-demos-module" className="space-y-8 animate-fadeIn">
            {/* Header Showcase Banner */}
            <div className={`p-6 sm:p-8 rounded-3xl border relative overflow-hidden shadow-2xl ${
              isLightMode 
                ? 'bg-gradient-to-br from-white via-slate-50 to-amber-50/30 border-slate-200 text-slate-900 shadow-md' 
                : 'bg-gradient-to-br from-[#18181b] via-[#202024] to-[#121214] border-white/15 text-white'
            }`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                <div className="space-y-2 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 text-[11px] font-mono-tech font-bold uppercase tracking-widest">
                      Platform Demos Showcase
                    </span>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono-tech font-semibold">
                      4 Classes • Ascending Order • 100% Populated
                    </span>
                  </div>
                  <h2 className="font-syne font-extrabold text-2xl sm:text-3xl tracking-tight">
                    Department of Public Law, Crownfield University
                  </h2>
                  <p className={`font-body text-xs sm:text-sm leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-zinc-400'}`}>
                    These 4 flagship albums serve as the official live demos showcased across website CTAs. Each cohort is 100% populated with 20 Nigerian graduates (balanced male/female mix, different faces, complete bios & quotes), 6 awards, rich photo memories, faculty thoughts, and valedictory documentary videos.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (onViewDepartmentLegacyWall) {
                        onViewDepartmentLegacyWall('dept-crownfield-public-law', 'crownfield');
                      } else {
                        onViewDepartmentAlbum('crownfield-law-2023');
                      }
                    }}
                    className="px-5 py-3 rounded-full bg-[#d4af37] hover:bg-amber-400 text-black font-syne font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95"
                  >
                    <Layers className="w-4 h-4" />
                    <span>View Crownfield Legacy Wall</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4 Demo Classes in Ascending Order (2023, 2024, 2025, 2026) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { year: 2023, defaultId: 'crownfield-law-2023', name: 'Trailblazers — Class of 2023', slogan: 'First to Dare, First to Lead', status: 'Founding Class (Legacy Anchor)' },
                { year: 2024, defaultId: 'crownfield-law-2024', name: 'Phoenix — Class of 2024', slogan: 'Rising with Tenacity, Reigning in Justice', status: 'Bar Advocacy Cohort' },
                { year: 2025, defaultId: 'crownfield-law-2025', name: 'Frontiers — Class of 2025', slogan: 'Breaking Boundaries, Shaping Horizons', status: 'Judicial Reform Pioneers' },
                { year: 2026, defaultId: 'crownfield-law-2026', name: 'Apex — Class of 2026', slogan: 'At the Pinnacle of Honor', status: 'Valedictory Graduating Set' },
              ].map((meta) => {
                const liveSet = sets.find((s) => s.id === meta.defaultId) || CROWNFIELD_PUBLIC_LAW_SETS.find((s) => s.id === meta.defaultId);
                if (!liveSet) return null;

                return (
                  <div 
                    key={liveSet.id}
                    id={`demo-card-${liveSet.id}`}
                    className={`rounded-3xl border overflow-hidden transition-all shadow-xl flex flex-col justify-between ${
                      isLightMode 
                        ? 'bg-white border-slate-200 text-slate-900 shadow-md hover:border-slate-300' 
                        : 'bg-[#18181b] border-white/10 text-white hover:border-white/25'
                    }`}
                  >
                    {/* Card Top: Banner preview with Year & Slogan */}
                    <div className="relative h-44 w-full bg-zinc-900 overflow-hidden">
                      <img 
                        src={liveSet.bannerImageUrl} 
                        alt={liveSet.classSetName}
                        className="w-full h-full object-cover object-center filter brightness-75 hover:scale-105 transition-transform duration-700" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                        <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[#d4af37] border border-[#d4af37]/40 text-xs font-mono-tech font-bold">
                          Class of {liveSet.graduationYear}
                        </span>
                        <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-mono-tech font-semibold">
                          {meta.status}
                        </span>
                      </div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="font-syne font-extrabold text-xl text-white tracking-tight drop-shadow-md">
                          {liveSet.classSetName}
                        </h3>
                        <p className="font-body text-xs text-white/80 italic mt-0.5 line-clamp-1">
                          “{liveSet.classSlogan}”
                        </p>
                      </div>
                    </div>

                    {/* Content Details & Stats */}
                    <div className="p-5 sm:p-6 space-y-5 flex-1 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div className={`p-2.5 rounded-xl border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'}`}>
                            <p className="font-mono-tech font-bold text-sm text-[#d4af37]">{liveSet.students?.length || 20}</p>
                            <p className="font-mono-tech text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">Students</p>
                          </div>
                          <div className={`p-2.5 rounded-xl border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'}`}>
                            <p className="font-mono-tech font-bold text-sm text-[#d4af37]">{liveSet.awards?.length || 6}</p>
                            <p className="font-mono-tech text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">Awards</p>
                          </div>
                          <div className={`p-2.5 rounded-xl border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'}`}>
                            <p className="font-mono-tech font-bold text-sm text-[#d4af37]">{liveSet.memories?.length || 4}</p>
                            <p className="font-mono-tech text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">Memories</p>
                          </div>
                          <div className={`p-2.5 rounded-xl border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'}`}>
                            <p className="font-mono-tech font-bold text-sm text-[#d4af37]">{liveSet.voices?.length || 4}</p>
                            <p className="font-mono-tech text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">Thoughts</p>
                          </div>
                        </div>

                        <div className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
                          isLightMode ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-zinc-300'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-400">Class Rep:</span>
                            <span className="font-mono-tech font-medium">{liveSet.classRepName}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-400">Convocation:</span>
                            <span className="font-mono-tech">{liveSet.convocationDate}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-400">Status:</span>
                            <span className="font-mono-tech text-emerald-400 font-bold">100% Populated & Live</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons: Edit Demo Album (Main), View Live Album, Legacy Wall */}
                      <div className="space-y-2 pt-2">
                        <button
                          type="button"
                          id={`edit-demo-${liveSet.id}-btn`}
                          onClick={() => {
                            if (onEditDemoAlbum) {
                              onEditDemoAlbum(liveSet.id);
                            }
                            setEditingDemoSetId(liveSet.id);
                          }}
                          className="w-full py-3 px-4 rounded-xl bg-[#d4af37] hover:bg-amber-400 text-black font-syne font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Edit Demo Album (Album Admin Dashboard)</span>
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => onViewDepartmentAlbum(liveSet.id)}
                            className={`py-2 px-3 rounded-xl border text-xs font-mono-tech uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                              isLightMode 
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300' 
                                : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
                            }`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>View Album</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (onViewDepartmentLegacyWall) {
                                onViewDepartmentLegacyWall('dept-crownfield-public-law', 'crownfield');
                              } else {
                                onViewDepartmentAlbum(liveSet.id);
                              }
                            }}
                            className={`py-2 px-3 rounded-xl border text-xs font-mono-tech uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                              isLightMode 
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300' 
                                : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
                            }`}
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Legacy Wall</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            1. INSTITUTIONAL DIRECTORIES DIRECTORY (3 LAYERS) - SHOWN FIRST
            Hierarchy: Layer 1 Universities -> Layer 2 Departments -> Layer 3 Sets
            ========================================================================= */}
        {activeTab === 'seeder' && (
          <div id="seeder-module" className="space-y-8">
            {/* 3-Layer Institutional Directory Manager */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#18181b] border border-white/15 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-5 h-5 text-[#d4af37]" />
                    <h3 className="font-syne font-bold text-lg text-white">
                      University Directory ({universities.length} Universities)
                    </h3>
                  </div>
                  <p className="font-body text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                    <span className="text-white font-semibold">University → Department → Class</span> structure. Governed exclusively by the Master Host.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    id="open-add-uni-btn"
                    onClick={() => setIsAddUniOpen(!isAddUniOpen)}
                    className="px-4 py-2 rounded-xl bg-[#d4af37] hover:bg-[#e6c158] text-black font-tech text-xs tracking-wider uppercase font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-black" />
                    <span>{isAddUniOpen ? 'Close Form' : '+ Add New University'}</span>
                  </button>

                  <span className="text-xs font-mono-tech text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full flex items-center gap-1.5 hidden md:inline-flex">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Master Host Exclusive</span>
                  </span>
                </div>
              </div>

              {seedingSuccessMsg && (
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-emerald-500/30 text-emerald-400 text-xs font-mono-tech flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{seedingSuccessMsg}</span>
                </div>
              )}

              {/* Upload / Add New University Form (Toggleable) */}
              {isAddUniOpen && (
                <div className="p-6 rounded-2xl bg-[#08090e] border border-[#d4af37]/30 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <h4 className="font-syne font-bold text-sm text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[#d4af37]" />
                      <span>Add New University to Directory</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsAddUniOpen(false)}
                      className="text-xs font-mono-tech text-zinc-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  <form onSubmit={handleAddNewUniversitySeed} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-body">
                    <div className="sm:col-span-2">
                      <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                        University Full Name *
                      </label>
                      <input
                        required
                        type="text"
                        value={newUniName}
                        onChange={(e) => setNewUniName(e.target.value)}
                        placeholder="e.g. Obafemi Awolowo University (OAU)"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e1017] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                        Short Code *
                      </label>
                      <input
                        required
                        type="text"
                        value={newUniShortCode}
                        onChange={(e) => setNewUniShortCode(e.target.value)}
                        placeholder="e.g. OAU"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e1017] border border-white/15 text-white placeholder:text-zinc-600 font-mono-tech uppercase focus:border-white/40 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                        Batch Order Number
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={newUniOrderNumber}
                        onChange={(e) => setNewUniOrderNumber(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e1017] border border-white/15 text-white font-mono-tech focus:border-white/40 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <ImageDropzone
                        value={newUniLogoUrl}
                        onChange={setNewUniLogoUrl}
                        label="Official Institutional Crest / Logo Image"
                        aspectRatio="1:1"
                        maxDimension={400}
                        required
                        helperText="Drag & drop or click to upload the official university crest"
                      />
                    </div>

                    <div>
                      <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                        Institutional Motto
                      </label>
                      <input
                        type="text"
                        value={newUniMotto}
                        onChange={(e) => setNewUniMotto(e.target.value)}
                        placeholder="e.g. For Learning and Culture"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e1017] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                        Campus Location
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Ile-Ife, Osun State"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e1017] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                        Official Website Portal
                      </label>
                      <input
                        type="url"
                        value={newUniWebsite}
                        onChange={(e) => setNewUniWebsite(e.target.value)}
                        placeholder="https://oauife.edu.ng"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e1017] border border-white/15 text-white placeholder:text-zinc-600 font-mono-tech focus:border-white/40 focus:outline-none text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                        Primary Faculty / College
                      </label>
                      <input
                        type="text"
                        value={newUniFaculty}
                        onChange={(e) => setNewUniFaculty(e.target.value)}
                        placeholder="e.g. Faculty of Technology"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e1017] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                        Initial Departments (Comma separated)
                      </label>
                      <input
                        type="text"
                        value={newUniDepartments}
                        onChange={(e) => setNewUniDepartments(e.target.value)}
                        placeholder="e.g. Computer Science, Electrical Engineering, Mechanical"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e1017] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-3 pt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddUniOpen(false)}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-[#d4af37] hover:bg-[#e6c158] text-black font-semibold font-mono-tech text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-md"
                      >
                        Upload &amp; Save University
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Numbered Universities 3-Layer Hierarchy */}
              <div className="space-y-6">
                {universities
                  .sort((a, b) => (a.orderNumber || 99) - (b.orderNumber || 99))
                  .map((uni, uniIdx) => {
                    const uniOrder = uni.orderNumber || (uniIdx + 1);
                    const formattedOrder = String(uniOrder).padStart(2, '0');
                    const departmentsList = uni.departments || [];

                    // Calculate total sets under this university
                    const uniSetsCount = sets.filter(
                      (s) => s.institutionId === uni.id ||
                             s.institutionName.toLowerCase().includes(uni.shortCode.toLowerCase()) ||
                             s.institutionName.toLowerCase().includes(uni.name.toLowerCase())
                    ).length;

                    return (
                      <div
                        key={uni.id}
                        id={`uni-compartment-${uni.id}`}
                        className="rounded-2xl bg-[#08090e] border border-white/15 overflow-hidden transition-all duration-300 shadow-xl"
                      >
                        {/* University Header Bar (Layer 1) */}
                        <div className="p-5 sm:p-6 bg-gradient-to-r from-white/[0.04] to-transparent border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            {/* University Number Badge */}
                            <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-white/10 border border-white/20 text-white shrink-0 font-mono-tech font-bold">
                              <span className="text-[10px] text-zinc-400">UNI</span>
                              <span className="text-base text-[#d4af37]">#{formattedOrder}</span>
                            </div>

                            {/* University Crest */}
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-black border border-white/15 shrink-0 flex items-center justify-center p-1">
                              <img
                                src={uni.logoUrl}
                                alt={uni.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain filter grayscale-[10%]"
                              />
                            </div>

                            {/* University Info */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <h4 className="font-syne font-bold text-base text-white tracking-tight">
                                  {uni.name}
                                </h4>
                                <span className="text-[10px] font-mono-tech text-black bg-white font-bold px-2 py-0.5 rounded-full">
                                  {uni.shortCode}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 font-serif-body italic mt-0.5">
                                "{uni.motto || 'In Deed and in Truth'}"
                              </p>
                              <div className="flex items-center gap-3 text-[11px] font-mono-tech text-zinc-400 mt-1.5 flex-wrap">
                                <span className="text-white font-semibold">{departmentsList.length} Departments</span>
                                <span>•</span>
                                <span className="text-[#d4af37]">{uniSetsCount} Class Albums</span>
                                <span>•</span>
                                <span>{uni.location || 'Accredited Campus'}</span>
                                {uni.officialWebsite && (
                                  <>
                                    <span>•</span>
                                    <a
                                      href={uni.officialWebsite}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-zinc-400 hover:text-white flex items-center gap-1 hover:underline"
                                    >
                                      <span>Portal</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* University Actions (Edit University & Add Department) */}
                          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                            <button
                              id={`edit-uni-btn-${uni.id}`}
                              onClick={() => setSelectedUniForEdit(uni)}
                              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs font-semibold border border-white/15 flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-zinc-300" />
                              <span>Edit University</span>
                            </button>

                            <button
                              id={`add-dept-btn-${uni.id}`}
                              onClick={() => {
                                if (addingDeptUniId === uni.id) {
                                  setAddingDeptUniId(null);
                                } else {
                                  setAddingDeptUniId(uni.id);
                                  setNewDeptFaculty(uni.faculties?.[0]?.facultyName || 'Faculty of Sciences');
                                  setNewDeptLogoUrl(uni.logoUrl);
                                }
                              }}
                              className="px-3.5 py-2 rounded-xl bg-[#d4af37] hover:bg-[#e6c158] text-black font-mono-tech text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                            >
                              <FolderPlus className="w-3.5 h-3.5 text-black" />
                              <span>{addingDeptUniId === uni.id ? 'Cancel' : '+ Add Department'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Inline Add Department Form */}
                        {addingDeptUniId === uni.id && (
                          <div className="p-5 sm:p-6 bg-white/[0.02] border-b border-white/10">
                            <div className="max-w-3xl space-y-4">
                              <div className="flex items-center gap-2">
                                <Plus className="w-4 h-4 text-[#d4af37]" />
                                <h5 className="font-syne font-bold text-sm text-white">
                                  Add Department to #{formattedOrder} {uni.name}
                                </h5>
                              </div>
                              <form onSubmit={(e) => handleAddNewDepartment(uni.id, e)} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div>
                                  <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                                    Department Name *
                                  </label>
                                  <input
                                    required
                                    type="text"
                                    value={newDeptName}
                                    onChange={(e) => setNewDeptName(e.target.value)}
                                    placeholder="e.g. Electrical &amp; Electronics Engineering"
                                    className="w-full px-3.5 py-2 rounded-lg bg-[#060709] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                                    Department Code
                                  </label>
                                  <input
                                    type="text"
                                    value={newDeptCode}
                                    onChange={(e) => setNewDeptCode(e.target.value)}
                                    placeholder="e.g. EEE"
                                    className="w-full px-3.5 py-2 rounded-lg bg-[#060709] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                                    Faculty / College
                                  </label>
                                  <input
                                    type="text"
                                    value={newDeptFaculty}
                                    onChange={(e) => setNewDeptFaculty(e.target.value)}
                                    placeholder="e.g. Faculty of Engineering"
                                    className="w-full px-3.5 py-2 rounded-lg bg-[#060709] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
                                  />
                                </div>

                                <div className="sm:col-span-2 space-y-4">
                                  <ImageDropzone
                                    value={newDeptHeroUrl}
                                    onChange={setNewDeptHeroUrl}
                                    label="Department Directory Hero Banner Image"
                                    aspectRatio="banner"
                                    maxDimension={1600}
                                    helperText="High-resolution hero cover banner displayed on the department's legacy wall directory"
                                  />

                                  <ImageDropzone
                                    value={newDeptLogoUrl}
                                    onChange={setNewDeptLogoUrl}
                                    label="Department Crest / Badge Logo"
                                    aspectRatio="1:1"
                                    maxDimension={400}
                                    helperText="Department seal or faculty emblem (defaults to university crest if omitted)"
                                  />
                                </div>

                                <div className="sm:col-span-2">
                                  <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                                    Department Hero Caption (Owner Curated)
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={newDeptCaption}
                                    onChange={(e) => setNewDeptCaption(e.target.value)}
                                    placeholder="A timeless celebration of academic distinction, collaborative breakthroughs, and enduring brotherhood..."
                                    className="w-full px-3.5 py-2 rounded-lg bg-[#060709] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none font-sans"
                                  />
                                </div>

                                <div>
                                  <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                                    Head of Department (HOD)
                                  </label>
                                  <input
                                    type="text"
                                    value={newDeptHod}
                                    onChange={(e) => setNewDeptHod(e.target.value)}
                                    placeholder="e.g. Prof. S. A. Adeleke"
                                    className="w-full px-3.5 py-2 rounded-lg bg-[#060709] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                                    Department Portal Link
                                  </label>
                                  <input
                                    type="url"
                                    value={newDeptPortal}
                                    onChange={(e) => setNewDeptPortal(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full px-3.5 py-2 rounded-lg bg-[#060709] border border-white/15 text-white placeholder:text-zinc-600 font-mono-tech focus:border-white/40 focus:outline-none"
                                  />
                                </div>

                                <div className="sm:col-span-2 pt-2 flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setAddingDeptUniId(null)}
                                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    className="px-5 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e6c158] text-black font-semibold font-mono-tech text-xs uppercase tracking-wider transition-colors cursor-pointer"
                                  >
                                    Save Department
                                  </button>
                                </div>
                              </form>
                            </div>
                          </div>
                        )}

                        {/* Departments Swipeable Horizontal List (Layer 2 & Layer 3) */}
                        <div className="p-5 sm:p-6 pt-4">
                          {departmentsList.length === 0 ? (
                            <div className="py-6 text-center text-zinc-500 font-mono-tech text-xs">
                              No departments registered yet. Click "+ Add Department" above to configure.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* Horizontal Swipe Indicator & Scroll Controls */}
                              <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-mono-tech uppercase tracking-wider text-zinc-300 font-bold">
                                    Departments ({departmentsList.length})
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono-tech text-[#d4af37] bg-[#d4af37]/10 px-2.5 py-0.5 rounded-full border border-[#d4af37]/20">
                                    <span>⇄ Swipe horizontally</span>
                                  </span>
                                </div>
                                {departmentsList.length > 1 && (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const el = document.getElementById(`dept-scroll-${uni.id}`);
                                        if (el) el.scrollBy({ left: -360, behavior: 'smooth' });
                                      }}
                                      className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
                                      title="Scroll left"
                                      aria-label="Scroll left"
                                    >
                                      ‹
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const el = document.getElementById(`dept-scroll-${uni.id}`);
                                        if (el) el.scrollBy({ left: 360, behavior: 'smooth' });
                                      }}
                                      className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
                                      title="Scroll right"
                                      aria-label="Scroll right"
                                    >
                                      ›
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Swipable Horizontal Flex Track */}
                              <div
                                id={`dept-scroll-${uni.id}`}
                                className="flex gap-5 overflow-x-auto pb-4 pt-1 px-1 scroll-smooth snap-x snap-mandatory focus:outline-none"
                                style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
                              >
                                {departmentsList.map((dept) => {
                                  // Find all yearly sets belonging strictly to this department
                                  const deptSets = sets.filter((s) => {
                                    if (s.departmentId && s.departmentId === dept.id) return true;
                                    const matchesName = s.departmentName.toLowerCase().trim() === dept.name.toLowerCase().trim();
                                    const matchesUni = s.institutionId === uni.id ||
                                                       s.institutionName.toLowerCase().includes(uni.shortCode.toLowerCase()) ||
                                                       s.institutionName.toLowerCase().includes(uni.name.toLowerCase());
                                    return matchesName && matchesUni;
                                  });

                                  return (
                                    <div
                                      key={dept.id}
                                      id={`department-compartment-${dept.id}`}
                                      className="w-[340px] sm:w-[420px] lg:w-[460px] shrink-0 snap-start p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/25 transition-all flex flex-col justify-between space-y-4 shadow-lg hover:shadow-xl"
                                    >
                                    {/* Department Top Row (Layer 2 Header) */}
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex items-start gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/60 border border-white/15 shrink-0 flex items-center justify-center p-1">
                                          <img
                                            src={dept.logoUrl || uni.logoUrl}
                                            alt={dept.name}
                                            referrerPolicy="no-referrer"
                                            className="w-full h-full object-contain filter grayscale-[10%]"
                                          />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <h5 className="font-syne font-bold text-sm text-white">
                                              {dept.name}
                                            </h5>
                                            {dept.code && (
                                              <span className="text-[9px] font-mono-tech uppercase bg-white/10 text-white px-1.5 py-0.5 rounded">
                                                {dept.code}
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[11px] font-mono-tech text-zinc-400">
                                            {dept.faculty} {dept.hodName && `• HOD: ${dept.hodName}`}
                                          </p>
                                          {/* Department Legacy Status Indicator */}
                                          <div className="pt-0.5">
                                            {dept.legacy_status === 'established' ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono-tech font-semibold">
                                                <Award className="w-2.5 h-2.5" />
                                                <span>Legacy Established {dept.founding_class_year ? `('Class of ${dept.founding_class_year})` : ''}</span>
                                              </span>
                                            ) : dept.legacy_status === 'pending_verification' ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[9px] font-mono-tech font-semibold">
                                                <Clock className="w-2.5 h-2.5" />
                                                <span>Founding Application Under Review</span>
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 text-[9px] font-mono-tech">
                                                <Sparkles className="w-2.5 h-2.5" />
                                                <span>Founding Class Available (Sponsored $0)</span>
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <span className="text-[10px] font-mono-tech bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 px-2 py-0.5 rounded-full shrink-0">
                                        {deptSets.length} {deptSets.length === 1 ? 'Cohort' : 'Cohorts'}
                                      </span>
                                    </div>

                                    {/* Hero Artwork Preview & Caption */}
                                    <div className="relative rounded-xl overflow-hidden bg-black/50 border border-white/10 aspect-[21/9] group">
                                      <img
                                        src={dept.heroImageUrl}
                                        alt={dept.name}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover filter brightness-75 group-hover:scale-105 transition-transform duration-500"
                                      />
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-3">
                                        <span className="text-[9px] font-mono-tech text-[#d4af37] uppercase tracking-wider flex items-center gap-1">
                                          <ImageIcon className="w-3 h-3" />
                                          <span>Department Hero Image &amp; Caption</span>
                                        </span>
                                        <p className="text-[11px] text-zinc-200 font-serif italic line-clamp-2 mt-0.5">
                                          "{dept.caption}"
                                        </p>
                                      </div>
                                    </div>

                                    {/* Department Actions: Edit Details, Legacy Plaque & View Legacy Wall */}
                                    <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                          id={`edit-dept-btn-${dept.id}`}
                                          onClick={() => setSelectedDeptForEdit({ dept, uni })}
                                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono-tech text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10"
                                        >
                                          <Edit3 className="w-3 h-3 text-zinc-300" />
                                          <span>Edit Details &amp; Hero</span>
                                        </button>

                                        {onViewDepartmentLegacyWall && (
                                          <button
                                            onClick={() => onViewDepartmentLegacyWall(dept.id, uni.id)}
                                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono-tech text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10"
                                            title="View Public Department Legacy Wall"
                                          >
                                            <BookOpen className="w-3 h-3 text-[#d4af37]" />
                                            <span>View Legacy Wall</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* =========================================================================
                                        LAYER 3: YEARLY CLASS SET ALBUMS UNDER THIS DEPARTMENT
                                        "Only I can view the 3 layers institutional directory directory...
                                        They can only see the different years albums of their department called legacy wall"
                                        ========================================================================= */}
                                    <div className="pt-3 border-t border-white/10 space-y-2">
                                      <div className="flex items-center justify-between text-[11px] font-mono-tech">
                                        <span className="text-zinc-400 flex items-center gap-1.5">
                                          <GraduationCap className="w-3.5 h-3.5 text-[#d4af37]" />
                                          <span className="text-white font-bold">Class Albums:</span> ({deptSets.length})
                                        </span>
                                        {deptSets.length > 0 && (
                                          <span className="text-zinc-400 text-[10px]">
                                            {deptSets.reduce((a, b) => a + (b.students?.length || 0), 0)} Profiles
                                          </span>
                                        )}
                                      </div>

                                      {deptSets.length === 0 ? (
                                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-[11px] text-zinc-500 font-mono-tech">
                                          No class albums registered yet for {dept.name}.
                                        </div>
                                      ) : (
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                          {deptSets
                                            .sort((a, b) => b.graduationYear - a.graduationYear)
                                            .map((s) => (
                                              <div
                                                key={s.id}
                                                id={`admin-set-row-${s.id}`}
                                                className="p-2.5 rounded-xl bg-black/60 border border-white/10 hover:border-white/20 flex items-center justify-between gap-2 text-xs"
                                              >
                                                <div className="flex items-center gap-2 min-w-0">
                                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono-tech font-bold ${
                                                    s.graduationYear === 2026 ? 'bg-[#d4af37] text-black' : 'bg-white/10 text-white'
                                                  }`}>
                                                    Class of {s.graduationYear}
                                                  </span>
                                                  <span className="font-syne font-semibold text-white truncate text-xs">
                                                    {s.classSetName}
                                                  </span>
                                                  <span className="text-[10px] font-mono-tech text-zinc-400 hidden sm:inline">
                                                    ({s.students?.length || 0} Profiles)
                                                  </span>
                                                </div>

                                                <button
                                                  onClick={() => onViewDepartmentAlbum(s.id)}
                                                  className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white font-mono-tech text-[10px] shrink-0 transition-colors cursor-pointer flex items-center gap-1"
                                                >
                                                  <span>View Album</span>
                                                  <ExternalLink className="w-2.5 h-2.5" />
                                                </button>
                                              </div>
                                            ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* =========================================================================
                AUTOMATED DATABASE SEEDER TOOL (BOLD SYSTEM CONTROL)
                ========================================================================= */}
            <div className="p-7 sm:p-9 rounded-3xl bg-gradient-to-br from-[#18181b] via-[#202024] to-[#121214] border-2 border-white/20 hover:border-[#d4af37]/40 shadow-2xl space-y-6 transition-all">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-3 py-1 rounded-full text-[10px] font-mono-tech uppercase tracking-widest font-bold bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 flex items-center gap-1.5">
                      <Shield className="w-3 h-3 text-[#d4af37]" />
                      Master System Control
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech text-white/60 bg-white/5 border border-white/10">
                      Tier 0 Core Engine
                    </span>
                  </div>
                  <h3 className="font-syne font-black text-2xl sm:text-3xl text-white tracking-tight flex items-center gap-3">
                    <Database className="w-7 h-7 text-[#d4af37] shrink-0" />
                    Automated Database Seeder &amp; Reset Tool
                  </h3>
                  <p className="font-body text-xs sm:text-sm text-zinc-300 max-w-2xl leading-relaxed">
                    Restores default accredited institutional directories, official university crests, and department seeds into memory and storage.
                  </p>
                </div>

                <button
                  id="execute-reseed-btn"
                  onClick={handleExecuteDefaultSeed}
                  className="shrink-0 bg-white hover:bg-[#d4af37] text-black font-tech text-xs tracking-widest uppercase font-extrabold py-4 px-8 rounded-2xl flex items-center gap-2.5 transition-all shadow-2xl hover:scale-105 active:scale-95 cursor-pointer border border-white/20 self-start lg:self-center"
                >
                  <RefreshCw className="w-4 h-4 text-black" />
                  <span>Execute Preloaded Seed</span>
                </button>
              </div>

              {/* Bolder summary metrics strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-3.5">
                  <Building2 className="w-5 h-5 text-[#d4af37] shrink-0" />
                  <div>
                    <div className="text-[10px] font-mono-tech uppercase text-zinc-400 font-medium">Preloaded Institutions</div>
                    <div className="font-syne font-bold text-sm sm:text-base text-white">{universities.length} Universities Active</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-3.5">
                  <GraduationCap className="w-5 h-5 text-[#d4af37] shrink-0" />
                  <div>
                    <div className="text-[10px] font-mono-tech uppercase text-zinc-400 font-medium">Archival Class Sets</div>
                    <div className="font-syne font-bold text-sm sm:text-base text-white">{sets.length} Class Sets Active</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-3.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-[10px] font-mono-tech uppercase text-zinc-400 font-medium">Storage Architecture</div>
                    <div className="font-syne font-bold text-sm sm:text-base text-white">100% Verified Local &amp; Cloud Sync</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            2. EDIT MODULE: KOHOT MEDIA & ASSET CONTROL STUDIO
            ========================================================================= */}
        {activeTab === 'editor' && (
          <div id="editor-module" className="p-7 sm:p-9 rounded-3xl bg-gradient-to-br from-[#18181b] via-[#202024] to-[#121214] border-2 border-white/20 shadow-2xl space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    CENTRAL ASSET REPOSITORY
                  </span>
                </div>
                <h2 className="font-syne font-bold text-2xl text-white flex items-center gap-2.5">
                  <Film className="w-6 h-6 text-blue-400" />
                  <span>KoHot Media &amp; Visuals</span>
                </h2>
                <p className="font-body text-xs text-zinc-400 mt-1 max-w-2xl">
                  Centralized management of Class Album ambient audio, homepage tour reels, brand logo, and global platform assets.
                </p>
              </div>

              {editorSavedMsg && (
                <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono-tech flex items-center gap-2 animate-fadeIn shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Settings Published</span>
                </span>
              )}
            </div>

            {/* Sub-tab Switch: Website Media vs Album Media vs Album Visuals */}
            <div className="flex items-center gap-2.5 p-1.5 rounded-2xl bg-black/50 border border-white/10 w-fit flex-wrap">
              <button
                type="button"
                onClick={() => setMediaSubTab('website')}
                className={`px-4 py-2 rounded-xl text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                  mediaSubTab === 'website'
                    ? 'bg-white text-black font-semibold shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5 text-blue-400" />
                <span>Website Media</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaSubTab('albums')}
                className={`px-4 py-2 rounded-xl text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                  mediaSubTab === 'albums'
                    ? 'bg-white text-black font-semibold shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Album Media</span>
                <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] font-mono-tech">
                  {sets.length} Sets
                </span>
              </button>
            </div>

            {mediaSubTab === 'albums' ? (
              <MasterAlbumMediaSection
                sets={sets}
                onViewDepartmentAlbum={onViewDepartmentAlbum}
                compressionResolution={editCompressionResolution}
                onUpdateCompressionResolution={setEditCompressionResolution}
                compressionQuality={editCompressionQuality}
                onUpdateCompressionQuality={setEditCompressionQuality}
                onSavePipeline={() => {
                  onUpdateContentOverride({
                    ...contentOverride,
                    defaultCompressionResolution: Number(editCompressionResolution),
                    compressionQualityPercentage: Number(editCompressionQuality),
                  });
                  setEditorSavedMsg(true);
                  setTimeout(() => setEditorSavedMsg(false), 3000);
                }}
              />
            ) : (
              <form onSubmit={handleSaveContentOverride} className="space-y-8 text-xs font-body">
                {/* 00. BRAND IDENTITY & LOGO (NO BACKGROUND, NO BORDER, ONLY THE LOGO) */}
                <div className="p-6 rounded-2xl bg-[#08090e] border border-white/10 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div>
                      <h3 className="font-syne font-bold text-sm text-white">
                        00. Platform Brand Identity &amp; Header Logo
                      </h3>
                      <p className="text-zinc-400 text-xs font-body mt-0.5">
                        Customize platform name and logo. The logo renders with no background or border at all — only the clean icon/graphic.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                        Brand Name
                      </label>
                      <input
                        type="text"
                        value={editBrandName}
                        onChange={(e) => setEditBrandName(e.target.value)}
                        placeholder="KOHOT"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-syne font-bold text-sm focus:outline-none focus:border-amber-400/50"
                      />
                    </div>

                    <div>
                      <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                        Logo Image URL (Transparent PNG / SVG)
                      </label>
                      <input
                        type="url"
                        value={editWebsiteLogoUrl}
                        onChange={(e) => setEditWebsiteLogoUrl(e.target.value)}
                        placeholder="https://... or upload below"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400/50"
                      />
                    </div>
                  </div>

                  {/* Logo Live Preview: Absolutely NO background, NO border */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono-tech text-[10px] text-zinc-400 uppercase">
                        Current Header Logo (Pure Graphic - No Border / No Background):
                      </span>
                      <div className="p-1 flex items-center">
                        <BrandLogo
                          logoUrl={editWebsiteLogoUrl}
                          brandName={editBrandName}
                          textSize="text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5 text-amber-400" />
                        <span>Upload Logo File</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                if (ev.target?.result) setEditWebsiteLogoUrl(ev.target.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>

                      {editWebsiteLogoUrl && (
                        <button
                          type="button"
                          onClick={() => setEditWebsiteLogoUrl('')}
                          className="text-rose-400 hover:text-rose-300 text-xs font-mono-tech"
                        >
                          Reset to Diamond Icon
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              
              {/* =========================================================================
                  AREA 1: HERO SECTION
                  ========================================================================= */}
              <div className="p-6 rounded-2xl bg-[#08090e] border border-amber-400/25 space-y-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-2">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <div>
                      <h3 className="font-syne font-bold text-sm text-white">
                        01. Website Hero Section
                      </h3>
                      <p className="text-zinc-400 text-xs font-body mt-0.5">
                        Customize the main headline, narrative subtext, call-to-actions, and cinematic video.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 text-[10px] font-mono-tech uppercase self-start sm:self-auto">
                    Homepage Fold #1
                  </span>
                </div>

                {/* 3-line Headline Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Headline Line 1
                    </label>
                    <input
                      type="text"
                      value={editHeroHeadlineLine1}
                      onChange={(e) => setEditHeroHeadlineLine1(e.target.value)}
                      placeholder="Beautiful"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Headline Line 2 (Italicized)
                    </label>
                    <input
                      type="text"
                      value={editHeroHeadlineLine2}
                      onChange={(e) => setEditHeroHeadlineLine2(e.target.value)}
                      placeholder="graduate memories"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400/50 italic"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Headline Line 3
                    </label>
                    <input
                      type="text"
                      value={editHeroHeadlineLine3}
                      onChange={(e) => setEditHeroHeadlineLine3(e.target.value)}
                      placeholder="live here"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                </div>

                {/* Supporting Statement / Subtitle */}
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Supporting Narrative Statement / Subtitle
                  </label>
                  <textarea
                    rows={2}
                    value={editHeroSubtitle}
                    onChange={(e) => setEditHeroSubtitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-body text-xs focus:outline-none focus:border-amber-400/50 resize-y"
                  />
                </div>

                {/* Button CTAs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Primary CTA Button Text
                    </label>
                    <input
                      type="text"
                      value={editHeroCtaButtonText}
                      onChange={(e) => setEditHeroCtaButtonText(e.target.value)}
                      placeholder="Create Class Album"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Secondary CTA Button Text
                    </label>
                    <input
                      type="text"
                      value={editHeroExploreButtonText}
                      onChange={(e) => setEditHeroExploreButtonText(e.target.value)}
                      placeholder="Explore Demo Albums"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                </div>

                {/* Hero Cinematic Video & Caption */}
                <div className="pt-3 border-t border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-semibold">
                      Hero Cinematic Video Asset &amp; Lower Caption
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="md:col-span-1 w-full aspect-video rounded-xl bg-black/80 border border-white/10 overflow-hidden relative flex items-center justify-center">
                      {editHeroVideoUrl ? (
                        <video
                          src={editHeroVideoUrl}
                          controls
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-3 text-zinc-500">
                          <Film className="w-6 h-6 mx-auto mb-1 text-zinc-600" />
                          <span className="text-[10px] font-mono-tech">Crossfade Photos Active</span>
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2 space-y-3">
                      <div>
                        <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                          Video URL (MP4 / WebM direct stream)
                        </label>
                        <input
                          type="url"
                          placeholder="https://commondatastorage.googleapis.com/..."
                          value={editHeroVideoUrl}
                          onChange={(e) => setEditHeroVideoUrl(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-lg bg-black/50 border border-white/15 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400/50"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload File</span>
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleVideoTourUpload(file, 'hero');
                            }}
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => setEditHeroVideoUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4')}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 font-mono-tech text-xs transition-colors"
                        >
                          Load Demo Sample
                        </button>

                        {editHeroVideoUrl && (
                          <button
                            type="button"
                            onClick={() => setEditHeroVideoUrl('')}
                            className="text-rose-400 hover:text-rose-300 text-xs font-mono-tech ml-auto"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                            Video Overlay Caption Title
                          </label>
                          <input
                            type="text"
                            value={editHeroVideoCaptionTitle}
                            onChange={(e) => setEditHeroVideoCaptionTitle(e.target.value)}
                            placeholder="The Physical to Digital Gateway"
                            className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white font-mono-tech text-xs focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                            Video Overlay Caption Subtext
                          </label>
                          <input
                            type="text"
                            value={editHeroVideoCaptionSubtext}
                            onChange={(e) => setEditHeroVideoCaptionSubtext(e.target.value)}
                            placeholder="Scan the corridor plaque • Open your preserved class album"
                            className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white font-mono-tech text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* =========================================================================
                  AREA 2: CORE PILLARS SECTION (THE THREE PILLARS)
                  ========================================================================= */}
              <div className="p-6 rounded-2xl bg-[#08090e] border border-white/10 space-y-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-2">
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-5 h-5 text-sky-400" />
                    <div>
                      <h3 className="font-syne font-bold text-sm text-white">
                        02. Core Pillars Section
                      </h3>
                      <p className="text-zinc-400 text-xs font-body mt-0.5">
                        Edit copy and tour video URLs for the 3 cornerstone features of the KoHot platform.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[10px] font-mono-tech uppercase self-start sm:self-auto">
                    Homepage Fold #2
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Section Eyebrow
                    </label>
                    <input
                      type="text"
                      value={editPillarsEyebrow}
                      onChange={(e) => setEditPillarsEyebrow(e.target.value)}
                      placeholder="THE THREE PILLARS"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Section Heading
                    </label>
                    <input
                      type="text"
                      value={editPillarsHeading}
                      onChange={(e) => setEditPillarsHeading(e.target.value)}
                      placeholder="Everything your class needs to leave a legacy"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-syne font-bold text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* 3 Pillar Cards Content with Video Upload, Preview, and Default State */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {/* Pillar 1 */}
                  <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-tech text-[10px] text-amber-300 uppercase font-semibold">Pillar 1: Class Album</span>
                        {editClassAlbumTourUrl ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono-tech font-bold">
                            Video Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10 text-[9px] font-mono-tech">
                            Default Transition
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Title</label>
                        <input
                          type="text"
                          value={editPillar1Title}
                          onChange={(e) => setEditPillar1Title(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-syne font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Description</label>
                        <textarea
                          rows={3}
                          value={editPillar1Description}
                          onChange={(e) => setEditPillar1Description(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-body resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Tour Video URL or Upload</label>
                        <input
                          type="url"
                          placeholder="https://... or upload video below"
                          value={editClassAlbumTourUrl}
                          onChange={(e) => setEditClassAlbumTourUrl(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-mono-tech"
                        />
                      </div>
                      {editClassAlbumTourUrl && (
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-black/80 border border-white/10">
                          <video src={editClassAlbumTourUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                      <label className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 font-mono-tech text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors">
                        <Upload className="w-3 h-3" />
                        <span>Upload Video File</span>
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleVideoTourUpload(file, 'album');
                          }}
                        />
                      </label>
                      {editClassAlbumTourUrl ? (
                        <button
                          type="button"
                          onClick={() => setEditClassAlbumTourUrl('')}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] font-mono-tech cursor-pointer ml-auto"
                        >
                          Set to Default
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono-tech text-zinc-500 ml-auto">
                          Default Transition
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pillar 2 */}
                  <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-tech text-[10px] text-amber-300 uppercase font-semibold">Pillar 2: Legacy Plaque</span>
                        {editLegacyPlaqueTourUrl ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono-tech font-bold">
                            Video Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10 text-[9px] font-mono-tech">
                            Default Transition
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Title</label>
                        <input
                          type="text"
                          value={editPillar2Title}
                          onChange={(e) => setEditPillar2Title(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-syne font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Description</label>
                        <textarea
                          rows={3}
                          value={editPillar2Description}
                          onChange={(e) => setEditPillar2Description(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-body resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Tour Video URL or Upload</label>
                        <input
                          type="url"
                          placeholder="https://... or upload video below"
                          value={editLegacyPlaqueTourUrl}
                          onChange={(e) => setEditLegacyPlaqueTourUrl(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-mono-tech"
                        />
                      </div>
                      {editLegacyPlaqueTourUrl && (
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-black/80 border border-white/10">
                          <video src={editLegacyPlaqueTourUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                      <label className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 font-mono-tech text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors">
                        <Upload className="w-3 h-3" />
                        <span>Upload Video File</span>
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleVideoTourUpload(file, 'plaque');
                          }}
                        />
                      </label>
                      {editLegacyPlaqueTourUrl ? (
                        <button
                          type="button"
                          onClick={() => setEditLegacyPlaqueTourUrl('')}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] font-mono-tech cursor-pointer ml-auto"
                        >
                          Set to Default
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono-tech text-zinc-500 ml-auto">
                          Default Transition
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pillar 3 */}
                  <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-tech text-[10px] text-amber-300 uppercase font-semibold">Pillar 3: Annual Reminder</span>
                        {editAnnualReminderTourUrl ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono-tech font-bold">
                            Video Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10 text-[9px] font-mono-tech">
                            Default Transition
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Title</label>
                        <input
                          type="text"
                          value={editPillar3Title}
                          onChange={(e) => setEditPillar3Title(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-syne font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Description</label>
                        <textarea
                          rows={3}
                          value={editPillar3Description}
                          onChange={(e) => setEditPillar3Description(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-body resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Tour Video URL or Upload</label>
                        <input
                          type="url"
                          placeholder="https://... or upload video below"
                          value={editAnnualReminderTourUrl}
                          onChange={(e) => setEditAnnualReminderTourUrl(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-mono-tech"
                        />
                      </div>
                      {editAnnualReminderTourUrl && (
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-black/80 border border-white/10">
                          <video src={editAnnualReminderTourUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                      <label className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 font-mono-tech text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors">
                        <Upload className="w-3 h-3" />
                        <span>Upload Video File</span>
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleVideoTourUpload(file, 'reminder');
                          }}
                        />
                      </label>
                      {editAnnualReminderTourUrl ? (
                        <button
                          type="button"
                          onClick={() => setEditAnnualReminderTourUrl('')}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] font-mono-tech cursor-pointer ml-auto"
                        >
                          Set to Default
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono-tech text-zinc-500 ml-auto">
                          Default Transition
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* =========================================================================
                  AREA 3: HOW IT WORKS & DEPARTMENT LEGACY SECTION
                  ========================================================================= */}
              <div className="p-6 rounded-2xl bg-[#08090e] border border-white/10 space-y-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-2">
                  <div className="flex items-center gap-2.5">
                    <Users className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="font-syne font-bold text-sm text-white">
                        03. How It Works &amp; Department Legacy Section
                      </h3>
                      <p className="text-zinc-400 text-xs font-body mt-0.5">
                        Manage section headers, department continuum messaging, and the privacy guarantee statement.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono-tech uppercase self-start sm:self-auto">
                    Homepage Fold #3
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Journey Section Eyebrow
                    </label>
                    <input
                      type="text"
                      value={editHowItWorksEyebrow}
                      onChange={(e) => setEditHowItWorksEyebrow(e.target.value)}
                      placeholder="THE JOURNEY"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Journey Section Heading
                    </label>
                    <input
                      type="text"
                      value={editHowItWorksHeading}
                      onChange={(e) => setEditHowItWorksHeading(e.target.value)}
                      placeholder="How Your Class Leaves a Lasting Legacy"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-syne font-bold text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Department Legacy Showcase */}
                  <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-2.5">
                    <span className="font-mono-tech text-[10px] text-zinc-300 uppercase font-semibold">
                      Department Continuum &amp; Corridor Plaque
                    </span>
                    <input
                      type="text"
                      value={editDepartmentLegacyTitle}
                      onChange={(e) => setEditDepartmentLegacyTitle(e.target.value)}
                      placeholder="ONE DEPARTMENT. MANY GENERATIONS."
                      className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-syne font-bold"
                    />
                    <textarea
                      rows={2}
                      value={editDepartmentLegacyDescription}
                      onChange={(e) => setEditDepartmentLegacyDescription(e.target.value)}
                      placeholder="Department continuum narrative..."
                      className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-body resize-y"
                    />
                  </div>

                  {/* Privacy Guarantee */}
                  <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-2.5">
                    <span className="font-mono-tech text-[10px] text-zinc-300 uppercase font-semibold">
                      Reassuring Privacy Guarantee
                    </span>
                    <input
                      type="text"
                      value={editPrivacyGuaranteeTitle}
                      onChange={(e) => setEditPrivacyGuaranteeTitle(e.target.value)}
                      placeholder="Reassuring, Private & Student-Controlled"
                      className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-syne font-bold"
                    />
                    <textarea
                      rows={2}
                      value={editPrivacyGuaranteeDescription}
                      onChange={(e) => setEditPrivacyGuaranteeDescription(e.target.value)}
                      placeholder="Privacy statement..."
                      className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-body resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* =========================================================================
                  AREA 4: TESTIMONIALS SECTION ("IN THEIR WORDS")
                  ========================================================================= */}
              <div className="p-6 rounded-2xl bg-[#08090e] border border-white/10 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-2">
                  <div className="flex items-center gap-2.5">
                    <Camera className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h3 className="font-syne font-bold text-sm text-white">
                        04. Testimonials Section ("In Their Words")
                      </h3>
                      <p className="text-zinc-400 text-xs font-body mt-0.5">
                        Headline and intro text for the alumni and class representative testimonials reel.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      id="editor-toggle-testimonials-btn"
                      onClick={() => {
                        const currentVal = contentOverride.showTestimonialsSection !== false;
                        onUpdateContentOverride({
                          ...contentOverride,
                          showTestimonialsSection: !currentVal,
                        });
                      }}
                      className={`px-3 py-1.5 rounded-xl font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5 ${
                        contentOverride.showTestimonialsSection !== false
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {contentOverride.showTestimonialsSection !== false ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Turn OFF on Website</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Turn ON on Website</span>
                        </>
                      )}
                    </button>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-mono-tech uppercase self-start sm:self-auto">
                      Homepage Fold #4
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Eyebrow
                    </label>
                    <input
                      type="text"
                      value={editTestimonialsEyebrow}
                      onChange={(e) => setEditTestimonialsEyebrow(e.target.value)}
                      placeholder="THE LEGACY, IN THEIR WORDS"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Heading
                    </label>
                    <input
                      type="text"
                      value={editTestimonialsHeading}
                      onChange={(e) => setEditTestimonialsHeading(e.target.value)}
                      placeholder="What Graduating Classes Say"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-syne font-bold text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Subtitle Statement
                    </label>
                    <input
                      type="text"
                      value={editTestimonialsSubtitle}
                      onChange={(e) => setEditTestimonialsSubtitle(e.target.value)}
                      placeholder="Real experiences from class representatives..."
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-body text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* =========================================================================
                  AREA 5: CLASS ALBUM LEGACY PRESERVATION BANNER (4 CROSSFADING PHOTOS)
                  ========================================================================= */}
              <div className="p-6 rounded-2xl bg-[#08090e] border border-white/10 space-y-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-2">
                  <div className="flex items-center gap-2.5">
                    <ImageIcon className="w-5 h-5 text-[#d4af37]" />
                    <div>
                      <h3 className="font-syne font-bold text-sm text-white">
                        05. Class Album Legacy Banner Images (Fade In / Fade Out)
                      </h3>
                      <p className="text-zinc-400 text-xs font-body mt-0.5">
                        These 4 rotating images appear before the album footer with the caption: <em>"Your Legacy preserved forever"</em>.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditLegacyBannerImages(DEFAULT_LEGACY_BANNER_IMAGES)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-mono-tech text-xs self-start sm:self-auto cursor-pointer transition-colors"
                  >
                    Reset 4 Photos
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const currentImgUrl = editLegacyBannerImages[slotIdx] || DEFAULT_LEGACY_BANNER_IMAGES[slotIdx];
                    return (
                      <div 
                        key={slotIdx}
                        className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono-tech text-[10px] uppercase font-bold text-[#d4af37]">
                              Banner Photo #{slotIdx + 1}
                            </span>
                            <span className="text-[10px] font-mono-tech text-zinc-500">
                              Frame {slotIdx + 1}/4
                            </span>
                          </div>

                          <div className="w-full aspect-[16/10] rounded-lg overflow-hidden bg-black/80 border border-white/10 relative">
                            {currentImgUrl ? (
                              <img
                                src={currentImgUrl}
                                alt={`Banner ${slotIdx + 1}`}
                                className="w-full h-full object-cover filter contrast-[1.05]"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                <ImageIcon className="w-6 h-6" />
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono-tech uppercase text-zinc-400 mb-1">
                              Image URL
                            </label>
                            <input
                              type="url"
                              value={editLegacyBannerImages[slotIdx] || ''}
                              onChange={(e) => {
                                const nextImgs = [...editLegacyBannerImages];
                                nextImgs[slotIdx] = e.target.value;
                                setEditLegacyBannerImages(nextImgs);
                              }}
                              placeholder="https://images.unsplash.com/..."
                              className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white font-mono-tech text-[11px] focus:outline-none focus:border-[#d4af37]"
                            />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                          <label className="px-2.5 py-1 rounded-lg bg-[#d4af37]/20 hover:bg-[#d4af37]/30 text-[#d4af37] border border-[#d4af37]/30 font-mono-tech text-[10px] flex items-center gap-1.5 cursor-pointer transition-colors">
                            <Upload className="w-3 h-3" />
                            <span>Upload</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => {
                                    if (ev.target?.result) {
                                      const nextImgs = [...editLegacyBannerImages];
                                      nextImgs[slotIdx] = ev.target.result as string;
                                      setEditLegacyBannerImages(nextImgs);
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* =========================================================================
                  AREA 6: AMBIENT AUDIO & PLATFORM GLOBAL SETTINGS
                  ========================================================================= */}
              <div className="p-6 rounded-2xl bg-[#08090e] border border-white/10 space-y-4 shadow-xl">
                <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                  <Music className="w-5 h-5 text-[#d4af37]" />
                  <h3 className="font-syne font-bold text-sm text-white">
                    06. Ambient Soundtrack &amp; Platform Defaults
                  </h3>
                </div>

                {/* Audio Track */}
                <div className="p-4 rounded-xl bg-black/60 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {editAlbumBgMusicUrl ? (
                    <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/30 flex items-center justify-center shrink-0">
                          <Volume2 className="w-5 h-5 text-[#d4af37]" />
                        </div>
                        <div>
                          <p className="font-syne font-semibold text-white text-xs truncate">
                            Active Background Track
                          </p>
                          <p className="text-[10px] font-mono-tech text-emerald-400">
                            Loaded &amp; Ready for Playback
                          </p>
                        </div>
                      </div>

                      <audio
                        src={editAlbumBgMusicUrl}
                        controls
                        className="h-9 w-full sm:w-72 accent-[#d4af37]"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-zinc-500 font-mono-tech text-xs">
                      <Music className="w-5 h-5" />
                      <span>No background music active. Class Albums will play silently.</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-tech text-xs uppercase font-bold flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Track</span>
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAudioBgUpload(file);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditAlbumBgMusicUrl('https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3')}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs"
                  >
                    Load Sample Serene Piano
                  </button>
                  {editAlbumBgMusicUrl && (
                    <button
                      type="button"
                      onClick={() => setEditAlbumBgMusicUrl('')}
                      className="text-rose-400 hover:text-rose-300 text-xs font-mono-tech ml-auto"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Platform Support & Brand */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-white/5">
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Brand Title
                    </label>
                    <input
                      type="text"
                      value={editPlatformTitle}
                      onChange={(e) => setEditPlatformTitle(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Support Email
                    </label>
                    <input
                      type="email"
                      value={editSupportEmail}
                      onChange={(e) => setEditSupportEmail(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Archival Cloud Guarantee
                    </label>
                    <div className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs flex items-center justify-between">
                      <span>Perpetual Storage</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Verified</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SAVE ALL BUTTON */}
              <div className="flex items-center justify-between pt-2">
                <button
                  id="save-overrides-btn"
                  type="submit"
                  className="bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold py-3.5 px-9 rounded-full transition-all cursor-pointer shadow-xl hover:scale-105 active:scale-95"
                >
                  Publish Website Media &amp; Content Sections
                </button>

                {editorSavedMsg && (
                  <span className="font-mono-tech text-xs text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Published to live website successfully!</span>
                  </span>
                )}
              </div>
            </form>
            )}
          </div>
        )}

        {/* =========================================================================
            3. ANALYTICS COUNTER: WEBSITE STATISTICS & QUOTA MONITORING
            ========================================================================= */}
        {activeTab === 'analytics' && (
          <div id="analytics-module" className="space-y-8">
            {/* Live Website Statistics & Growth Module */}
            <MasterWebsiteStatsSection
              sets={sets}
              universities={universities}
              contentOverride={contentOverride}
              onUpdateContentOverride={onUpdateContentOverride}
            />

            <div className="p-6 sm:p-8 rounded-3xl bg-[#18181b] border border-white/15 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-5 h-5 text-white" />
                    <h2 className="font-syne font-bold text-2xl text-white">
                      Active Image Metrics vs Moments Image Cap
                    </h2>
                  </div>
                  <p className="font-body text-xs text-zinc-400">
                    Real-time quota monitoring to enforce storage optimization across all registered sets.
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-3xl font-mono-tech font-bold text-white">
                    {totalActiveImages}
                    <span className="text-base text-zinc-500 font-normal"> / {globalCap}</span>
                  </span>
                  <p className="text-xs font-mono-tech text-white/80 mt-0.5">
                    {usagePercentage}% Capacity Utilized
                  </p>
                </div>
              </div>

              {/* Visual Progress Bar against 300 Cap */}
              <div className="space-y-2">
                <div className="w-full h-3 bg-black rounded-full overflow-hidden p-0.5 border border-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      usagePercentage > 90
                        ? 'bg-rose-500 shadow-lg shadow-rose-500/50'
                        : usagePercentage > 70
                        ? 'bg-amber-400 shadow-lg shadow-amber-400/50'
                        : 'bg-white shadow-lg shadow-white/30'
                    }`}
                    style={{ width: `${Math.max(4, usagePercentage)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono-tech text-zinc-500">
                  <span>0 Images</span>
                  <span>{globalCap - totalActiveImages} Images Remaining</span>
                  <span>Hard Cap: {globalCap}</span>
                </div>
              </div>

              {/* Image Allocation Breakdown per Set */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <h3 className="font-syne font-bold text-sm text-white">
                  Set-by-Set Image Allocation
                </h3>

                <div className="space-y-2.5">
                  {sets.map((s) => {
                    const studentCount = s.students.length;
                    const memCount = s.memories.reduce((acc, m) => acc + m.images.length, 0);
                    const awdCount = s.awards.length;
                    const vocCount = s.voices.length;
                    const setTotal = studentCount + memCount + awdCount + vocCount + 2;

                    return (
                      <div
                        key={s.id}
                        className="p-4 rounded-2xl bg-[#18181b] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <h4 className="font-syne font-bold text-sm text-white">
                            {s.departmentName} ({s.institutionName})
                          </h4>
                          <p className="text-xs text-zinc-400 font-mono-tech mt-0.5">
                            {s.classSetName} • Rep: {s.classRepName}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-mono-tech">
                          <span className="text-zinc-400">
                            {studentCount} Students • {memCount} Memories • {awdCount} Awards
                          </span>
                          <span className="px-3 py-1 rounded-full bg-white/10 text-white font-bold">
                            {setTotal} Images
                          </span>
                          <button
                            onClick={() => onViewDepartmentAlbum(s.id)}
                            className="text-white hover:underline flex items-center gap-1 text-xs cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            5. ADDITION REQUESTS
            ========================================================================= */}
        {activeTab === 'requests' && (
          <div id="requests-module" className="p-6 sm:p-8 rounded-3xl bg-[#18181b] border border-white/15 space-y-6">
            <div className="pb-3 border-b border-white/10">
              <h2 className="font-syne font-bold text-xl text-white flex items-center gap-2.5">
                <Inbox className="w-5 h-5 text-white" />
                Unlisted Department Addition Inquiries
              </h2>
              <p className="font-body text-xs text-zinc-400 mt-1">
                Incoming Class Rep inquiries requesting new universities or unlisted departments to be preloaded.
              </p>
            </div>

            <div className="space-y-3 font-body">
              {additionRequests.length === 0 ? (
                <p className="text-xs text-zinc-500 font-mono-tech py-8 text-center">
                  No pending department requests in queue.
                </p>
              ) : (
                additionRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-5 rounded-2xl bg-[#08090e] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-syne font-bold text-white text-sm">
                          {req.requestedDepartment}
                        </span>
                        <span className="text-zinc-500">•</span>
                        <span className="text-zinc-300 text-xs">{req.institutionName}</span>
                      </div>
                      <p className="text-xs text-zinc-400 font-mono-tech mt-1">
                        Faculty: {req.facultyName} • Rep: {req.requesterName} ({req.requesterEmail}, {req.requesterPhone})
                      </p>
                      {req.notes && (
                        <p className="text-xs text-zinc-400 mt-1.5 italic">"{req.notes}"</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {req.status === 'Pending' ? (
                        <button
                          onClick={() => handleApproveRequest(req)}
                          className="bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold py-2.5 px-4 rounded-full transition-colors cursor-pointer"
                        >
                          Approve &amp; Seed
                        </button>
                      ) : (
                        <span className="text-xs font-mono-tech text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                          Approved
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            FOUNDING CLASS ACCREDITATION & REVIEW SECTION
            ========================================================================= */}
        {activeTab === 'founding_requests' && (
          <MasterFoundingRequestsSection
            foundingRequests={foundingRequests}
            onApprove={onApproveFoundingRequest}
            onReject={onRejectFoundingRequest}
            onViewDepartmentLegacyWall={onViewDepartmentLegacyWall}
          />
        )}

        {/* =========================================================================
            6. LEGACY PLAQUE SYSTEM (Universal 10x12 Acrylic Specs & QR Archive)
            ========================================================================= */}
        {activeTab === 'plaque' && (
          <MasterLegacyPlaquesSection
            universities={universities}
            sets={sets}
            onViewDepartmentAlbum={onViewDepartmentAlbum}
            onOpenDepartmentPlaqueModal={(dept, uni) => setSelectedDeptForPlaque({ dept, uni })}
          />
        )}

        {/* =========================================================================
            7. ANNUAL RELIVE REMINDERS & ALUMNI EMAIL REGISTRY
            ========================================================================= */}
        {activeTab === 'reminders' && (
          <MasterAnnualRemindersSection
            universities={universities}
            sets={sets}
          />
        )}

        {/* =========================================================================
            NEXT-CLASS HANDOFFS & RELAY TRACKER
            ========================================================================= */}
        {activeTab === 'handoffs' && (
          <MasterNextClassHandoffsSection
            sets={sets}
            universities={universities}
            onViewDepartmentLegacyWall={(deptId, uniId) => onViewDepartmentLegacyWall?.(deptId, uniId)}
          />
        )}

        {/* =========================================================================
            8. TESTIMONIALS MODULE
            ========================================================================= */}
        {activeTab === 'testimonials' && (
          <MasterTestimonialsSection
            contentOverride={contentOverride}
            onUpdateContentOverride={(partial) => onUpdateContentOverride({ ...contentOverride, ...partial })}
          />
        )}

        {/* =========================================================================
            9. DISPUTES & CO-ADMIN CLAIMS MODULE
            ========================================================================= */}
        {activeTab === 'disputes' && (
          <MasterDisputesSection />
        )}
      </div>

      {/* Owner-Only Institutional & Department Admin Modals */}
      {selectedUniForEdit && (
        <EditUniversityModal
          isOpen={true}
          onClose={() => setSelectedUniForEdit(null)}
          university={selectedUniForEdit}
          onSaveUniversity={handleSaveEditedUniversity}
        />
      )}

      {selectedDeptForEdit && (
        <EditDepartmentModal
          isOpen={true}
          onClose={() => setSelectedDeptForEdit(null)}
          department={selectedDeptForEdit.dept}
          university={selectedDeptForEdit.uni}
          onSaveDepartment={(updated) => handleSaveEditedDepartment(updated, selectedDeptForEdit.uni.id)}
        />
      )}

      {selectedDeptForPlaque && (
        <DepartmentLegacyPlaqueModal
          isOpen={true}
          onClose={() => setSelectedDeptForPlaque(null)}
          department={selectedDeptForPlaque.dept}
          university={selectedDeptForPlaque.uni}
          sets={sets}
        />
      )}
    </div>
  );
};
