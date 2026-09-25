import { NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/cn';
import { Wordmark } from '@/components/ui/Wordmark';

const navLink = ({ isActive }: { isActive: boolean }) =>
  cn('rounded-md px-3 py-2 text-sm font-semibold', isActive ? 'bg-ink text-white' : 'text-ink hover:bg-ink/5');

/** Chrome for the non-editor pages. */
export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-panel focus:px-3 focus:py-2">
        Перейти к содержимому
      </a>
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <NavLink to="/" className="rounded-md" aria-label="Brandfolio, на главную">
            <Wordmark />
          </NavLink>
          <nav aria-label="Основная навигация" className="flex items-center gap-1">
            <NavLink to="/projects" className={navLink}>
              Проекты
            </NavLink>
            <NavLink to="/settings" className={navLink}>
              Настройки
            </NavLink>
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
