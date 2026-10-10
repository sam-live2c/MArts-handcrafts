import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { CustomizationFile } from '../types';
import { uploadCustomizationMedia } from '../services/dbService';

interface CustomizationModalProps {
  isOpen: boolean;
  itemId: string | null;
  initialFiles?: CustomizationFile[];
  onClose: () => void;
  onConfirm: (itemId: string, files: CustomizationFile[]) => void;
}

export const CustomizationModal: React.FC<CustomizationModalProps> = ({
  isOpen,
  itemId,
  initialFiles = [],
  onClose,
  onConfirm
}) => {
  const [modalFiles, setModalFiles] = useState<CustomizationFile[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialFiles && initialFiles.length > 0) {
        setModalFiles([...initialFiles]);
        setTermsAccepted(true);
      } else {
        setModalFiles([]);
        setTermsAccepted(false);
      }
      setErrorMessage(null);
    }
  }, [isOpen, initialFiles]);

  if (!isOpen || !itemId) return null;

  const handleFiles = (files: FileList | File[]) => {
    setErrorMessage(null);
    const remainingSlots = 3 - modalFiles.length;
    if (remainingSlots <= 0) return;

    const fileList: File[] = [];
    for (let i = 0; i < files.length && i < remainingSlots; i++) {
      const f = files[i];
      if (f) fileList.push(f);
    }

    fileList.forEach((file) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|svg)$/i.test(file.name);

      if (!isPdf && !isImage) {
        setErrorMessage('Only PDF, JPG, or PNG files are supported.');
        return;
      }

      const formattedSize = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setModalFiles((prev) => {
          if (prev.length >= 3) return prev;
          return [
            ...prev,
            {
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              name: file.name,
              size: formattedSize,
              type: isPdf ? 'pdf' : 'image',
              previewUrl: dataUrl,
              rawFile: file
            }
          ];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    if (e.target) e.target.value = '';
  };

  const removeFile = (idx: number) => {
    setModalFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = async () => {
    if (modalFiles.length < 1 || !termsAccepted || !itemId) return;

    // Immediately trigger onConfirm with current files (instant UX)
    const currentFiles = [...modalFiles];
    onConfirm(itemId, currentFiles);
    onClose();

    // Asynchronously upload to Firebase Storage in background
    try {
      const updatedFiles = await Promise.all(
        currentFiles.map(async (f) => {
          if (f.rawFile) {
            try {
              const downloadUrl = await uploadCustomizationMedia(itemId, f.rawFile, f.name);
              return {
                ...f,
                storageUrl: downloadUrl || f.previewUrl
              };
            } catch (err) {
              console.warn('Storage upload note:', err);
              return f;
            }
          }
          return f;
        })
      );
      onConfirm(itemId, updatedFiles);
    } catch (e) {
      console.warn('Customization media background upload notice:', e);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[300] flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="customization-modal-container"
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Specifically dedicated for Upload and Customization */}
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between bg-white">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 mt-0.5 p-1.5 shadow-2xs">
              {/* Website Melody 'm' Logo Icon */}
              <svg
                viewBox="0 0 86 70"
                className="h-full w-auto aspect-[86/70]"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Website 'm' logo"
              >
                <g strokeWidth="13.5" strokeLinecap="round" strokeLinejoin="round">
                  {/* Blue: Lower Left Stem */}
                  <path d="M 16 56 L 16 34" stroke="#4285F4" />
                  {/* Yellow: Top-Left Arch */}
                  <path d="M 16 34 C 16 16, 43 16, 43 34" stroke="#FBBC05" />
                  {/* Red: Center Stem & Top-Right Arch */}
                  <path d="M 43 56 L 43 34 C 43 16, 70 16, 70 34" stroke="#EA4335" />
                  {/* Green: Lower Right Stem */}
                  <path d="M 70 34 L 70 56" stroke="#34A853" />
                </g>
              </svg>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                Upload & Customization
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 leading-normal">
                Upload your business logo, custom QR code, or vector artwork for customized storefront hardware fabrication
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer shrink-0 -mr-1"
            aria-label="Close popup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 bg-white overflow-y-auto max-h-[75vh]">
          {errorMessage && (
            <div className="mb-3 px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {errorMessage}
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            multiple
            className="hidden"
            onClick={(e) => e.stopPropagation()}
            onChange={handleFileUpload}
          />

          {/* 3 Upload Slots placed side-by-side in the middle */}
          <div
            className="grid grid-cols-3 gap-3 sm:gap-4 my-2"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFiles(e.dataTransfer.files);
              }
            }}
          >
            {[0, 1, 2].map((slotIdx) => {
              const file = modalFiles[slotIdx];
              const isNextUploadSlot = slotIdx === modalFiles.length && modalFiles.length < 3;

              if (file) {
                return (
                  <div
                    key={file.id}
                    className="relative aspect-square rounded-xl border border-gray-200 bg-gray-50 flex flex-col items-center justify-center p-2 overflow-hidden shadow-2xs group"
                  >
                    {file.type === 'image' ? (
                      <img
                        src={file.previewUrl}
                        alt={file.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-center p-1">
                        <FileText size={28} className="text-red-500 mb-1" />
                        <span className="text-[10px] font-bold text-red-600 tracking-wider">PDF</span>
                        <span className="text-[11px] font-medium text-gray-800 line-clamp-1 truncate w-full px-0.5 mt-0.5">
                          {file.name}
                        </span>
                        <span className="text-[9px] text-gray-400 mt-0.5">{file.size}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeFile(slotIdx);
                      }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-gray-900/85 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors cursor-pointer"
                      title="Remove file"
                      aria-label="Remove file"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                );
              }

              if (isNextUploadSlot) {
                return (
                  <button
                    key={`slot-${slotIdx}`}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleFiles(e.dataTransfer.files);
                      }
                    }}
                    className="aspect-square rounded-xl border-2 border-dashed border-blue-400 hover:border-blue-600 bg-blue-50/40 hover:bg-blue-50/80 flex flex-col items-center justify-center p-2 text-center transition-all cursor-pointer group"
                  >
                    <Upload size={24} className="text-blue-600 group-hover:scale-110 transition-transform mb-1.5" />
                    <span className="text-xs font-bold text-blue-700 leading-tight">Upload</span>
                    <span className="text-[10px] text-gray-500 mt-0.5">PDF or JPG</span>
                  </button>
                );
              }

              return (
                <div
                  key={`slot-${slotIdx}`}
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 flex flex-col items-center justify-center p-2 text-center text-gray-300"
                >
                  <Upload size={20} className="text-gray-300 mb-1" />
                  <span className="text-[11px] font-medium text-gray-400">Slot {slotIdx + 1}</span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-gray-400 text-center mb-4">
            Maximum 3 files side by side • Minimum 1 file required
          </p>

          {/* Bullet Points Instructions */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 mb-4">
            <ul className="space-y-1.5 text-xs text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Upload your business logo, custom QR code, or vector artwork in PDF or JPG format.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Minimum 1 file required to proceed with personalized stand fabrication.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Our design specialists will optimize your artwork for ultra-durable UV printing.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>We will contact you on WhatsApp to confirm your design preview before printing.</span>
              </li>
            </ul>
          </div>

          {/* Privacy Policy & Terms and Conditions Checkbox */}
          <label className="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer select-none mb-5">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="leading-snug">
              I agree to the{' '}
              <a
                href="#/terms-and-conditions"
                target="_blank"
                rel="noreferrer"
                className="text-[#1A73E8] hover:underline font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                Terms &amp; Conditions
              </a>{' '}
              and{' '}
              <a
                href="#/privacy-policy"
                target="_blank"
                rel="noreferrer"
                className="text-[#1A73E8] hover:underline font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                Privacy Policy
              </a>{' '}
              for customized hardware fabrication and UV printing.
            </span>
          </label>

          {/* Bottom Right Confirm Button */}
          <div className="flex justify-end pt-3 border-t border-gray-100">
            <button
              type="button"
              disabled={modalFiles.length < 1 || !termsAccepted}
              onClick={handleConfirm}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer ${
                modalFiles.length >= 1 && termsAccepted
                  ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-98'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Confirm Customization
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomizationModal;
