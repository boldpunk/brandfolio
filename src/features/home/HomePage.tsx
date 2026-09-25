import { ArrowRight, BookOpen, Check, ChevronDown, Image, MessageSquareQuote, Palette, PenTool, Shapes, Type } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { openOrCreateDemo } from '@/features/demo/formaDemo';
import { getLocale, useMessages } from '@/i18n/core';
import { homeMessages } from '@/i18n/messages/home';
import { useReveal } from '@/lib/useReveal';
import { TEMPLATE_INFO, useTemplateDescriptions } from '@/templates/templateInfo';
import { track } from '@/lib/analytics';
import { ProBadge } from '@/components/ui/ProBadge';

const EX = `${import.meta.env.BASE_URL}examples/`;

const COVERS: Record<string, string> = {
  editorial: EX + 'editorial-p1.jpg',
  studio: EX + 'studio-p1.jpg',
  contrast: EX + 'contrast-p1.jpg',
  noir: EX + 'noir-p1.jpg',
  swiss: EX + 'swiss-p1.jpg',
  soft: EX + 'soft-p1.jpg',
};

/** Icons for the "what goes inside" cards, in the order of homeMessages.inside. */
const INSIDE_ICONS = [PenTool, Palette, Type, MessageSquareQuote, Image, Shapes];

function Sheet({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <img src={src} alt={alt} width={909} height={1286} loading="lazy" className={`block h-auto w-full rounded-sm bg-panel shadow-sheet ${className ?? ''}`} />;
}

const primaryCta =
  'group inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 font-semibold text-ink transition-[filter,scale] hover:brightness-95 active:scale-[0.98]';

export default function HomePage() {
  const m = useMessages(homeMessages);
  const descriptions = useTemplateDescriptions();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);

  async function openDemo() {
    setBusy(true);
    setError(null);
    try {
      const id = await openOrCreateDemo(getLocale());
      track('demo_opened', { from: 'home' });
      navigate(`/editor/${id}`);
    } catch (e) {
      setError(m.demoError(e instanceof Error ? e.message : String(e)));
      setBusy(false);
    }
  }

  const ctas = (
    <div className="flex flex-wrap gap-3">
      <Link to="/projects?create=1" className={primaryCta}>
        {m.create} <ArrowRight size={18} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
      </Link>
      <Button icon={<BookOpen size={18} />} onClick={() => void openDemo()} disabled={busy} className="h-11">
        {busy ? m.opening : m.openDemo}
      </Button>
    </div>
  );

  return (
    <div ref={root} className="mx-auto max-w-6xl px-4 sm:px-6">
      <section aria-labelledby="hero-h" className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="animate-rise">
          <p className="font-mono text-xs tracking-wide text-muted uppercase">{m.eyebrow}</p>
          <h1 id="hero-h" className="mt-4 text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl">
            {m.title}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">{m.lead}</p>
          <div className="mt-8">{ctas}</div>
          {error && (
            <p role="alert" className="mt-3 text-sm font-semibold text-danger">
              {error}
            </p>
          )}
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            {m.badges.map((badge) => (
              <li key={badge} className="inline-flex items-center gap-1.5">
                <Check size={16} aria-hidden className="text-success" />
                {badge}
              </li>
            ))}
          </ul>
        </div>
        <figure className="m-0">
          <div className="hero-desk relative grid grid-cols-2 gap-3 overflow-hidden rounded-lg bg-desk p-4 sm:gap-4 sm:p-6">
            <Sheet src={EX + 'editorial-p1.jpg'} alt={m.heroAltCover} className="animate-sheet-left" />
            <Sheet src={EX + 'editorial-p5.jpg'} alt={m.heroAltColors} className="animate-sheet-right" />
          </div>
          <figcaption className="mt-3 text-xs text-muted">{m.heroCaption}</figcaption>
        </figure>
      </section>

      <section aria-labelledby="inside-h" className="border-t border-line py-12 sm:py-16">
        <div data-reveal>
          <h2 id="inside-h" className="text-2xl font-bold sm:text-3xl">
            {m.insideTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-muted">{m.insideLead}</p>
        </div>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {m.inside.map((item, i) => {
            const Icon = INSIDE_ICONS[i] ?? Shapes;
            return (
              <li
                key={item.title}
                data-reveal
                style={{ transitionDelay: `${(i % 3) * 60}ms` }}
                className="rounded-lg border border-line bg-panel p-5 transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-panel"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-md bg-accent text-ink">
                  <Icon size={20} aria-hidden />
                </span>
                <h3 className="mt-4 font-bold">{item.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{item.text}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="steps-h" className="border-t border-line py-12 sm:py-16">
        <h2 id="steps-h" data-reveal className="text-2xl font-bold sm:text-3xl">
          {m.stepsTitle}
        </h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {m.steps.map((step, i) => (
            <li key={step.title} data-reveal style={{ transitionDelay: `${i * 80}ms` }} className="border-t-2 border-ink pt-4">
              <span className="font-mono text-sm text-muted">0{i + 1}</span>
              <h3 className="mt-2 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
        <figure data-reveal className="mt-10">
          <img src={EX + 'editor.jpg'} alt={m.editorAlt} width={1440} height={900} loading="lazy" className="block h-auto w-full rounded-lg border border-line shadow-panel" />
          <figcaption className="mt-3 text-xs text-muted">{m.editorCaption}</figcaption>
        </figure>
      </section>

      <section aria-labelledby="tpl-h" className="border-t border-line py-12 sm:py-16">
        <div data-reveal>
          <h2 id="tpl-h" className="text-2xl font-bold sm:text-3xl">
            {m.templatesTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-muted">{m.templatesLead}</p>
        </div>
        <ul className="mt-8 grid gap-6 sm:grid-cols-3">
          {TEMPLATE_INFO.map((info, i) => (
            <li key={info.id} data-reveal style={{ transitionDelay: `${i * 80}ms` }} className="group">
              <div className="overflow-hidden rounded-sm">
                <Sheet src={COVERS[info.id] ?? ''} alt={m.templateAlt(info.name)} className="transition-[scale] duration-500 group-hover:scale-[1.02]" />
              </div>
              <h3 className="mt-4 flex items-center gap-2 font-bold">
                {info.name}
                {info.premium && <ProBadge />}
              </h3>
              <p className="mt-1 text-sm text-muted">{descriptions[info.id]}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="aud-h" className="border-t border-line py-12 sm:py-16">
        <h2 id="aud-h" data-reveal className="text-2xl font-bold sm:text-3xl">
          {m.audienceTitle}
        </h2>
        <ul className="mt-8 grid gap-8 md:grid-cols-3">
          {m.audience.map((item, i) => (
            <li key={item.title} data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <h3 className="text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-muted">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="faq-h" className="border-t border-line py-12 sm:py-16">
        <h2 id="faq-h" data-reveal className="text-2xl font-bold sm:text-3xl">
          {m.faqTitle}
        </h2>
        <div className="mt-8 divide-y divide-line border-y border-line">
          {m.faq.map((item) => (
            <details key={item.q} data-reveal className="faq group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-4 font-bold [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown size={20} aria-hidden className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="max-w-3xl pb-5 text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="cta-h" data-reveal className="mb-12 overflow-hidden rounded-lg bg-ink px-6 py-10 text-white sm:px-10 sm:py-14">
        <h2 id="cta-h" className="max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {m.ctaTitle}
        </h2>
        <p className="mt-3 max-w-xl text-white/75">{m.ctaText}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/projects?create=1" className={primaryCta}>
            {m.create} <ArrowRight size={18} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <button
            type="button"
            onClick={() => void openDemo()}
            disabled={busy}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-white/40 px-5 font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <BookOpen size={18} aria-hidden />
            {busy ? m.opening : m.openDemo}
          </button>
        </div>
      </section>

      <footer className="flex flex-wrap justify-between gap-3 border-t border-line py-8 text-sm text-muted">
        <span>{m.footerNote}</span>
        <span>{m.footerFonts}</span>
      </footer>
    </div>
  );
}
