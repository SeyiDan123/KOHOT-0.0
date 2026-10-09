import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { 
  QrCode, 
  Download, 
  Copy, 
  Check, 
  X, 
  Printer, 
  ExternalLink, 
  Sparkles, 
  FileText, 
  Share2,
  Calendar,
  Building,
  GraduationCap
} from 'lucide-react';
import { ClassSet } from '../../types';
import { UniversalModal } from '../common/UniversalModal';

interface AlbumQrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSet: ClassSet;
}

export const AlbumQrCodeModal: React.FC<AlbumQrCodeModalProps> = ({
  isOpen,
  onClose,
  currentSet,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [plaqueTheme, setPlaqueTheme] = useState<'dark' | 'clean'>('dark');
  const plaqueRef = useRef<HTMLDivElement>(null);

  // Compute absolute public album link
  const albumUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}#album-${currentSet.id}`
    : `https://kohot.app/#album-${currentSet.id}`;

  // Generate QR Code data URL whenever currentSet or isOpen changes
  useEffect(() => {
    if (!isOpen) return;

    QRCode.toDataURL(albumUrl, {
      width: 800,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR code:', err);
      });
  }, [albumUrl, isOpen]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(albumUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Download high-resolution PNG of the QR Code
  const handleDownloadQrPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `KoHot-${currentSet.classSetName.replace(/\s+/g, '_')}-Album-QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Generate and Download high-quality A4 PDF Plaque / Event Poster
  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);

      // Create A4 PDF in portrait orientation (210mm x 297mm)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const pageHeight = 297;

      if (plaqueTheme === 'dark') {
        // Dark Theme Background: Deep Onyx / Navy
        doc.setFillColor(11, 13, 20);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        // Decorative Outer Gold/Bronze Border
        doc.setDrawColor(212, 175, 55); // Metallic Gold
        doc.setLineWidth(1.2);
        doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

        // Subtle Inner Border
        doc.setDrawColor(255, 255, 255);
        doc.setDrawColor(60, 65, 80);
        doc.setLineWidth(0.4);
        doc.rect(15, 15, pageWidth - 30, pageHeight - 30);

        // Header Sub-banner
        doc.setTextColor(212, 175, 55);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('OFFICIAL COMMEMORATIVE DIGITAL PLAQUE', pageWidth / 2, 28, { align: 'center' });

        // Department Title
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        const splitDept = doc.splitTextToSize(currentSet.departmentName.toUpperCase(), 160);
        doc.text(splitDept, pageWidth / 2, 42, { align: 'center' });

        const deptHeightOffset = splitDept.length > 1 ? 8 : 0;

        // Class Set & Cohort Info
        doc.setTextColor(200, 205, 220);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(14);
        doc.text(`"${currentSet.classSetName}"`, pageWidth / 2, 54 + deptHeightOffset, { align: 'center' });

        doc.setTextColor(212, 175, 55);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(`CLASS OF ${currentSet.graduationYear} • ALUMNI ARCHIVE`, pageWidth / 2, 62 + deptHeightOffset, { align: 'center' });

        // Divider Line
        doc.setDrawColor(212, 175, 55);
        doc.setLineWidth(0.6);
        doc.line(40, 70 + deptHeightOffset, pageWidth - 40, 70 + deptHeightOffset);

        // White Plate Background for high QR scanning reliability
        const qrBoxSize = 95;
        const qrBoxX = (pageWidth - qrBoxSize) / 2;
        const qrBoxY = 80 + deptHeightOffset;

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 4, 4, 'F');

        // Draw Gold Corner Accents on QR Plate
        doc.setDrawColor(212, 175, 55);
        doc.setLineWidth(0.8);
        doc.roundedRect(qrBoxX - 2, qrBoxY - 2, qrBoxSize + 4, qrBoxSize + 4, 5, 5, 'D');

        // Embed QR Code inside plate
        const qrImgSize = 85;
        const qrImgX = (pageWidth - qrImgSize) / 2;
        const qrImgY = qrBoxY + 5;
        doc.addImage(qrDataUrl, 'PNG', qrImgX, qrImgY, qrImgSize, qrImgSize);

        // Scan Instructions Callout
        const instructionY = qrBoxY + qrBoxSize + 16;
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('SCAN WITH ANY SMARTPHONE CAMERA', pageWidth / 2, instructionY, { align: 'center' });

        doc.setTextColor(160, 165, 180);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Instant access to graduate portraits, milestone galleries,', pageWidth / 2, instructionY + 7, { align: 'center' });
        doc.text('faculty testimonials, leadership roster & departmental honors.', pageWidth / 2, instructionY + 12, { align: 'center' });

        // Event Plaque Seal / Footer
        const footerBoxY = 238;
        doc.setFillColor(20, 24, 36);
        doc.roundedRect(25, footerBoxY, pageWidth - 50, 32, 3, 3, 'F');
        doc.setDrawColor(60, 70, 95);
        doc.setLineWidth(0.3);
        doc.roundedRect(25, footerBoxY, pageWidth - 50, 32, 3, 3, 'D');

        doc.setTextColor(212, 175, 55);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('PHYSICAL EVENT & PLAQUE ACCESS URL', pageWidth / 2, footerBoxY + 8, { align: 'center' });

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(albumUrl, pageWidth / 2, footerBoxY + 16, { align: 'center' });

        doc.setTextColor(140, 145, 160);
        doc.setFontSize(8);
        doc.text('Permanent digital archive hosted on KoHot Platform • Powered by AI Studio', pageWidth / 2, footerBoxY + 24, { align: 'center' });

      } else {
        // Clean Academic Light Theme (Pure White / Ink Navy / Gold)
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        // Outer Dark Slate Border
        doc.setDrawColor(24, 28, 42);
        doc.setLineWidth(1.2);
        doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

        // Inner Fine Golden Line
        doc.setDrawColor(180, 140, 40);
        doc.setLineWidth(0.4);
        doc.rect(15, 15, pageWidth - 30, pageHeight - 30);

        // Header Sub-banner
        doc.setTextColor(160, 120, 30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('OFFICIAL COMMEMORATIVE DIGITAL PLAQUE', pageWidth / 2, 28, { align: 'center' });

        // Department Title
        doc.setTextColor(20, 24, 36);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        const splitDept = doc.splitTextToSize(currentSet.departmentName.toUpperCase(), 160);
        doc.text(splitDept, pageWidth / 2, 42, { align: 'center' });

        const deptHeightOffset = splitDept.length > 1 ? 8 : 0;

        // Class Set & Cohort Info
        doc.setTextColor(70, 75, 90);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(14);
        doc.text(`"${currentSet.classSetName}"`, pageWidth / 2, 54 + deptHeightOffset, { align: 'center' });

        doc.setTextColor(160, 120, 30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(`CLASS OF ${currentSet.graduationYear} • ALUMNI ARCHIVE`, pageWidth / 2, 62 + deptHeightOffset, { align: 'center' });

        // Divider
        doc.setDrawColor(200, 205, 215);
        doc.setLineWidth(0.6);
        doc.line(40, 70 + deptHeightOffset, pageWidth - 40, 70 + deptHeightOffset);

        // QR Box
        const qrBoxSize = 95;
        const qrBoxX = (pageWidth - qrBoxSize) / 2;
        const qrBoxY = 80 + deptHeightOffset;

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 4, 4, 'F');
        doc.setDrawColor(200, 205, 215);
        doc.setLineWidth(0.5);
        doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 4, 4, 'D');

        // Embed QR Code
        const qrImgSize = 85;
        const qrImgX = (pageWidth - qrImgSize) / 2;
        const qrImgY = qrBoxY + 5;
        doc.addImage(qrDataUrl, 'PNG', qrImgX, qrImgY, qrImgSize, qrImgSize);

        // Scan Instructions
        const instructionY = qrBoxY + qrBoxSize + 16;
        doc.setTextColor(20, 24, 36);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('SCAN WITH ANY SMARTPHONE CAMERA', pageWidth / 2, instructionY, { align: 'center' });

        doc.setTextColor(100, 110, 125);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Instant access to graduate portraits, milestone galleries,', pageWidth / 2, instructionY + 7, { align: 'center' });
        doc.text('faculty testimonials, leadership roster & departmental honors.', pageWidth / 2, instructionY + 12, { align: 'center' });

        // Footer Box
        const footerBoxY = 238;
        doc.setFillColor(244, 246, 250);
        doc.roundedRect(25, footerBoxY, pageWidth - 50, 32, 3, 3, 'F');
        doc.setDrawColor(220, 225, 235);
        doc.setLineWidth(0.4);
        doc.roundedRect(25, footerBoxY, pageWidth - 50, 32, 3, 3, 'D');

        doc.setTextColor(160, 120, 30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('PHYSICAL EVENT & PLAQUE ACCESS URL', pageWidth / 2, footerBoxY + 8, { align: 'center' });

        doc.setTextColor(20, 24, 36);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(albumUrl, pageWidth / 2, footerBoxY + 16, { align: 'center' });

        doc.setTextColor(120, 125, 140);
        doc.setFontSize(8);
        doc.text('Permanent digital archive hosted on KoHot Platform', pageWidth / 2, footerBoxY + 24, { align: 'center' });
      }

      // Save the generated PDF
      const filename = `KoHot_${currentSet.classSetName.replace(/\s+/g, '_')}_Commemorative_Plaque.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintPlaque = () => {
    window.print();
  };

  return (
    <UniversalModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-syne font-bold text-lg sm:text-xl text-white">
              Shareable QR Code &amp; Event Plaque
            </h3>
            <p className="font-body text-xs text-zinc-400">
              Display at convocation dinner, reunions, or print on a commemorative plaque.
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-6 text-white">
          {/* Plaque Poster Live Preview Box */}
          <div 
            ref={plaqueRef}
            className={`p-6 sm:p-8 rounded-2xl border transition-colors relative overflow-hidden flex flex-col items-center text-center ${
              plaqueTheme === 'dark'
                ? 'bg-gradient-to-b from-[#0c0f18] via-[#090b12] to-[#06080e] border-amber-500/40 shadow-2xl text-white'
                : 'bg-gradient-to-b from-white via-slate-50 to-slate-100 border-slate-300 shadow-xl text-slate-900'
            }`}
          >
            {/* Corner Decorative Accents */}
            <div className={`absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 ${plaqueTheme === 'dark' ? 'border-amber-400/60' : 'border-amber-600/60'}`} />
            <div className={`absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 ${plaqueTheme === 'dark' ? 'border-amber-400/60' : 'border-amber-600/60'}`} />
            <div className={`absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 ${plaqueTheme === 'dark' ? 'border-amber-400/60' : 'border-amber-600/60'}`} />
            <div className={`absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 ${plaqueTheme === 'dark' ? 'border-amber-400/60' : 'border-amber-600/60'}`} />

            {/* Sub-banner */}
            <span className={`font-mono-tech text-[10px] uppercase tracking-[0.25em] font-bold ${
              plaqueTheme === 'dark' ? 'text-amber-400' : 'text-amber-700'
            }`}>
              OFFICIAL COMMEMORATIVE DIGITAL PLAQUE
            </span>

            {/* Department Title */}
            <h2 className="font-syne font-bold text-xl sm:text-2xl mt-1 tracking-tight">
              {currentSet.departmentName}
            </h2>

            {/* Class Set & Year */}
            <p className={`font-body text-xs sm:text-sm mt-1 font-medium ${
              plaqueTheme === 'dark' ? 'text-zinc-300' : 'text-slate-700'
            }`}>
              "{currentSet.classSetName}" • Class of {currentSet.graduationYear}
            </p>

            {/* QR Code Container */}
            <div className="my-5 p-3 rounded-2xl bg-white shadow-2xl border border-white/20 inline-block">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR code for ${currentSet.departmentName} class album`}
                  className="w-44 h-44 sm:w-52 sm:h-52 object-contain"
                />
              ) : (
                <div className="w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center text-zinc-500 font-mono-tech text-xs">
                  Generating QR...
                </div>
              )}
            </div>

            {/* Instruction */}
            <div className="space-y-1 max-w-sm">
              <p className={`font-syne font-bold text-sm uppercase tracking-wider ${
                plaqueTheme === 'dark' ? 'text-white' : 'text-slate-950'
              }`}>
                SCAN WITH SMARTPHONE CAMERA
              </p>
              <p className={`font-body text-[11px] leading-relaxed ${
                plaqueTheme === 'dark' ? 'text-zinc-400' : 'text-slate-600'
              }`}>
                Instant access to portraits, graduating roster, memories gallery &amp; department honors.
              </p>
            </div>

            {/* URL Tag */}
            <div className={`mt-4 px-4 py-1.5 rounded-full text-[11px] font-mono-tech border truncate max-w-full ${
              plaqueTheme === 'dark'
                ? 'bg-black/60 border-white/15 text-zinc-300'
                : 'bg-white border-slate-200 text-slate-700 shadow-sm'
            }`}>
              {albumUrl}
            </div>
          </div>

          {/* Theme & Actions Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            {/* Theme Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono-tech text-zinc-400">PDF Style:</span>
              <button
                type="button"
                onClick={() => setPlaqueTheme('dark')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono-tech transition-colors cursor-pointer ${
                  plaqueTheme === 'dark'
                    ? 'bg-amber-500 text-black font-bold'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                Onyx &amp; Gold
              </button>
              <button
                type="button"
                onClick={() => setPlaqueTheme('clean')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono-tech transition-colors cursor-pointer ${
                  plaqueTheme === 'clean'
                    ? 'bg-white text-black font-bold'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                Academic White
              </button>
            </div>

            {/* Copy Direct Album Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 border border-white/10"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Album Link</span>
                </>
              )}
            </button>
          </div>

          {/* Primary Download Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              id="download-plaque-pdf-btn"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf || !qrDataUrl}
              className="py-3 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-syne font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg disabled:opacity-50"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF Plaque / Poster'}</span>
            </button>

            <button
              type="button"
              id="download-qr-png-btn"
              onClick={handleDownloadQrPng}
              disabled={!qrDataUrl}
              className="py-3 px-5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-syne font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>Download QR Image (PNG)</span>
            </button>
          </div>
        </div>
    </UniversalModal>
  );
};
