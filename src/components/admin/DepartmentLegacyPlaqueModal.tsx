import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { DepartmentItem, UniversityDirectoryItem, ClassSet } from '../../types';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  Printer, 
  ShieldCheck, 
  Building2, 
  QrCode, 
  ExternalLink,
  Sparkles,
  Award,
  ArrowLeft,
  ImageIcon
} from 'lucide-react';

interface DepartmentLegacyPlaqueModalProps {
  isOpen: boolean;
  onClose: () => void;
  department: DepartmentItem;
  university: UniversityDirectoryItem;
  sets: ClassSet[];
}

export const DepartmentLegacyPlaqueModal: React.FC<DepartmentLegacyPlaqueModalProps> = ({
  isOpen,
  onClose,
  department,
  university,
  sets,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showQrCode, setShowQrCode] = useState<boolean>(true);
  const plaqueRef = useRef<HTMLDivElement>(null);

  const deptDirectoryUrl = `${window.location.origin}${window.location.pathname}#dept-${department.id}`;
  const departmentSets = sets.filter(
    (s) => s.departmentId === department.id || s.departmentName.toLowerCase() === department.name.toLowerCase()
  );

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Generate QR Code data URL
  useEffect(() => {
    if (!isOpen) return;

    QRCode.toDataURL(
      deptDirectoryUrl,
      {
        width: 480,
        margin: 2,
        color: {
          dark: '#08090d',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      },
      (err, url) => {
        if (!err && url) {
          setQrDataUrl(url);
        }
      }
    );
  }, [isOpen, deptDirectoryUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(deptDirectoryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      // 10" wide by 12" high portrait acrylic plaque specification
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: [10, 12],
      });

      // Background plate: Sleek Obsidian & Deep Acrylic Cast tone
      doc.setFillColor(12, 14, 18);
      doc.rect(0, 0, 10, 12, 'F');

      // Subtle Outer Glass Margin
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

      // 4 Corner Standoff Wall Mount Bolts (0.75 inch diameter acrylic standoffs)
      const standoffPositions = [
        [0.65, 0.65],
        [9.35, 0.65],
        [0.65, 11.35],
        [9.35, 11.35],
      ];
      standoffPositions.forEach(([sx, sy]) => {
        // Outer standoff metallic ring
        doc.setFillColor(212, 175, 55);
        doc.circle(sx, sy, 0.16, 'F');
        doc.setFillColor(245, 230, 160);
        doc.circle(sx, sy, 0.11, 'F');
        // Center screw hole
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
      doc.text(university.name.toUpperCase(), 5.0, 1.95, { align: 'center' });

      // Faculty Name
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(180, 185, 195);
      doc.text(department.faculty.toUpperCase(), 5.0, 2.3, { align: 'center' });

      // Gold Divider Line
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.02);
      doc.line(2.5, 2.55, 7.5, 2.55);

      // Department Title
      doc.setFont('times', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(212, 175, 55);
      doc.text(department.name.toUpperCase(), 5.0, 3.1, { align: 'center' });

      // Sub-description
      doc.setFont('times', 'italic');
      doc.setFontSize(10.5);
      doc.setTextColor(220, 220, 220);
      const textLines = [
        'This architectural 10×12 acrylic plaque certifies permanent digital preservation',
        'of the graduating cohorts, achievements, and photographic annals of this department.',
      ];
      doc.text(textLines[0], 5.0, 3.65, { align: 'center' });
      doc.text(textLines[1], 5.0, 3.9, { align: 'center' });

      // Centered QR Code Container or Archival Crest (2.8 x 2.8 inches)
      if (showQrCode && qrDataUrl) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(3.6, 4.35, 2.8, 2.8, 0.1, 0.1, 'F');
        doc.setDrawColor(212, 175, 55);
        doc.setLineWidth(0.02);
        doc.roundedRect(3.6, 4.35, 2.8, 2.8, 0.1, 0.1, 'S');

        doc.addImage(qrDataUrl, 'PNG', 3.75, 4.5, 2.5, 2.5);

        // QR Code Instructions & Identifier
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(212, 175, 55);
        doc.text('SCAN TO EXPLORE DEPARTMENT ARCHIVE DIRECTORY', 5.0, 7.55, { align: 'center' });
      } else {
        // Commemorative Archival Crest Medallion
        doc.setDrawColor(212, 175, 55);
        doc.setLineWidth(0.035);
        doc.circle(5.0, 5.7, 1.35, 'S');
        doc.setLineWidth(0.015);
        doc.circle(5.0, 5.7, 1.25, 'S');

        doc.setFont('times', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(212, 175, 55);
        doc.text(department.code || university.shortCode, 5.0, 5.65, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(220, 220, 220);
        doc.text('PERMANENT ARCHIVE REGISTER', 5.0, 6.0, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(212, 175, 55);
        doc.text('OFFICIAL PHYSICAL COMMEMORATIVE REGISTER', 5.0, 7.55, { align: 'center' });
      }

      doc.setFont('courier', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(160, 165, 175);
      doc.text(`ARCHIVAL ID: ${department.code || 'DEPT'}-${university.shortCode}-PLAQUE-10x12 • KOHOT ARCHIVES`, 5.0, 7.85, { align: 'center' });

      // Department Legacy Caption
      if (department.caption) {
        doc.setFont('times', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(200, 205, 215);
        const splitCaption = doc.splitTextToSize(`"${department.caption}"`, 7.2);
        doc.text(splitCaption, 5.0, 8.4, { align: 'center' });
      }

      // Bottom Signatures & Seal
      doc.setDrawColor(90, 80, 50);
      doc.setLineWidth(0.015);
      doc.line(1.5, 9.8, 3.8, 9.8);
      doc.line(6.2, 9.8, 8.5, 9.8);

      doc.setFont('times', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(200, 200, 200);
      doc.text('HEAD OF DEPARTMENT', 2.65, 10.05, { align: 'center' });
      doc.text('DEAN OF FACULTY', 7.35, 10.05, { align: 'center' });

      doc.setFont('times', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(department.hodName || 'Verified Institutional Signature', 2.65, 10.25, { align: 'center' });
      doc.text('Official Seal & Accreditation', 7.35, 10.25, { align: 'center' });

      // Plaque Spec Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text('SPECIFICATION: 10×12 INCH ARCHITECTURAL CAST ACRYLIC WITH METALLIC STANDOFF MOUNTS', 5.0, 10.85, { align: 'center' });

      doc.save(`${university.shortCode}-${department.code || 'DEPT'}-10x12-Acrylic-Legacy-Plaque.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF plaque', error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadImage = async () => {
    setIsGeneratingImage(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1440;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bgGrad = ctx.createLinearGradient(0, 0, 1200, 1440);
      bgGrad.addColorStop(0, '#101218');
      bgGrad.addColorStop(0.5, '#0b0c10');
      bgGrad.addColorStop(1, '#07080a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1200, 1440);

      ctx.strokeStyle = '#2a2d38';
      ctx.lineWidth = 4;
      ctx.strokeRect(30, 30, 1140, 1380);

      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 5;
      ctx.strokeRect(60, 60, 1080, 1320);

      ctx.strokeStyle = '#8d7020';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(74, 74, 1052, 1292);

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

      ctx.textAlign = 'center';
      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 15px Georgia, serif';
      ctx.fillText('OFFICIAL ARCHIVAL REGISTER • INSTITUTIONAL PERMANENT REPOSITORY', 600, 140);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px Georgia, serif';
      ctx.fillText(university.name.toUpperCase(), 600, 200);

      ctx.fillStyle = '#9ca3af';
      ctx.font = '17px Arial, sans-serif';
      ctx.fillText(department.faculty.toUpperCase(), 600, 240);

      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(350, 270);
      ctx.lineTo(850, 270);
      ctx.stroke();

      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 36px Georgia, serif';
      ctx.fillText(department.name.toUpperCase(), 600, 335);

      ctx.fillStyle = '#d1d5db';
      ctx.font = 'italic 16px Georgia, serif';
      ctx.fillText('Architectural 10×12 Acrylic Commemorative Plaque', 600, 375);
      ctx.font = '14px Arial, sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText('Preserving the graduating cohorts, honors, and photographic annals', 600, 405);

      if (showQrCode && qrDataUrl) {
        const img = new Image();
        img.src = qrDataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(430, 460, 340, 340);
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 4;
        ctx.strokeRect(430, 460, 340, 340);

        ctx.drawImage(img, 445, 475, 310, 310);

        ctx.fillStyle = '#d4af37';
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.fillText('SCAN WITH CAMERA TO EXPLORE DEPARTMENT ARCHIVE', 600, 845);
      } else {
        // Draw gold circular commemorative seal
        ctx.save();
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(600, 630, 160, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(600, 630, 146, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#d4af37';
        ctx.font = 'bold 44px Georgia, serif';
        ctx.fillText(department.code || university.shortCode, 600, 620);

        ctx.font = 'bold 15px Arial, sans-serif';
        ctx.fillStyle = '#f3f4f6';
        ctx.fillText('PERMANENT ARCHIVE', 600, 665);
        ctx.restore();

        ctx.fillStyle = '#d4af37';
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.fillText('OFFICIAL PHYSICAL COMMEMORATIVE REGISTER', 600, 845);
      }

      ctx.fillStyle = '#6b7280';
      ctx.font = '13px monospace';
      ctx.fillText(`ARCHIVAL ID: ${department.code || 'DEPT'}-${university.shortCode}-PLAQUE-10x12 • KOHOT PLATFORM`, 600, 875);

      if (department.caption) {
        ctx.fillStyle = '#d1d5db';
        ctx.font = 'italic 15px Georgia, serif';
        ctx.fillText(`"${department.caption}"`, 600, 930);
      }

      if (department.hodName) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '14px Arial, sans-serif';
        ctx.fillText(`HOD: ${department.hodName}`, 600, 970);
      }

      ctx.fillStyle = '#6b7280';
      ctx.font = '12px Arial, sans-serif';
      ctx.fillText('OFFICIALLY CERTIFIED ON THE KOHOT PERMANENT ARCHIVAL NETWORK', 600, 1310);

      const pngDataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngDataUrl;
      link.download = `${university.shortCode}_${department.name.replace(/\s+/g, '_')}_10x12_Plaque.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading plaque image:', err);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      id="department-legacy-plaque-modal"
      onClick={(e) => {
        // Close if clicking the dark backdrop outside modal card
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl bg-[#0c0e14] border border-[#d4af37]/40 rounded-3xl shadow-2xl overflow-hidden my-4 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Sticky Modal Top Bar with prominent "Back to Dashboard" and "X" */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#12141c] shrink-0">
          <div className="flex items-center gap-3">
            <button
              id="plaque-modal-back-btn"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10"
              title="Return to Master Host Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Back to Dashboard</span>
            </button>
            <div className="hidden sm:block">
              <span className="text-xs font-syne font-bold text-white">
                10×12 Acrylic Plaque Register
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech uppercase tracking-wider bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30">
              Master Host Exclusive
            </span>
            <button
              id="plaque-modal-close-x-btn"
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Plaque Window"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">

          {/* 10" x 12" Portrait Acrylic Plaque Visual Mockup (aspect-[10/12]) */}
          <div className="flex justify-center">
            <div 
              ref={plaqueRef}
              className="relative w-full max-w-[380px] sm:max-w-[410px] aspect-[10/12] rounded-2xl bg-gradient-to-br from-[#181a20] via-[#101218] to-[#08090d] p-6 sm:p-8 border-2 border-white/20 shadow-[0_0_40px_rgba(212,175,55,0.12)] text-center flex flex-col justify-between overflow-hidden select-none"
            >
              {/* Acrylic glass edge bevel highlight */}
              <div className="absolute inset-0 border border-white/10 pointer-events-none rounded-2xl shadow-inner" />
              <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/[0.04] rounded-full blur-2xl pointer-events-none" />

              {/* 4 Corner Standoff Wall Bolts (Stainless steel / Brass standoffs for acrylic plaques) */}
              <div className="absolute top-3 left-3 w-4 h-4 rounded-full bg-gradient-to-br from-[#f5e6a0] via-[#d4af37] to-[#886618] border border-[#332208] shadow-md flex items-center justify-center">
                <div className="w-1.5 h-0.5 bg-[#221604]" />
              </div>
              <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-gradient-to-br from-[#f5e6a0] via-[#d4af37] to-[#886618] border border-[#332208] shadow-md flex items-center justify-center">
                <div className="w-1.5 h-0.5 bg-[#221604]" />
              </div>
              <div className="absolute bottom-3 left-3 w-4 h-4 rounded-full bg-gradient-to-br from-[#f5e6a0] via-[#d4af37] to-[#886618] border border-[#332208] shadow-md flex items-center justify-center">
                <div className="w-1.5 h-0.5 bg-[#221604]" />
              </div>
              <div className="absolute bottom-3 right-3 w-4 h-4 rounded-full bg-gradient-to-br from-[#f5e6a0] via-[#d4af37] to-[#886618] border border-[#332208] shadow-md flex items-center justify-center">
                <div className="w-1.5 h-0.5 bg-[#221604]" />
              </div>

              {/* Inner Gold Border Ring */}
              <div className="border border-[#d4af37]/40 rounded-xl p-4 sm:p-5 h-full flex flex-col justify-between relative bg-black/30 backdrop-blur-sm">
                
                {/* Plaque Top Headings */}
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] font-mono-tech text-[8px] sm:text-[9px] tracking-widest uppercase">
                    <ShieldCheck className="w-3 h-3" />
                    <span>PERMANENT ARCHIVAL REGISTER</span>
                  </div>

                  <h2 className="font-serif text-xs sm:text-sm font-bold tracking-wider text-white uppercase line-clamp-1 mt-1">
                    {university.name}
                  </h2>

                  <p className="font-sans text-[9px] sm:text-[10px] tracking-widest text-zinc-400 uppercase">
                    {department.faculty}
                  </p>

                  <h1 className="font-serif text-base sm:text-lg font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#f7e5a9] via-[#d4af37] to-[#b38928] uppercase drop-shadow">
                    {department.name}
                  </h1>

                  <div className="w-20 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent mx-auto" />
                </div>

                {/* Centered High-Density QR Code or Archival Seal */}
                <div className="my-auto py-1">
                  {showQrCode ? (
                    <>
                      <div className="p-2 sm:p-2.5 bg-white rounded-xl border border-[#d4af37] shadow-lg inline-block">
                        {qrDataUrl ? (
                          <img 
                            src={qrDataUrl} 
                            alt="Department Directory QR Code" 
                            className="w-28 h-28 sm:w-36 sm:h-36 object-contain"
                          />
                        ) : (
                          <div className="w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center">
                            <QrCode className="w-8 h-8 text-zinc-400 animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="mt-1.5">
                        <p className="font-sans font-bold text-[9px] sm:text-[10px] text-[#d4af37] tracking-wider uppercase">
                          SCAN FOR DIRECTORY &amp; YEARLY ALBUMS
                        </p>
                        <p className="font-mono-tech text-[7px] sm:text-[8px] text-zinc-500">
                          ID: {department.code || 'DEPT'}-{university.shortCode} • 10×12 ACRYLIC SPEC
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="py-2 flex flex-col items-center justify-center">
                      <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-2 border-[#d4af37] flex flex-col items-center justify-center bg-black/50 shadow-inner relative">
                        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border border-[#d4af37]/40 flex flex-col items-center justify-center">
                          <Award className="w-7 h-7 sm:w-8 sm:h-8 text-[#d4af37] mb-1" />
                          <span className="font-serif font-black text-xs sm:text-sm text-white tracking-wider">
                            {department.code || university.shortCode}
                          </span>
                          <span className="text-[7px] font-mono-tech text-[#d4af37] uppercase tracking-widest mt-0.5">
                            ARCHIVE REGISTER
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="font-sans font-bold text-[9px] sm:text-[10px] text-[#d4af37] tracking-wider uppercase">
                          OFFICIAL PHYSICAL COMMEMORATIVE REGISTER
                        </p>
                        <p className="font-mono-tech text-[7px] sm:text-[8px] text-zinc-500">
                          ID: {department.code || 'DEPT'}-{university.shortCode} • 10×12 ACRYLIC SPEC
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Plaque Caption Quote & Verification */}
                <div className="space-y-1">
                  {department.caption && (
                    <p className="font-serif italic text-[9px] sm:text-[10px] text-zinc-300 line-clamp-2 leading-relaxed px-2">
                      &ldquo;{department.caption}&rdquo;
                    </p>
                  )}

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[8px] sm:text-[9px] font-mono-tech text-zinc-400 px-1">
                    <span>HOD: {department.hodName || 'Department Chair'}</span>
                    <span className="text-[#d4af37]">Verified Register</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Plaque Customization & QR Visibility Toggle Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs font-mono-tech">
            <div className="flex items-center gap-2.5">
              <QrCode className="w-4 h-4 text-[#d4af37] shrink-0" />
              <div>
                <span className="text-zinc-300 font-semibold block">Plaque QR Code Display:</span>
                <span className="text-[11px] text-zinc-500">
                  {showQrCode ? 'Interactive Directory QR Code active' : 'Commemorative Archival Crest active'}
                </span>
              </div>
            </div>

            <button
              id="toggle-plaque-qr-btn"
              type="button"
              onClick={() => setShowQrCode(!showQrCode)}
              className={`w-full sm:w-auto px-4 py-2 rounded-xl border text-xs font-mono-tech flex items-center justify-center gap-2 transition-all cursor-pointer ${
                showQrCode
                  ? 'bg-[#d4af37]/20 border-[#d4af37]/50 text-[#d4af37] font-semibold'
                  : 'bg-white/5 border-white/15 text-zinc-300 hover:text-white hover:bg-white/10'
              }`}
              title="Toggle QR code on or off on the acrylic plaque"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR Code: {showQrCode ? 'Turn OFF' : 'Turn ON'}</span>
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* Download PDF button */}
            <button
              id="download-plaque-pdf-btn"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b38928] hover:from-[#e5c04b] hover:to-[#c49a39] text-black font-tech font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isGeneratingPdf ? 'Generating...' : '10×12 PDF'}</span>
            </button>

            {/* Download Image PNG button */}
            <button
              id="download-plaque-png-btn"
              onClick={handleDownloadImage}
              disabled={isGeneratingImage}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-tech font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 border border-white/15 transition-all cursor-pointer disabled:opacity-50"
            >
              <ImageIcon className="w-4 h-4 text-[#d4af37]" />
              <span>{isGeneratingImage ? 'Generating...' : 'Image (PNG)'}</span>
            </button>

            {/* Copy Directory Link */}
            <button
              id="copy-dept-link-btn"
              onClick={handleCopyLink}
              className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-tech text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
            </button>

            {/* Direct Print */}
            <button
              id="print-plaque-btn"
              onClick={handlePrint}
              className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-tech text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Plaque</span>
            </button>
          </div>

          {/* Return to Dashboard Footer Button */}
          <div className="pt-2 flex justify-center">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-mono-tech transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Master Host Dashboard</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
