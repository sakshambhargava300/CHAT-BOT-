import {
  FileText,
  Globe,
  Mic,
  MicOff,
  Paperclip,
  Send,
  Square,
  X,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import type { Attachment } from '../types/app';

interface ComposerInputProps {
  value: string;
  onChange: (value: string) => void;
  attachments: Attachment[];
  onAddAttachments: (files: Attachment[]) => void;
  onRemoveAttachment: (id: string) => void;
  webSearch: boolean;
  onToggleWebSearch: () => void;
  onSubmit: () => void;
  onStop?: () => void;
  isStreaming?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  variant?: 'hero' | 'chat';
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
}

function readFileAsAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const isText =
      file.type.startsWith('text/') ||
      file.type === 'application/json' ||
      /\.(md|ts|tsx|js|jsx|py|csv|json|txt|log)$/i.test(file.name);

    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : '';
      if (isText) {
        const textReader = new FileReader();
        textReader.onload = () => {
          resolve({
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            mimeType: file.type || 'text/plain',
            size: file.size,
            dataBase64: base64,
            textPreview: String(textReader.result || ''),
          });
        };
        textReader.readAsText(file);
      } else {
        resolve({
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          dataBase64: base64,
        });
      }
    };
    reader.readAsDataURL(file);
  });
}

export function ComposerInput({
  value,
  onChange,
  attachments,
  onAddAttachments,
  onRemoveAttachment,
  webSearch,
  onToggleWebSearch,
  onSubmit,
  onStop,
  isStreaming = false,
  placeholder = 'Transmit a query across the gate...',
  autoFocus = false,
  variant = 'chat',
  inputRef: externalInputRef,
  fileInputRef: externalFileInputRef,
}: ComposerInputProps) {
  const internalInputRef = useRef<HTMLTextAreaElement | null>(null);
  const internalFileRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = externalInputRef ?? internalInputRef;
  const fileRef = externalFileInputRef ?? internalFileRef;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    try {
      const parsed = await Promise.all(Array.from(fileList).slice(0, 5).map(readFileAsAttachment));
      onAddAttachments(parsed);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Unable to attach file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && (value.trim() || attachments.length > 0)) {
        onSubmit();
      }
    }
  };

  const handleVoiceToggle = async () => {
    setVoiceError(null);

    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError('Microphone capture is unavailable in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 100) return;

        setIsTranscribing(true);
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Failed to encode audio'));
            reader.onload = () => {
              const s = String(reader.result || '');
              resolve(s.includes(',') ? s.split(',')[1] : '');
            };
            reader.readAsDataURL(blob);
          });

          const resp = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dataBase64: base64,
              mimeType: blob.type || 'audio/webm',
            }),
          });
          const data = (await resp.json()) as { text?: string; error?: string };
          if (!resp.ok) {
            throw new Error(data.error || 'Transcription failed.');
          }
          if (data.text) {
            onChange(value ? `${value.trimEnd()} ${data.text}` : data.text);
          }
        } catch (err) {
          setVoiceError(err instanceof Error ? err.message : 'Transcription error.');
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setVoiceError('Microphone permission denied or no audio device detected.');
    }
  };

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !isStreaming;

  return (
    <div
      className={`w-full rounded-xl border transition-colors ${
        variant === 'hero'
          ? 'border-[#E50914]/35 bg-[#0F0A0C]/90 shadow-[0_0_45px_rgba(229,9,20,0.12)] focus-within:border-[#E50914]/75'
          : 'border-white/14 bg-[#100D0F]/95 focus-within:border-[#E50914]/65'
      } p-3 sm:p-4`}
    >
      {/* Attachment Chips */}
      {attachments.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 rounded-md border border-white/12 bg-[#1A1013] px-2.5 py-1.5 text-xs text-zinc-200"
            >
              {att.mimeType.startsWith('image/') && att.dataBase64 ? (
                <img
                  src={`data:${att.mimeType};base64,${att.dataBase64}`}
                  alt={att.name}
                  className="h-5 w-5 rounded object-cover"
                />
              ) : (
                <FileText className="h-3.5 w-3.5 text-[#FF5C66]" />
              )}
              <span className="max-w-[160px] truncate">{att.name}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(att.id)}
                aria-label={`Remove ${att.name}`}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <label htmlFor={`composer-textarea-${variant}`} className="sr-only">
        Message input
      </label>
      <textarea
        id={`composer-textarea-${variant}`}
        ref={textareaRef}
        rows={variant === 'hero' ? 3 : 2}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
      />

      {voiceError && (
        <p className="mt-1.5 text-xs text-amber-400" role="status">
          {voiceError}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-2.5">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".txt,.md,.csv,.json,.ts,.tsx,.js,.py,.pdf,image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach documents or images"
            title="Attach documents, code, PDFs, or images"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/10 bg-[#161013] px-2.5 text-xs font-medium whitespace-nowrap text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
          >
            <Paperclip className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Attach</span>
          </button>

          <button
            type="button"
            onClick={onToggleWebSearch}
            aria-pressed={webSearch}
            aria-label="Toggle Google Search grounding"
            className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
              webSearch
                ? 'border-[#E50914]/70 bg-[#240A0D] text-[#FF7A82]'
                : 'border-white/10 bg-[#161013] text-zinc-300 hover:border-white/25 hover:text-white'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Web Search</span>
          </button>

          <button
            type="button"
            onClick={handleVoiceToggle}
            disabled={isTranscribing}
            aria-label={isRecording ? 'Stop voice recording' : 'Start voice dictation'}
            className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
              isRecording
                ? 'border-[#E50914] bg-[#E50914]/20 text-[#FF6B73]'
                : 'border-white/10 bg-[#161013] text-zinc-300 hover:border-white/25 hover:text-white'
            }`}
          >
            {isRecording ? (
              <>
                <MicOff className="h-3.5 w-3.5" />
                <span>Stop Mic</span>
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {isTranscribing ? 'Transcribing...' : 'Voice'}
                </span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isStreaming && onStop ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop response generation"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E50914]/70 bg-[#240A0D] px-4 text-xs font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#3A0E14]"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSend}
              aria-label="Send message"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#E50914] px-4 text-xs font-semibold whitespace-nowrap text-white transition-all hover:bg-[#FF1A26] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Transmit</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
