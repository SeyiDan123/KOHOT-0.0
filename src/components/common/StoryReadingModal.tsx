import React from 'react';
import { X, BookOpen } from 'lucide-react';
import { parseStoryBlocks } from '../../utils/storyFormatting';

export interface StoryReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  authorName: string;
  authorRole?: string;
  authorPhoto?: string;
  storyText: string;
  sectionLabel?: string;
  isDark?: boolean;
}

export const StoryReadingModal: React.FC<StoryReadingModalProps> = ({
  isOpen,
  onClose,
  authorName,
  authorRole,
  authorPhoto,
  storyText,
  sectionLabel,
  isDark = true,
}) => {
  if (!isOpen) return null;

  const blocks = parseStoryBlocks(storyText);
  const roleDisplay = (authorRole || '').trim() || 'Class Member';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Story by ${authorName}`}
      className="fixed inset-0 z-[140] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      <div
        className={`relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-colors ${
          isDark
            ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
            : 'bg-[#FAF8F5] border-stone-200 text-stone-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Author Info & Close button */}
        <div
          className={`flex items-center justify-between gap-4 px-5 sm:px-7 py-4 border-b shrink-0 ${
            isDark ? 'border-zinc-800 bg-zinc-900/95' : 'border-stone-200/80 bg-white/90'
          }`}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            {authorPhoto ? (
              <img
                src={authorPhoto}
                alt={authorName}
                className={`w-12 h-12 rounded-full object-cover shrink-0 border ${
                  isDark ? 'border-amber-500/30 bg-zinc-800' : 'border-amber-700/20 bg-stone-100'
                }`}
              />
            ) : (
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-serif font-bold text-lg border ${
                  isDark
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-amber-50 border-amber-700/20 text-amber-800'
                }`}
              >
                {authorName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              {sectionLabel && (
                <p
                  className={`text-[11px] font-bold uppercase tracking-wider mb-0.5 truncate ${
                    isDark ? 'text-amber-400/90' : 'text-amber-800'
                  }`}
                >
                  {sectionLabel}
                </p>
              )}
              <h3
                className={`font-serif text-lg sm:text-xl font-bold truncate ${
                  isDark ? 'text-white' : 'text-stone-900'
                }`}
              >
                {authorName}
              </h3>
              <p
                className={`text-xs sm:text-sm truncate ${
                  isDark ? 'text-zinc-400' : 'text-stone-600'
                }`}
              >
                {roleDisplay}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close reading view"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors shrink-0 ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
            }`}
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        {/* Scrollable Story Body with comfortable line length */}
        <div
          data-modal-scrollable="true"
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-6 sm:px-10 py-6 sm:py-8"
        >
          <div className="max-w-[65ch] mx-auto space-y-4">
            {blocks.length > 0 ? (
              blocks.map((block, idx) => {
                if (block.type === 'heading') {
                  return (
                    <h4
                      key={idx}
                      className={`font-serif text-lg sm:text-xl font-bold pt-2 ${
                        isDark ? 'text-amber-300' : 'text-stone-900'
                      }`}
                    >
                      {block.content}
                    </h4>
                  );
                }
                if (block.type === 'boldClosing') {
                  return (
                    <p
                      key={idx}
                      className={`text-[15px] sm:text-base leading-relaxed font-semibold pt-2 ${
                        isDark ? 'text-white' : 'text-stone-900'
                      }`}
                    >
                      {block.content}
                    </p>
                  );
                }
                return (
                  <p
                    key={idx}
                    className={`text-[15px] sm:text-base leading-[1.8] font-normal ${
                      isDark ? 'text-zinc-200' : 'text-stone-700'
                    }`}
                  >
                    {block.content}
                  </p>
                );
              })
            ) : (
              <p
                className={`text-[15px] sm:text-base leading-[1.8] whitespace-pre-line ${
                  isDark ? 'text-zinc-200' : 'text-stone-700'
                }`}
              >
                {storyText}
              </p>
            )}

            <div
              className={`pt-6 mt-6 border-t flex items-center justify-end text-xs ${
                isDark ? 'border-zinc-800/80 text-zinc-400' : 'border-stone-200 text-stone-500'
              }`}
            >
              <button
                type="button"
                onClick={onClose}
                className={`font-semibold underline underline-offset-4 ${
                  isDark ? 'text-amber-400 hover:text-amber-300' : 'text-amber-800 hover:text-amber-900'
                }`}
              >
                Close reading view
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
