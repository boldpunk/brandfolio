/**
 * Flat CSS compositions of brand applications. All text and colors come from
 * the view model; empty fields are simply not drawn.
 */
import type { CSSProperties } from 'react';
import { isHttpUrl } from '@/domain/schema';
import { logoForSurface, readableOn, type MockupVM, type SectionVM, type Tokens } from '@/features/brandbook/viewModel';
import { AssetImage, typeCss, type AssetUrls } from './BrandbookHtml';

type Section = Extract<SectionVM, { kind: 'applications' }>;

const MOCKUP_LABELS: Record<MockupVM['kind'], string> = {
  'business-card': 'Визитка, лицевая и оборотная сторона',
  'social-post': 'Публикация для соцсетей',
  'website-hero': 'Первый экран сайта',
  'packaging-label': 'Этикетка упаковки',
};

export function hostOf(url: string): string {
  if (!isHttpUrl(url)) return url;
  return new URL(url).host.replace(/^www\./, '');
}

export function MockupsHtml({ section, tokens, urls }: { section: Section; tokens: Tokens; urls: AssetUrls }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      {section.mockups.map((m) => (
        <figure key={m.kind} style={{ margin: 0, breakInside: 'avoid' }}>
          <Mockup mockup={m} section={section} tokens={tokens} urls={urls} />
          <figcaption style={{ ...typeCss(tokens.type.caption), marginTop: 10 }}>{MOCKUP_LABELS[m.kind]}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function Logo({ section, surface, urls, height }: { section: Section; surface: string; urls: AssetUrls; height: number }) {
  const logo = logoForSurface(surface, section.logo, section.logoOnDark);
  if (!logo) return null;
  return <AssetImage asset={logo} urls={urls} alt="Логотип" style={{ height, maxWidth: height * 4, width: 'auto' }} />;
}

// Long texts make a mockup taller rather than being clipped (nothing is cut off).
const wrap: CSSProperties = { overflowWrap: 'anywhere', whiteSpace: 'pre-line' };

function Mockup({ mockup, section, tokens, urls }: { mockup: MockupVM; section: Section; tokens: Tokens; urls: AssetUrls }) {
  const { background, text, accent } = mockup.colors;
  switch (mockup.kind) {
    case 'business-card': {
      const backFg = readableOn(accent, tokens);
      const card: CSSProperties = { width: 300, minHeight: 167, borderRadius: 6, boxSizing: 'border-box', padding: 20, boxShadow: '0 1px 4px rgb(0 0 0 / 0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
      return (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ ...card, background, color: text, justifyContent: 'center', alignItems: 'center', gap: 10 }}>
            <Logo section={section} surface={background} urls={urls} height={44} />
            {!section.logo && <span style={{ ...typeCss(tokens.type.heading, 0.55), textAlign: 'center', ...wrap }}>{section.brandName}</span>}
          </div>
          <div style={{ ...card, background: accent, color: backFg, justifyContent: 'space-between' }}>
            <div>
              {mockup.personName && <div style={{ ...typeCss(tokens.type.heading, 0.45), ...wrap }}>{mockup.personName}</div>}
              {mockup.personRole && <div style={{ ...typeCss(tokens.type.caption), ...wrap }}>{mockup.personRole}</div>}
            </div>
            <div style={{ ...typeCss(tokens.type.caption), display: 'flex', flexDirection: 'column', gap: 2 }}>
              {mockup.phone && <span style={wrap}>{mockup.phone}</span>}
              {section.contacts.email && <span style={wrap}>{section.contacts.email}</span>}
              {section.contacts.website && <span style={wrap}>{hostOf(section.contacts.website)}</span>}
            </div>
          </div>
        </div>
      );
    }
    case 'social-post':
      return (
        <div style={{ width: 320, minHeight: 320, background, color: text, padding: 28, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 1px 4px rgb(0 0 0 / 0.18)', overflow: 'hidden' }}>
          <div style={{ width: 48, height: 6, background: accent }} />
          <div>
            {mockup.headline && <div style={{ ...typeCss(tokens.type.heading, 0.8), ...wrap }}>{mockup.headline}</div>}
            {mockup.caption && <div style={{ ...typeCss(tokens.type.body), marginTop: 10, ...wrap }}>{mockup.caption}</div>}
          </div>
          <Logo section={section} surface={background} urls={urls} height={28} />
        </div>
      );
    case 'website-hero': {
      const ctaFg = readableOn(accent, tokens);
      return (
        <div style={{ width: '100%', maxWidth: 634, border: '1px solid #C9C6BE', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgb(0 0 0 / 0.12)' }}>
          <div style={{ height: 28, background: '#E9E7E1', display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px' }} aria-hidden>
            <span style={{ width: 9, height: 9, borderRadius: 9, background: '#C9C6BE' }} />
            <span style={{ width: 9, height: 9, borderRadius: 9, background: '#C9C6BE' }} />
            <span style={{ width: 9, height: 9, borderRadius: 9, background: '#C9C6BE' }} />
            {section.contacts.website && <span style={{ marginLeft: 12, fontFamily: "'BF Noto Sans'", fontSize: 11, color: '#62615B' }}>{hostOf(section.contacts.website)}</span>}
          </div>
          <div style={{ background, color: text, padding: '20px 32px 40px', minHeight: 280, boxSizing: 'border-box' }}>
            <Logo section={section} surface={background} urls={urls} height={26} />
            <div style={{ maxWidth: '78%', marginTop: 48 }}>
              {mockup.headline && <div style={{ ...typeCss(tokens.type.heading, 0.95), ...wrap }}>{mockup.headline}</div>}
              {mockup.subheadline && <div style={{ ...typeCss(tokens.type.body), marginTop: 12, ...wrap }}>{mockup.subheadline}</div>}
              {mockup.ctaLabel && (
                <span style={{ display: 'inline-block', marginTop: 20, background: accent, color: ctaFg, padding: '10px 18px', borderRadius: 4, ...typeCss(tokens.type.body), fontWeight: 700 }}>
                  {mockup.ctaLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }
    case 'packaging-label':
      return (
        <div style={{ width: 340, minHeight: 220, background, color: text, borderRadius: 14, boxSizing: 'border-box', border: `6px solid ${accent}`, padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', boxShadow: '0 1px 4px rgb(0 0 0 / 0.18)' }}>
          <Logo section={section} surface={background} urls={urls} height={24} />
          <div>
            {mockup.productName && <div style={{ ...typeCss(tokens.type.heading, 0.7), ...wrap }}>{mockup.productName}</div>}
            {mockup.descriptor && <div style={{ ...typeCss(tokens.type.body), marginTop: 6, ...wrap }}>{mockup.descriptor}</div>}
          </div>
          {mockup.netContent && <div style={{ ...typeCss(tokens.type.caption), alignSelf: 'flex-end', borderTop: `2px solid ${accent}`, paddingTop: 4 }}>{mockup.netContent}</div>}
        </div>
      );
  }
}
