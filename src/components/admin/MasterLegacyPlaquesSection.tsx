import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { UniversityDirectoryItem, DepartmentItem, ClassSet } from '../../types';
import { 
  QrCode, 
  Download, 
  Search, 
  Building2, 
  ChevronDown, 
  ChevronRight, 
  Check, 
  Copy, 
  Eye, 
  ShieldCheck, 
  Sparkles, 
  Printer, 
  ImageIcon,
  Maximize2,
  ExternalLink,
  Layers,
  Award,
  X
} from 'lucide-react';

interface MasterLegacyPlaquesSectionProps {
  universities: UniversityDirectoryItem[];
  sets: ClassSet[];
  onViewDepartmentAlbum: (setId: string) => void;
  onOpenDepartmentPlaqueModal: (dept: DepartmentItem, uni: UniversityDirectoryItem) => void;
}

export const MasterLegacyPlaquesSection: React.FC<MasterLegacyPlaquesSectionProps> = ({
  universities,
  sets,
  onViewDepartmentAlbum,
  onOpenDepartmentPlaqueModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUniFilter, setSelectedUniFilter] = useState<string>('all');
  
  // Universities expanded state
  const [expandedUnis, setExpandedUnis] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    if (universities[0]) init[universities[0].id] = true;
    return init;
  });
  
  // Selected department per university (strictly empty by default - compressed until user clicks a card)
  const [selectedDeptPerUni, setSelectedDeptPerUni] = useState<Record<string, string>>({});

  const [copiedLinkDeptId, setCopiedLinkDeptId] = useState<string | null>(null);
  const [deptQrCache, setDeptQrCache] = useState<Record<string, string>>({});
  const [generatingPdfDeptId, setGeneratingPdfDeptId] = useState<string | null>(null);
  const [generatingImageDeptId, setGeneratingImageDeptId] = useState<string | null>(null);

  // Pre-generate QR codes for departments
  useEffect(() => {
    universities.forEach((uni) => {
      (uni.departments || []).forEach(async (dept) => {
        if (!deptQrCache[dept.id]) {
          try {
            const deptUrl = `${window.location.origin}${window.location.pathname}#dept-${dept.id}`;
            const dataUrl = await QRCode.toDataURL(deptUrl, {
              width: 500,
              margin: 2,
              color: {
                dark: '#08090d',
                light: '#ffffff',
              },
              errorCorrectionLevel: 'H',
            });
            setDeptQrCache((prev) => ({ ...prev, [dept.id]: dataUrl }));
          } catch (e) {
            console.error('Error generating department QR:', e);
          }
        }
      });
    });
  }, [universities]);

  const toggleUniExpand = (uniId: string) => {
    setExpandedUnis((prev) => ({ ...prev, [uniId]: !prev[uniId] }));
  };

  // Toggle selection of department (clicking again collapses it to keep compressed)
  const handleSelectDepartment = (uniId: string, deptId: string) => {
    setSelectedDeptPerUni((prev) => ({
      ...prev,
      [uniId]: prev[uniId] === deptId ? '' : deptId,
    }));
  };

  const scrollDeptTrack = (uniId: string, direction: 'left' | 'right') => {
    const el = document.getElementById(`plaque-dept-scroll-${uniId}`);
    if (el) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleCopyDeptUrl = (deptId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#dept-${deptId}`;
    navigator.clipboard?.writeText(url);
    setCopiedLinkDeptId(deptId);
    setTimeout(() => setCopiedLinkDeptId(null), 2000);
  };

  // Download official 10" x 12" Department Legacy Plaque as PDF
  const handleDownloadDeptPlaquePdf = async (dept: DepartmentItem, uni: UniversityDirectoryItem) => {
    setGeneratingPdfDeptId(dept.id);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: [10, 12],
      });

      // Background plate: Sleek Obsidian & Deep Acrylic Cast tone
      doc.setFillColor(12, 14, 18);
      doc.rect(0, 0, 10, 12, 'F');

      // Outer Acrylic Bevel Edge
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.015);
      doc.rect(0.4, 0.4, 9.2, 11.2);

      // Metallic Gold Accent Frame
      doc.setDrawColor(212, 175, 55); // Metallic Gold (#d4af37)
      doc.setLineWidth(0.04);
      doc.rect(0.65, 0.65, 8.7, 10.7);

      // Inner hairline border
      doc.setDrawColor(180, 140, 40);
      doc.setLineWidth(0.01);
      doc.rect(0.75, 0.75, 8.5, 10.5);

      // 4 Corner Standoff Wall Mount Bolts (0.75 inch standoffs)
      const standoffPositions = [
        [0.65, 0.65],
        [9.35, 0.65],
        [0.65, 11.35],
        [9.35, 11.35],
      ];
      standoffPositions.forEach(([sx, sy]) => {
        doc.setFillColor(212, 175, 55);
        doc.circle(sx, sy, 0.16, 'F');
        doc.setFillColor(245, 230, 160);
        doc.circle(sx, sy, 0.11, 'F');
        doc.setFillColor(30, 25, 15);
        doc.circle(sx, sy, 0.05, 'F');
      });

      // Top Header Title
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(212, 175, 55);
      doc.text('OFFICIAL ARCHIVAL REGISTER • INSTITUTIONAL PERMANENT REPOSITORY', 5.0, 1.45, { align: 'center' });

      // University Name
      doc.setFont('times', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text(uni.name.toUpperCase(), 5.0, 1.95, { align: 'center' });

      // Faculty Name
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(180, 185, 195);
      doc.text(dept.faculty.toUpperCase(), 5.0, 2.3, { align: 'center' });

      // Gold Divider Line
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.02);
      doc.line(2.5, 2.55, 7.5, 2.55);

      // Department Title
      doc.setFont('times', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(212, 175, 55);
      doc.text(dept.name.toUpperCase(), 5.0, 3.1, { align: 'center' });

      // Sub-description
      doc.setFont('times', 'italic');
      doc.setFontSize(10.5);
      doc.setTextColor(220, 220, 220);
      doc.text('This architectural 10×12 acrylic plaque certifies permanent digital preservation', 5.0, 3.65, { align: 'center' });
      doc.text('of the graduating cohorts, achievements, and photographic annals of this department.', 5.0, 3.9, { align: 'center' });

      // QR Code
      const qrDataUrl = deptQrCache[dept.id] || (await QRCode.toDataURL(`${window.location.origin}${window.location.pathname}#dept-${dept.id}`, { width: 500, margin: 2 }));
      if (qrDataUrl) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(3.6, 4.35, 2.8, 2.8, 0.1, 0.1, 'F');
        doc.setDrawColor(212, 175, 55);
        doc.setLineWidth(0.02);
        doc.roundedRect(3.6, 4.35, 2.8, 2.8, 0.1, 0.1, 'S');

        doc.addImage(qrDataUrl, 'PNG', 3.75, 4.5, 2.5, 2.5);
      }

      // QR Code Instructions & Identifier
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(212, 175, 55);
      doc.text('SCAN TO EXPLORE DEPARTMENT ARCHIVE DIRECTORY', 5.0, 7.55, { align: 'center' });

      doc.setFont('courier', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(160, 165, 175);
      doc.text(`ARCHIVAL ID: ${dept.code || 'DEPT'}-${uni.shortCode}-PLAQUE-10x12 • KOHOT ARCHIVES`, 5.0, 7.85, { align: 'center' });

      if (dept.caption) {
        doc.setFont('times', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(210, 210, 210);
        doc.text(`"${dept.caption}"`, 5.0, 8.4, { align: 'center', maxWidth: 6.5 });
      }

      if (dept.hodName) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(180, 185, 195);
        doc.text(`HOD: ${dept.hodName}`, 5.0, 9.0, { align: 'center' });
      }

      // Bottom Certification
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(140, 145, 155);
      doc.text('PERMANENT DIGITAL HERITAGE CERTIFICATE • POWERED BY KOHOT ARCHIVAL PROTOCOL', 5.0, 11.1, { align: 'center' });

      doc.save(`KoHot_Legacy_Plaque_10x12_${uni.shortCode}_${dept.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Error generating plaque PDF:', err);
    } finally {
      setGeneratingPdfDeptId(null);
    }
  };

  // Download official 10" x 12" Department Legacy Plaque as high-resolution PNG Image
  const handleDownloadDeptPlaqueImage = async (dept: DepartmentItem, uni: UniversityDirectoryItem) => {
    setGeneratingImageDeptId(dept.id);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1440; // 10:12 aspect ratio
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Background plate: Obsidian acrylic tone
      const bgGrad = ctx.createLinearGradient(0, 0, 1200, 1440);
      bgGrad.addColorStop(0, '#101218');
      bgGrad.addColorStop(0.5, '#0b0c10');
      bgGrad.addColorStop(1, '#07080a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1200, 1440);

      // Beveled Edge outer frame
      ctx.strokeStyle = '#2a2d38';
      ctx.lineWidth = 4;
      ctx.strokeRect(30, 30, 1140, 1380);

      // Outer Gold Accent Frame
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 5;
      ctx.strokeRect(60, 60, 1080, 1320);

      // Inner Hairline Gold Border
      ctx.strokeStyle = '#8d7020';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(74, 74, 1052, 1292);

      // Brass Standoff Bolts in 4 corners
      const standoffs = [
        [60, 60],
        [1140, 60],
        [60, 1380],
        [1140, 1380],
      ];
      standoffs.forEach(([sx, sy]) => {
        ctx.beginPath();
        ctx.arc(sx, sy, 22, 0, Math.PI * 2);
        ctx.fillStyle = '#d4af37';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#f7e7a8';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#221a08';
        ctx.fill();
      });

      // Archival Header
      ctx.textAlign = 'center';
      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 15px Georgia, serif';
      ctx.fillText('OFFICIAL ARCHIVAL REGISTER • INSTITUTIONAL PERMANENT REPOSITORY', 600, 140);

      // University Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px Georgia, serif';
      ctx.fillText(uni.name.toUpperCase(), 600, 200);

      // Faculty Name
      ctx.fillStyle = '#9ca3af';
      ctx.font = '17px Arial, sans-serif';
      ctx.fillText(dept.faculty.toUpperCase(), 600, 240);

      // Gold Divider
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(350, 270);
      ctx.lineTo(850, 270);
      ctx.stroke();

      // Department Title
      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 36px Georgia, serif';
      ctx.fillText(dept.name.toUpperCase(), 600, 335);

      // Subtitle
      ctx.fillStyle = '#d1d5db';
      ctx.font = 'italic 16px Georgia, serif';
      ctx.fillText('Architectural 10×12 Acrylic Commemorative Plaque', 600, 375);
      ctx.font = '14px Arial, sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText('Preserving the graduating cohorts, honors, and photographic annals', 600, 405);

      // QR Code
      const qrUrl = deptQrCache[dept.id] || (await QRCode.toDataURL(`${window.location.origin}${window.location.pathname}#dept-${dept.id}`, { width: 500, margin: 2 }));
      if (qrUrl) {
        const img = new Image();
        img.src = qrUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(430, 460, 340, 340);
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 4;
        ctx.strokeRect(430, 460, 340, 340);

        ctx.drawImage(img, 445, 475, 310, 310);
      }

      // QR Scan Call to Action
      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.fillText('SCAN WITH CAMERA TO EXPLORE DEPARTMENT ARCHIVE', 600, 845);

      ctx.fillStyle = '#6b7280';
      ctx.font = '13px monospace';
      ctx.fillText(`ARCHIVAL ID: ${dept.code || 'DEPT'}-${uni.shortCode}-PLAQUE-10x12 • KOHOT PLATFORM`, 600, 875);

      if (dept.caption) {
        ctx.fillStyle = '#d1d5db';
        ctx.font = 'italic 15px Georgia, serif';
        ctx.fillText(`"${dept.caption}"`, 600, 930);
      }

      if (dept.hodName) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '14px Arial, sans-serif';
        ctx.fillText(`HOD: ${dept.hodName}`, 600, 970);
      }

      // Bottom archival footer
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px Arial, sans-serif';
      ctx.fillText('OFFICIALLY CERTIFIED ON THE KOHOT PERMANENT ARCHIVAL NETWORK', 600, 1310);

      // Trigger download
      const pngDataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngDataUrl;
      link.download = `KoHot_Legacy_Plaque_${uni.shortCode}_${dept.name.replace(/\s+/g, '_')}_10x12.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading plaque image:', err);
    } finally {
      setGeneratingImageDeptId(null);
    }
  };

  // Filtered universities based on search & filter
  const filteredUniversities = universities.filter((u) => {
    if (selectedUniFilter !== 'all' && u.id !== selectedUniFilter) {
      return false;
    }
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchUni = u.name.toLowerCase().includes(term) || u.shortCode.toLowerCase().includes(term);
    const matchDept = u.departments?.some((d) => d.name.toLowerCase().includes(term) || d.faculty.toLowerCase().includes(term));
    return matchUni || matchDept;
  });

  const totalDepartments = universities.reduce((acc, u) => acc + (u.departments?.length || 0), 0);

  return (
    <div id="master-legacy-plaques-module" className="space-y-8 animate-fadeIn">
      {/* Top Section Header & KPI Spec Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0c0d14] border border-white/15 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2.5">
              <QrCode className="w-5 h-5 text-[#d4af37]" />
              <h2 className="font-syne font-bold text-xl text-white tracking-tight">
                Department Legacy Plaque Registry &amp; Wall Specs
              </h2>
            </div>
            <p className="font-body text-xs text-zinc-400 mt-1.5 max-w-3xl leading-relaxed">
              Official physical 10"×12" acrylic department wall plaques. Legacy plaques are created exclusively at the <strong>department level</strong>. Swipe through department cards under each university and click any card to reveal its official 10×12 acrylic plaque, downloadable as PDF or Image.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 font-mono-tech text-xs">
            <div className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-[#d4af37]" />
              <span className="text-zinc-400">Unis:</span>
              <span className="text-white font-bold">{universities.length}</span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-2">
              <span className="text-zinc-400">Department Plaques:</span>
              <span className="text-[#d4af37] font-bold">{totalDepartments}</span>
            </div>
          </div>
        </div>

        {/* Physical Fabrication Spec Highlight Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono-tech">
          <div className="p-3.5 rounded-2xl bg-[#08090e] border border-white/10">
            <span className="text-zinc-500 text-[10px] block uppercase">FABRICATION STANDARD</span>
            <span className="text-white font-bold text-sm block mt-0.5">10" × 12" Portrait</span>
            <span className="text-zinc-400 text-[10px] mt-0.5 block">Beveled edge acrylic</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#08090e] border border-white/10">
            <span className="text-zinc-500 text-[10px] block uppercase">STANDOFF HARDWARE</span>
            <span className="text-white font-bold text-sm block mt-0.5">4× 19mm Standoffs</span>
            <span className="text-zinc-400 text-[10px] mt-0.5 block">Brushed brass / chrome</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#08090e] border border-white/10">
            <span className="text-zinc-500 text-[10px] block uppercase">DOWNLOAD FORMATS</span>
            <span className="text-[#d4af37] font-bold text-sm block mt-0.5">PDF &amp; PNG Image</span>
            <span className="text-zinc-400 text-[10px] mt-0.5 block">High-resolution vector</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#08090e] border border-white/10">
            <span className="text-zinc-500 text-[10px] block uppercase">PLAQUE ARCHIVAL LEVEL</span>
            <span className="text-white font-bold text-sm block mt-0.5">Department Level Only</span>
            <span className="text-zinc-400 text-[10px] mt-0.5 block">Centrally unites all class sets</span>
          </div>
        </div>
      </div>

      {/* Search and Uni Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1 flex-wrap">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search university or department..."
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#0c0d14] border border-white/15 text-white placeholder:text-zinc-600 font-body text-xs focus:border-white/40 focus:outline-none"
            />
          </div>

          <select
            value={selectedUniFilter}
            onChange={(e) => setSelectedUniFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-[#0c0d14] border border-white/15 text-white font-mono-tech text-xs focus:border-white/40 focus:outline-none cursor-pointer"
          >
            <option value="all">All Universities ({universities.length})</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.shortCode} - {u.name}
              </option>
            ))}
          </select>
        </div>

        <span className="text-zinc-400 text-xs font-mono-tech self-end sm:self-center">
          Showing {filteredUniversities.length} {filteredUniversities.length === 1 ? 'University' : 'Universities'}
        </span>
      </div>

      {/* Hierarchical Tree: Universities -> Swipable Department Cards -> Revealed Department Legacy Plaque */}
      <div className="space-y-8">
        {filteredUniversities.map((uni, uniIdx) => {
          const isExpanded = !!expandedUnis[uni.id];
          const uniOrder = uni.orderNumber || uniIdx + 1;
          const departments = uni.departments || [];

          // Selected department for this university (only revealed when clicked)
          const activeDeptId = selectedDeptPerUni[uni.id];
          const activeDept = activeDeptId ? departments.find((d) => d.id === activeDeptId) : null;

          // Sets under active department if revealed
          const activeDeptSets = activeDept
            ? sets.filter(
                (s) =>
                  s.departmentId === activeDept.id ||
                  (s.institutionId === uni.id && s.departmentName.toLowerCase() === activeDept.name.toLowerCase()) ||
                  (s.institutionName.toLowerCase().includes(uni.shortCode.toLowerCase()) &&
                    s.departmentName.toLowerCase().includes(activeDept.name.toLowerCase()))
              )
            : [];

          return (
            <div
              key={uni.id}
              className="rounded-3xl bg-[#08090e] border border-white/15 overflow-hidden transition-all duration-300 shadow-xl"
            >
              {/* University Header Bar */}
              <div
                onClick={() => toggleUniExpand(uni.id)}
                className="p-5 sm:p-6 bg-gradient-to-r from-white/[0.05] to-transparent border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.06] transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-white/10 border border-white/20 text-white shrink-0 font-mono-tech font-bold">
                    <span className="text-[9px] text-zinc-400">UNI</span>
                    <span className="text-base text-[#d4af37]">#{String(uniOrder).padStart(2, '0')}</span>
                  </div>

                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-black border border-white/15 shrink-0 flex items-center justify-center p-1">
                    <img
                      src={uni.logoUrl}
                      alt={uni.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain filter grayscale-[10%]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-syne font-bold text-base text-white tracking-tight">{uni.name}</h3>
                      <span className="text-[10px] font-mono-tech text-black bg-white font-bold px-2 py-0.5 rounded-full">
                        {uni.shortCode}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono-tech text-zinc-400 mt-1 flex-wrap">
                      <span className="text-white font-semibold">{departments.length} Department Plaques</span>
                      <span>•</span>
                      <span>{uni.location}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center shrink-0 font-mono-tech text-xs">
                  <span className="text-zinc-400 text-xs hidden sm:inline">
                    {isExpanded ? 'Collapse Compartment' : 'Explore Department Plaques'}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Swipable Department Horizontal Cards & Revealed Department Plaque */}
              {isExpanded && (
                <div className="p-5 sm:p-7 space-y-6 bg-black/30">
                  {departments.length === 0 ? (
                    <div className="p-6 text-center text-zinc-500 font-mono-tech text-xs rounded-xl bg-white/[0.02]">
                      No departments registered under {uni.name}.
                    </div>
                  ) : (
                    <>
                      {/* Section Header with Left/Right Navigation controls */}
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-[#d4af37]" />
                            <h4 className="font-syne font-bold text-sm sm:text-base text-white">
                              Department Cards (Swipe &amp; Click to View Plaque)
                            </h4>
                            <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-white/10 text-[#d4af37]">
                              {departments.length} {departments.length === 1 ? 'Department' : 'Departments'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 font-body mt-0.5">
                            Plaques exist exclusively at the department level. Click any department card to reveal and download its 10"×12" acrylic Legacy Plaque.
                          </p>
                        </div>

                        {departments.length > 1 && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => scrollDeptTrack(uni.id, 'left')}
                              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
                              title="Scroll left"
                              aria-label="Scroll left"
                            >
                              ‹
                            </button>
                            <button
                              onClick={() => scrollDeptTrack(uni.id, 'right')}
                              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
                              title="Scroll right"
                              aria-label="Scroll right"
                            >
                              ›
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Swipable Horizontal Flex Track of Department Cards */}
                      <div
                        id={`plaque-dept-scroll-${uni.id}`}
                        className="flex gap-5 overflow-x-auto pb-4 pt-1 px-1 scroll-smooth snap-x snap-mandatory focus:outline-none no-scrollbar"
                        style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
                      >
                        {departments.map((dept) => {
                          const isDeptSelected = dept.id === activeDept?.id;
                          
                          // Sets preserved under this department
                          const deptSets = sets.filter(
                            (s) =>
                              s.departmentId === dept.id ||
                              (s.institutionId === uni.id && s.departmentName.toLowerCase() === dept.name.toLowerCase()) ||
                              (s.institutionName.toLowerCase().includes(uni.shortCode.toLowerCase()) &&
                                s.departmentName.toLowerCase().includes(dept.name.toLowerCase()))
                          );

                          return (
                            <div
                              key={dept.id}
                              id={`plaque-department-card-${dept.id}`}
                              onClick={() => onOpenDepartmentPlaqueModal(dept, uni)}
                              className="w-[320px] sm:w-[380px] lg:w-[410px] shrink-0 snap-start p-5 rounded-2xl transition-all duration-300 flex flex-col justify-between space-y-4 cursor-pointer select-none bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-[#d4af37]/50 shadow-lg hover:shadow-[0_0_25px_rgba(212,175,55,0.15)] group"
                            >
                              {/* Department Top Row */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/60 border border-white/15 shrink-0 flex items-center justify-center p-1 group-hover:border-[#d4af37]/40 transition-colors">
                                    <img
                                      src={dept.logoUrl || uni.logoUrl}
                                      alt={dept.name}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-contain filter grayscale-[10%]"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h5 className="font-syne font-bold text-sm text-white truncate max-w-[200px] group-hover:text-[#d4af37] transition-colors">
                                        {dept.name}
                                      </h5>
                                      {dept.code && (
                                        <span className="text-[9px] font-mono-tech uppercase bg-white/10 text-white px-1.5 py-0.5 rounded">
                                          {dept.code}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] font-mono-tech text-zinc-400 mt-0.5 truncate">
                                      {dept.faculty}
                                    </p>
                                  </div>
                                </div>

                                <span className="text-[10px] font-mono-tech px-2.5 py-0.5 rounded-full shrink-0 font-bold bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30">
                                  10×12 Plaque
                                </span>
                              </div>

                              {/* Hero Artwork Preview */}
                              <div className="relative rounded-xl overflow-hidden bg-black/50 border border-white/10 aspect-[21/9]">
                                <img
                                  src={dept.heroImageUrl}
                                  alt={dept.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover filter brightness-75 group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-2.5">
                                  <span className="text-[9px] font-mono-tech text-[#d4af37] uppercase tracking-wider flex items-center gap-1">
                                    <QrCode className="w-3 h-3" />
                                    <span>Preserving {deptSets.length} {deptSets.length === 1 ? 'Class' : 'Classes'} • Department Wall Plaque</span>
                                  </span>
                                </div>
                              </div>

                              {/* Card Bottom CTA & Status */}
                              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs font-mono-tech">
                                <span className="text-[11px] text-[#d4af37] flex items-center gap-1.5">
                                  <Maximize2 className="w-3.5 h-3.5" />
                                  <span>10×12 Pop-up Window</span>
                                </span>

                                <span className="text-zinc-400 text-[11px] group-hover:text-white transition-colors flex items-center gap-1">
                                  <span>Tap to View</span>
                                  <span>➔</span>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* COMPRESSED HINT BAR */}
                      <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center font-mono-tech text-xs text-zinc-400 flex items-center justify-center gap-2">
                        <QrCode className="w-3.5 h-3.5 text-[#d4af37]" />
                        <span>Click any department card above to reveal its official 10×12 acrylic Legacy Plaque in a pop-up window (with QR scanner &amp; PDF/Image download).</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
