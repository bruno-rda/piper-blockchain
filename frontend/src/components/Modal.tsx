import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Set to true to prevent closing on overlay click (e.g. during destructive actions) */
  preventClose?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | (string & {});
}

export function Modal({ open, onClose, children, preventClose = false, maxWidth = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap: focus the panel when opened
  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
  }, [open]);

  // Escape key closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !preventClose) {
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, preventClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => {
        if (!preventClose) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`bg-[#202020] rounded-[2rem] p-8 max-w-${maxWidth} w-full outline-none shadow-[0_20px_50px_rgba(0,0,0,0.6)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
