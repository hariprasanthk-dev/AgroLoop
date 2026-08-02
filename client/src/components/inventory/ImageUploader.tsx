import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { uploadApi } from '../../api/upload.api';
import { extractMessage } from '../../utils/helpers';

interface ImageUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input value so re-selecting same file triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setError(null);

    // Client-side validations
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPG, PNG, and WebP images are allowed.');
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setError(`File size exceeds limit of ${MAX_SIZE_MB}MB.`);
      return;
    }

    setUploading(true);

    try {
      const res = await uploadApi.uploadImage(file);
      const uploadedUrl = res.data.data?.url;
      if (uploadedUrl) {
        onChange(uploadedUrl);
      } else {
        throw new Error('No URL returned from upload server.');
      }
    } catch (err: unknown) {
      const msg = extractMessage(err, 'Failed to upload image');
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onChange('');
    setError(null);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs text-slate-400 font-medium mb-1">
        Batch Image Upload
      </label>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={disabled || uploading}
        id="inventory-image-input"
      />

      {value ? (
        /* Image Preview State */
        <div className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-900/50">
          <img
            src={value}
            alt="Batch preview"
            className="w-full h-40 object-cover rounded-xl"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              <Upload className="w-3.5 h-3.5" /> Replace
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled || uploading}
              className="btn-danger text-xs py-1.5 px-3"
            >
              <X className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        </div>
      ) : (
        /* Upload Drag / Click Zone */
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className={`w-full h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-4 transition-all ${
            uploading
              ? 'border-emerald-500/50 bg-emerald-500/5 cursor-wait'
              : 'border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800/40 cursor-pointer'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              <p className="text-xs text-emerald-400 font-medium">Uploading to Cloudinary…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-0.5">
                <ImageIcon className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-slate-300">
                Click to upload batch image
              </p>
              <p className="text-[11px] text-slate-500">
                JPG, PNG, or WebP up to {MAX_SIZE_MB}MB
              </p>
            </div>
          )}
        </button>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
