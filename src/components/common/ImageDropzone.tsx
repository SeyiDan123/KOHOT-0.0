import React, { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, Sparkles, Sliders, CheckCircle2 } from 'lucide-react';
import { compressImageToWebP, CompressionResult, fileToUniversalDataUrl } from '../../utils/imageCompressor';
import { ImageCropModal, CropAspectRatio } from './ImageCropModal';

interface ImageDropzoneProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  helperText?: string;
  aspectRatio?: '1:1' | '16:9' | 'banner' | 'portrait' | 'auto';
  maxDimension?: number;
  required?: boolean;
  className?: string;
  placeholderText?: string;
}

export const ImageDropzone: React.FC<ImageDropzoneProps> = ({
  value,
  onChange,
  label,
  helperText,
  aspectRatio = 'auto',
  maxDimension = 1200,
  required = false,
  className = '',
  placeholderText = 'Drag & drop image here, or click to browse',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<CompressionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cropping State
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>('');

  // Map aspect ratio to CropModal ratio
  const getCropAspectRatio = (): CropAspectRatio => {
    switch (aspectRatio) {
      case '1:1':
        return '1:1';
      case 'portrait':
        return '4:5';
      case '16:9':
        return '16:9';
      case 'banner':
        return '21:9';
      default:
        return 'free';
    }
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);
    try {
      setIsProcessing(true);
      const dataUrl = await fileToUniversalDataUrl(file);
      if (dataUrl) {
        setImageToCrop(dataUrl);
        setIsCropModalOpen(true);
      } else {
        setErrorMessage('Could not load this gallery photo. Please try another.');
      }
    } catch (err) {
      console.error('Error processing gallery image:', err);
      setErrorMessage('Could not load this gallery photo. Please try another.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyCrop = async (croppedDataUrl: string) => {
    try {
      setIsProcessing(true);
      onChange(croppedDataUrl);
      // Optional background calculation for dataset tracking without blocking
      compressImageToWebP(croppedDataUrl, maxDimension, 0.88)
        .then((res) => {
          setStats(res);
          onChange(res.dataUrl);
        })
        .catch(() => {
          // Keep croppedDataUrl
        });
    } catch (err) {
      console.error('Cropped image processing fallback', err);
      onChange(croppedDataUrl);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenExistingCrop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value) {
      setImageToCrop(value);
      setIsCropModalOpen(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setStats(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Determine aspect ratio class
  const getAspectClass = () => {
    switch (aspectRatio) {
      case '1:1':
        return 'aspect-square max-h-40';
      case '16:9':
        return 'aspect-[16/9] max-h-56';
      case 'banner':
        return 'aspect-[21/9] max-h-48 sm:max-h-56';
      case 'portrait':
        return 'aspect-[4/5] max-h-52';
      default:
        return 'min-h-[120px] max-h-52';
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-bold">
            {label} {required && <span className="text-amber-400">*</span>}
          </label>
          <span className="text-[9px] font-mono-tech uppercase text-zinc-400 bg-white/5 px-2 py-0.5 rounded flex items-center gap-1">
            <Sliders className="w-2.5 h-2.5 text-[#d4af37]" />
            <span>Croppable &amp; Scalable</span>
          </span>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif,.avif,.webp,.png,.jpg,.jpeg,.jfif,.bmp,.gif"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Dropzone Container */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative w-full ${getAspectClass()} rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden flex flex-col items-center justify-center text-center p-4 select-none group ${
          isDragging
            ? 'border-[#d4af37] bg-[#d4af37]/15 scale-[1.01]'
            : value
            ? 'border-white/20 bg-black/60 hover:border-[#d4af37]/50'
            : 'border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]'
        }`}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center space-y-2 py-4">
            <Loader2 className="w-6 h-6 text-[#d4af37] animate-spin" />
            <span className="text-xs font-mono-tech text-white">Optimizing Framed Image...</span>
          </div>
        ) : value ? (
          <>
            <img
              src={value}
              alt="Uploaded Preview"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/50 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleOpenExistingCrop}
                  className="px-2.5 py-1 rounded-full bg-black/80 hover:bg-[#d4af37] text-white hover:text-black transition-colors cursor-pointer border border-white/20 text-[10px] font-mono-tech uppercase tracking-wider flex items-center gap-1 shadow"
                  title="Crop / Adjust Positioning"
                >
                  <Sliders className="w-3 h-3" />
                  <span>Adjust Framing</span>
                </button>

                <button
                  type="button"
                  onClick={handleRemove}
                  className="p-1.5 rounded-full bg-black/70 hover:bg-red-500/80 text-white transition-colors cursor-pointer border border-white/20"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 text-white text-xs font-mono-tech bg-black/70 backdrop-blur-sm py-1.5 px-3 rounded-full self-center border border-white/20 shadow">
                <Upload className="w-3 h-3 text-[#d4af37]" />
                <span>Replace file</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-2.5 py-4">
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:scale-110 transition-all">
              <Upload className="w-4 h-4 text-[#d4af37]" />
            </div>
            <div className="space-y-0.5">
              <p className="font-mono-tech text-xs text-zinc-200 font-medium">
                {placeholderText}
              </p>
              <p className="font-mono-tech text-[10px] text-zinc-400">
                PNG, JPG, WEBP • Croppable with zoom &amp; positioning
              </p>
            </div>
          </div>
        )}
      </div>

      {stats && (
        <div className="flex items-center text-[10px] font-mono-tech text-emerald-400 px-1">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Photo ready</span>
          </span>
        </div>
      )}

      {errorMessage && (
        <p className="font-mono-tech text-[10px] text-red-400 px-1">{errorMessage}</p>
      )}

      {helperText && !stats && (
        <p className="font-mono-tech text-[10px] text-zinc-500 px-1">{helperText}</p>
      )}

      {/* Embedded Crop & Positioning Modal */}
      <ImageCropModal
        isOpen={isCropModalOpen}
        imageSrc={imageToCrop}
        onClose={() => setIsCropModalOpen(false)}
        onApplyCrop={handleApplyCrop}
        initialAspectRatio={getCropAspectRatio()}
        title={label ? `Adjust Framing: ${label}` : 'Crop & Adjust Positioning'}
        helperText="Pan, zoom, or select aspect ratio to frame the image precisely."
      />
    </div>
  );
};

