import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Toast = { id: number; message: string; tone: 'info' | 'error' };
type Api = { notify: (message: string, tone?: Toast['tone']) => void };

const Ctx = createContext<Api>({ notify: () => undefined });

/**
 * Short visual confirmations ("Copied") mirrored into a polite live
 * region, so screen readers hear the result once.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const notify = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 2500);
  }, []);
  return (
    <Ctx.Provider value={{ notify }}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'toast rounded-md px-4 py-2 text-sm font-semibold shadow-sheet',
              t.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-white',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useNotify() {
  return useContext(Ctx).notify;
}
