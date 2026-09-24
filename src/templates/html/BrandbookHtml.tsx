/**
 * HTML rendering of a BrandbookViewModel for the editor canvas and the
 * full-screen preview. Each section is an A4-wide sheet; long content makes a
 * sheet taller instead of being clipped. The exact paginated result is the
 * PDF preview, not this view.
 */
import type { CSSProperties, ReactNode } from 'react';
import { isHttpUrl } from '@/domain/schema';
import {
  logoForSurface,
  ratioLabel,
  readableOn,
  TYPE_SAMPLE,
  type AssetRef,
  type BrandbookViewModel,
  type ResolvedType,
  type SectionVM,
  type Tokens,
} from '@/features/brandbook/viewModel';
import { contentWidth, fitLogo, PAGE, rowContentWidth, TEMPLATE_STYLES, type TemplateStyle } from '../templateStyle';
import { MockupsHtml } from './MockupsHtml';
import './documentFonts.css';

export type AssetUrls = ReadonlyMap<string, string>;

type Ctx = { vm: BrandbookViewModel; t: TemplateStyle; urls: AssetUrls; tokens: Tokens };

export function typeCss(type: ResolvedType, scale = 1): CSSProperties {
  return {
    fontFamily: `'${type.cssFamily}'`,
    fontWeight: type.weight,
    fontSize: `${Math.round(type.sizePx * scale * 10) / 10}px`,
    lineHeight: type.lineHeight,
    letterSpacing: `${type.trackingEm}em`,
  };
}

const textBlock: CSSProperties = { whiteSpace: 'pre-line', overflowWrap: 'anywhere', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0 };

export function AssetImage({ asset, urls, style, alt }: { asset: AssetRef; urls: AssetUrls; style?: CSSProperties; alt: string }) {
  const url = urls.get(asset.id);
  if (!url) return <span style={{ display: 'inline-block', aspectRatio: `${asset.width} / ${asset.height}`, ...style }} aria-hidden />;
  return <img src={url} alt={alt} style={{ objectFit: 'contain', display: 'block', ...style }} />;
}

export function BrandbookHtml({ vm, urls, only }: { vm: BrandbookViewModel; urls: AssetUrls; only?: SectionVM['kind'] }) {
  const ctx: Ctx = { vm, t: TEMPLATE_STYLES[vm.templateId], urls, tokens: vm.tokens };
  const sections = only ? vm.sections.filter((s) => s.kind === only) : vm.sections;
  return (
    <div className="bf-document" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {sections.map((section) => (
        <Sheet key={section.kind} ctx={ctx} section={section} />
      ))}
    </div>
  );
}

function Sheet({ ctx, section }: { ctx: Ctx; section: SectionVM }) {
  const { t, tokens } = ctx;
  const isCover = section.kind === 'cover';
  const style: CSSProperties = {
    width: PAGE.width,
    minHeight: PAGE.height,
    background: tokens.background,
    color: tokens.text,
    position: 'relative',
    boxSizing: 'border-box',
    padding: isCover ? 0 : `${t.margin.top}px ${t.margin.right}px ${t.margin.bottom}px ${t.margin.left}px`,
    ...typeCss(tokens.type.body),
    boxShadow: '0 1px 3px rgb(25 25 25 / 0.08), 0 12px 32px rgb(25 25 25 / 0.1)',
    flexShrink: 0,
  };
  return (
    <article style={style} aria-label={section.title} data-section={section.kind}>
      {isCover ? (
        <Cover ctx={ctx} section={section as Extract<SectionVM, { kind: 'cover' }>} />
      ) : (
        <>
          {t.running && <RunningHeader ctx={ctx} section={section} />}
          <Opener ctx={ctx} section={section} />
          <SectionBody ctx={ctx} section={section} />
        </>
      )}
    </article>
  );
}

function RunningHeader({ ctx, section }: { ctx: Ctx; section: SectionVM }) {
  const { t, tokens, vm } = ctx;
  return (
    <div
      style={{
        position: 'absolute',
        top: 32,
        left: t.margin.left,
        right: t.margin.right,
        display: 'flex',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${tokens.text}`,
        paddingBottom: 8,
        ...typeCss(tokens.type.caption),
      }}
    >
      <span>{vm.documentTitle}</span>
      <span>
        {String(section.number).padStart(2, '0')} · {section.title}
      </span>
    </div>
  );
}

function Opener({ ctx, section }: { ctx: Ctx; section: SectionVM }) {
  const { t, tokens } = ctx;
  const number = String(section.number).padStart(2, '0');
  const heading = typeCss(tokens.type.heading, t.headingScale);
  if (t.opener === 'field') {
    const fg = readableOn(tokens.primary, tokens);
    return (
      <header
        style={{
          margin: `-${t.margin.top}px -${t.margin.right}px 48px -${t.margin.left}px`,
          padding: `${t.margin.top}px ${t.margin.right}px 40px ${t.margin.left}px`,
          minHeight: 280,
          background: tokens.primary,
          color: fg,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ ...typeCss(tokens.type.heading, 3.2), lineHeight: 1 }}>{number}</span>
        <h2 style={{ ...heading, margin: 0, overflowWrap: 'anywhere' }}>{section.title}</h2>
      </header>
    );
  }
  if (t.opener === 'rail') {
    return (
      <header style={{ display: 'grid', gridTemplateColumns: `${t.labelColumn * 100}% 1fr`, alignItems: 'end', borderBottom: `2px solid ${tokens.text}`, paddingBottom: 16, marginBottom: 40 }}>
        <span style={{ ...typeCss(tokens.type.caption), textTransform: 'uppercase' }}>Раздел {number}</span>
        <h2 style={{ ...heading, margin: 0, overflowWrap: 'anywhere' }}>{section.title}</h2>
      </header>
    );
  }
  return (
    <header style={{ marginBottom: 56 }}>
      <span style={{ ...typeCss(tokens.type.caption), color: tokens.muted }}>{number}</span>
      <h2 style={{ ...heading, margin: '8px 0 0', maxWidth: '85%', overflowWrap: 'anywhere' }}>{section.title}</h2>
    </header>
  );
}

function Cover({ ctx, section }: { ctx: Ctx; section: Extract<SectionVM, { kind: 'cover' }> }) {
  const { t, tokens, urls } = ctx;
  const background = t.cover === 'bleed' && !section.backgroundChosen ? tokens.primary : section.background;
  const fg = t.cover === 'bleed' && !section.backgroundChosen ? readableOn(background, tokens) : section.foreground;
  const logo = logoForSurface(background, section.logo, null);
  const meta = [section.version && `Версия ${section.version}`, section.dateLabel, section.author].filter(Boolean) as string[];
  const title = typeCss(tokens.type.heading, t.cover === 'bleed' ? 2.4 : 2);
  const base: CSSProperties = { background, color: fg, minHeight: PAGE.height, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' };

  if (t.cover === 'grid') {
    return (
      <div style={{ ...base, padding: `${t.margin.top}px ${t.margin.right}px ${t.margin.bottom}px ${t.margin.left}px` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${fg}`, paddingBottom: 8, ...typeCss(tokens.type.caption) }}>
          <span>Брендбук</span>
          <span>{meta.join(' · ')}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '48px 0', border: `1px solid ${fg}` }}>
          {logo && <AssetImage asset={logo} urls={urls} alt="Логотип" style={{ maxWidth: '50%', maxHeight: 220 }} />}
        </div>
        <h1 style={{ ...title, margin: 0, overflowWrap: 'anywhere' }}>{section.heading}</h1>
        {section.subtitle && <p style={{ ...typeCss(tokens.type.body, 1.25), ...textBlock, marginTop: 16, maxWidth: '75%' }}>{section.subtitle}</p>}
      </div>
    );
  }
  if (t.cover === 'bleed') {
    return (
      <div style={{ ...base, padding: `${t.margin.top}px ${t.margin.right}px ${t.margin.bottom}px ${t.margin.left}px`, justifyContent: 'space-between' }}>
        {logo ? <AssetImage asset={logo} urls={urls} alt="Логотип" style={{ maxHeight: 96, maxWidth: 260 }} /> : <span />}
        <div>
          <h1 style={{ ...title, margin: 0, overflowWrap: 'anywhere' }}>{section.heading}</h1>
          {section.subtitle && <p style={{ ...typeCss(tokens.type.body, 1.3), ...textBlock, marginTop: 20 }}>{section.subtitle}</p>}
          {meta.length > 0 && <p style={{ ...typeCss(tokens.type.caption), marginTop: 40, borderTop: `4px solid ${fg}`, paddingTop: 12 }}>{meta.join('   ·   ')}</p>}
        </div>
      </div>
    );
  }
  return (
    <div style={{ ...base, padding: `${t.margin.top}px ${t.margin.right}px ${t.margin.bottom}px ${t.margin.left}px` }}>
      {logo ? <AssetImage asset={logo} urls={urls} alt="Логотип" style={{ maxHeight: 72, maxWidth: 220 }} /> : <span style={{ height: 72 }} />}
      <div style={{ flex: 1 }} />
      <h1 style={{ ...title, margin: 0, maxWidth: '92%', overflowWrap: 'anywhere' }}>{section.heading}</h1>
      {section.subtitle && <p style={{ ...typeCss(tokens.type.body, 1.25), ...textBlock, marginTop: 20, maxWidth: '70%', marginLeft: '30%' }}>{section.subtitle}</p>}
      {meta.length > 0 && (
        <div style={{ display: 'flex', gap: 32, marginTop: 64, marginLeft: '30%', ...typeCss(tokens.type.caption) }}>
          {meta.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ ctx, label, children }: { ctx: Ctx; label: string; children: ReactNode }) {
  const { t, tokens } = ctx;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${t.labelColumn * 100}% 1fr`, gap: 24, padding: '20px 0', borderTop: `1px solid ${tokens.muted}` }}>
      <h3 style={{ ...typeCss(tokens.type.caption), margin: 0, fontWeight: 700, textTransform: t.id === 'studio' ? 'uppercase' : undefined }}>{label}</h3>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

function List({ items, ctx, ordered }: { items: string[]; ctx: Ctx; ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag style={{ margin: 0, paddingLeft: ordered ? 24 : 18, display: 'flex', flexDirection: 'column', gap: 6, ...typeCss(ctx.tokens.type.body) }}>
      {items.map((item, i) => (
        <li key={i} style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>
          {item}
        </li>
      ))}
    </Tag>
  );
}

function Para({ ctx, children, lead }: { ctx: Ctx; children: string; lead?: boolean }) {
  return <p style={{ ...typeCss(ctx.tokens.type.body, lead ? 1.25 : 1), ...textBlock }}>{children}</p>;
}

function SectionBody({ ctx, section }: { ctx: Ctx; section: SectionVM }) {
  switch (section.kind) {
    case 'cover':
      return null;
    case 'about':
      return (
        <div>
          {section.description && (
            <div style={{ marginBottom: 32, maxWidth: ctx.t.id === 'editorial' ? '85%' : undefined }}>
              <Para ctx={ctx} lead>
                {section.description}
              </Para>
            </div>
          )}
          {section.blocks.map((b) => (
            <Row key={b.label} ctx={ctx} label={b.label}>
              <Para ctx={ctx}>{b.text}</Para>
            </Row>
          ))}
          {section.values.length > 0 && (
            <Row ctx={ctx} label="Ценности">
              <List ctx={ctx} items={section.values} ordered />
            </Row>
          )}
        </div>
      );
    case 'logo':
      return <LogoBody ctx={ctx} section={section} />;
    case 'colors':
      return <ColorsBody ctx={ctx} section={section} />;
    case 'typography':
      return <TypographyBody ctx={ctx} section={section} />;
    case 'imagery':
      return (
        <div>
          {section.images.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 32 }}>
              {section.images.map((img) => (
                <figure key={img.id} style={{ margin: 0, breakInside: 'avoid' }}>
                  <div style={{ aspectRatio: '4 / 3', overflow: 'hidden', background: ctx.tokens.muted }}>
                    {ctx.urls.get(img.asset.id) && (
                      <img
                        src={ctx.urls.get(img.asset.id)}
                        alt={img.caption || 'Пример изображения'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${img.focalX}% ${img.focalY}%`, display: 'block' }}
                      />
                    )}
                  </div>
                  {img.caption && <figcaption style={{ ...typeCss(ctx.tokens.type.caption), marginTop: 8, overflowWrap: 'anywhere' }}>{img.caption}</figcaption>}
                </figure>
              ))}
            </div>
          )}
          {section.rules.map((r) => (
            <Row key={r.label} ctx={ctx} label={r.label}>
              <Para ctx={ctx}>{r.text}</Para>
            </Row>
          ))}
        </div>
      );
    case 'voice':
      return (
        <div>
          {section.qualities.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
              {section.qualities.map((q, i) => (
                <div key={i} style={{ borderTop: `3px solid ${ctx.tokens.accent}`, paddingTop: 12, minWidth: 0 }}>
                  <h3 style={{ ...typeCss(ctx.tokens.type.heading, 0.55), margin: 0, overflowWrap: 'anywhere' }}>{q.title}</h3>
                  {q.description && <p style={{ ...typeCss(ctx.tokens.type.body), ...textBlock, marginTop: 8 }}>{q.description}</p>}
                </div>
              ))}
            </div>
          )}
          {section.rules.length > 0 && (
            <Row ctx={ctx} label="Правила">
              <List ctx={ctx} items={section.rules} />
            </Row>
          )}
          {section.pairs.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 24, tableLayout: 'fixed', ...typeCss(ctx.tokens.type.body) }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px 8px 0', borderBottom: `2px solid ${ctx.tokens.text}`, ...typeCss(ctx.tokens.type.caption), fontWeight: 700 }}>Так говорим</th>
                  <th style={{ textAlign: 'left', padding: '8px 0 8px 12px', borderBottom: `2px solid ${ctx.tokens.text}`, ...typeCss(ctx.tokens.type.caption), fontWeight: 700 }}>Так не говорим</th>
                </tr>
              </thead>
              <tbody>
                {section.pairs.map((p, i) => (
                  <tr key={i}>
                    <td style={{ verticalAlign: 'top', padding: '12px 12px 12px 0', borderBottom: `1px solid ${ctx.tokens.muted}`, overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{p.say}</td>
                    <td style={{ verticalAlign: 'top', padding: '12px 0 12px 12px', borderBottom: `1px solid ${ctx.tokens.muted}`, overflowWrap: 'anywhere', whiteSpace: 'pre-line', textDecoration: 'line-through', textDecorationColor: ctx.tokens.muted }}>
                      {p.avoid}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    case 'applications':
      return <MockupsHtml section={section} tokens={ctx.tokens} urls={ctx.urls} />;
    case 'contacts':
      return (
        <div>
          {section.organization && (
            <Row ctx={ctx} label="Автор / организация">
              <Para ctx={ctx}>{section.organization}</Para>
            </Row>
          )}
          {section.email && (
            <Row ctx={ctx} label="Email">
              <a href={`mailto:${section.email}`} style={{ color: 'inherit', overflowWrap: 'anywhere' }}>
                {section.email}
              </a>
            </Row>
          )}
          {section.website && (
            <Row ctx={ctx} label="Сайт">
              {isHttpUrl(section.website) ? (
                <a href={section.website} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', overflowWrap: 'anywhere' }}>
                  {section.website}
                </a>
              ) : (
                <span style={{ overflowWrap: 'anywhere' }}>{section.website}</span>
              )}
            </Row>
          )}
          {section.usageNote && (
            <Row ctx={ctx} label="Использование материалов">
              <Para ctx={ctx}>{section.usageNote}</Para>
            </Row>
          )}
        </div>
      );
  }
}

function LogoTile({ ctx, background, asset, label, clearSpace, width }: { ctx: Ctx; background: string; asset: AssetRef | null; label: string; clearSpace?: number; width: number }) {
  const fg = readableOn(background, ctx.tokens);
  const pad = 20;
  const height = Math.round(width * 0.75);
  const size = asset ? fitLogo(asset.width / asset.height, width - 2 * pad, height - 2 * pad, clearSpace ?? 0) : null;
  return (
    <figure style={{ margin: 0, width }}>
      <div style={{ background, width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', border: `1px solid ${ctx.tokens.muted}` }}>
        {asset && size ? (
          <div style={{ padding: clearSpace !== undefined ? clearSpace * size.height : 0, outline: clearSpace !== undefined ? `1px dashed ${fg}` : undefined }}>
            <AssetImage asset={asset} urls={ctx.urls} alt={label} style={{ width: size.width, height: size.height }} />
          </div>
        ) : (
          <span style={{ ...typeCss(ctx.tokens.type.caption), color: fg }}>Нет файла</span>
        )}
      </div>
      <figcaption style={{ ...typeCss(ctx.tokens.type.caption), marginTop: 8 }}>{label}</figcaption>
    </figure>
  );
}

function LogoBody({ ctx, section }: { ctx: Ctx; section: Extract<SectionVM, { kind: 'logo' }> }) {
  const { tokens, urls, t } = ctx;
  const main = section.primary;
  const full = contentWidth(t);
  const row = rowContentWidth(t);
  const onDark = logoForSurface(section.backgrounds.dark, main, section.light);
  const onBrand = logoForSurface(section.backgrounds.brand, main, section.light);
  const misuse = [
    section.misuse.stretch && { label: 'Недопустимо: растягивать или сжимать', transform: 'scaleX(1.6)' },
    section.misuse.rotate && { label: 'Недопустимо: наклонять и поворачивать', transform: 'rotate(-18deg)' },
    section.misuse.busyBackground && { label: 'Недопустимо: размещать на пёстром фоне', transform: 'none', busy: true },
  ].filter(Boolean) as { label: string; transform: string; busy?: boolean }[];
  return (
    <div>
      {section.variants.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
          {section.variants.map((v) => (
            <LogoTile key={v.kind} ctx={ctx} width={(full - 16) / 2} background={v.kind === 'light' ? section.backgrounds.dark : section.backgrounds.light} asset={v.asset} label={v.label} />
          ))}
        </div>
      )}
      {main && (
        <Row ctx={ctx} label="На разных фонах">
          <div style={{ display: 'flex', gap: 12 }}>
            <LogoTile ctx={ctx} width={(row - 24) / 3} background={section.backgrounds.light} asset={main} label="Светлый фон" />
            <LogoTile ctx={ctx} width={(row - 24) / 3} background={section.backgrounds.dark} asset={onDark} label={section.light ? 'Тёмный фон, светлая версия' : 'Тёмный фон'} />
            <LogoTile ctx={ctx} width={(row - 24) / 3} background={section.backgrounds.brand} asset={onBrand} label="Фирменный цвет" />
          </div>
        </Row>
      )}
      {main && (
        <Row ctx={ctx} label="Охранное поле">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'center' }}>
            <LogoTile ctx={ctx} width={(row - 16) / 2} background={section.backgrounds.light} asset={main} label={`Отступ ${section.clearSpace}× высоты логотипа`} clearSpace={section.clearSpace} />
            <div style={{ ...typeCss(tokens.type.body) }}>
              <p style={{ margin: 0 }}>Свободное поле вокруг логотипа: {section.clearSpace} × H, где H — высота логотипа.</p>
              {(section.minSizePx !== null || section.minSizeMm !== null) && (
                <p style={{ margin: '12px 0 0' }}>
                  Минимальный размер:{' '}
                  {[section.minSizePx !== null && `${section.minSizePx} px на экране`, section.minSizeMm !== null && `${section.minSizeMm} мм в печати`].filter(Boolean).join(', ')}.
                </p>
              )}
            </div>
          </div>
        </Row>
      )}
      {section.usageRules && (
        <Row ctx={ctx} label="Правила использования">
          <Para ctx={ctx}>{section.usageRules}</Para>
        </Row>
      )}
      {(section.doRules.length > 0 || section.dontRules.length > 0) && (
        <Row ctx={ctx} label="Можно и нельзя">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <p style={{ ...typeCss(tokens.type.caption), fontWeight: 700, margin: '0 0 8px' }}>Допустимо</p>
              <List ctx={ctx} items={section.doRules} />
            </div>
            <div>
              <p style={{ ...typeCss(tokens.type.caption), fontWeight: 700, margin: '0 0 8px' }}>Недопустимо</p>
              <List ctx={ctx} items={section.dontRules} />
            </div>
          </div>
        </Row>
      )}
      {main && misuse.length > 0 && (
        <Row ctx={ctx} label="Ошибки применения">
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${misuse.length}, 1fr)`, gap: 12 }}>
            {misuse.map((m) => (
              <figure key={m.label} style={{ margin: 0 }}>
                <div
                  style={{
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    border: `2px solid ${tokens.text}`,
                    position: 'relative',
                    background: m.busy
                      ? `repeating-linear-gradient(45deg, ${tokens.primary} 0 10px, ${tokens.accent} 10px 20px, ${tokens.secondary} 20px 30px)`
                      : '#FFFFFF',
                  }}
                >
                  <AssetImage asset={main} urls={urls} alt="" style={{ ...fitLogo(main.width / main.height, 90, 90, 0, 40), transform: m.transform }} />
                  <span aria-hidden style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top right, transparent calc(50% - 1.5px), ${tokens.text} calc(50% - 1.5px) calc(50% + 1.5px), transparent calc(50% + 1.5px))` }} />
                </div>
                <figcaption style={{ ...typeCss(tokens.type.caption), marginTop: 8, fontWeight: 700 }}>{m.label}</figcaption>
              </figure>
            ))}
          </div>
        </Row>
      )}
    </div>
  );
}

function ContrastLine({ ctx, label, ratio }: { ctx: Ctx; label: string; ratio: number }) {
  const aa = ratio >= 4.5 ? 'AA для текста' : ratio >= 3 ? 'AA только крупный текст' : 'не для текста';
  return (
    <span style={{ display: 'block', ...typeCss(ctx.tokens.type.caption) }}>
      {label}: {ratioLabel(ratio)}, {aa}
    </span>
  );
}

function ColorsBody({ ctx, section }: { ctx: Ctx; section: Extract<SectionVM, { kind: 'colors' }> }) {
  const { t, tokens } = ctx;
  const values = (c: (typeof section.colors)[number]) => (
    <>
      <span style={{ display: 'block', fontFamily: "'BF Noto Sans'", fontSize: 12, lineHeight: 1.5 }}>{c.hex}</span>
      <span style={{ display: 'block', fontFamily: "'BF Noto Sans'", fontSize: 12, lineHeight: 1.5 }}>{c.rgb.toUpperCase()}</span>
      <span style={{ display: 'block', fontFamily: "'BF Noto Sans'", fontSize: 12, lineHeight: 1.5 }}>{c.hsl.toUpperCase()}</span>
    </>
  );
  const note = (
    <p style={{ ...typeCss(tokens.type.caption), marginTop: 24, color: tokens.muted }}>
      Контраст указан по WCAG 2.1 для пары цветов с фоном ({section.backgroundHex}) и цветом текста ({section.textHex}). Это проверка пар, а не оценка доступности бренда в целом.
    </p>
  );
  if (t.colors === 'bands') {
    return (
      <div>
        {section.colors.map((c) => (
          <div key={c.id} style={{ background: c.hex, color: c.onColor, display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.3fr', gap: 16, padding: '20px 24px', breakInside: 'avoid' }}>
            <div>
              <strong style={{ ...typeCss(tokens.type.heading, 0.5), display: 'block', overflowWrap: 'anywhere' }}>{c.name || 'Без названия'}</strong>
              <span style={typeCss(tokens.type.caption)}>{c.roleLabel}</span>
            </div>
            <div>{values(c)}</div>
            <div>
              <ContrastLine ctx={ctx} label="С фоном" ratio={c.contrastWithBackground} />
              <ContrastLine ctx={ctx} label="С текстом" ratio={c.contrastWithText} />
            </div>
          </div>
        ))}
        {note}
      </div>
    );
  }
  if (t.colors === 'cards') {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {section.colors.map((c) => (
            <div key={c.id} style={{ border: `1px solid ${tokens.text}`, breakInside: 'avoid', minWidth: 0 }}>
              <div style={{ background: c.hex, height: 96 }} />
              <div style={{ padding: 12 }}>
                <strong style={{ display: 'block', ...typeCss(tokens.type.body), fontWeight: 700, overflowWrap: 'anywhere' }}>{c.name || 'Без названия'}</strong>
                <span style={{ display: 'block', ...typeCss(tokens.type.caption), marginBottom: 8 }}>{c.roleLabel}</span>
                {values(c)}
                <div style={{ marginTop: 8 }}>
                  <ContrastLine ctx={ctx} label="С фоном" ratio={c.contrastWithBackground} />
                  <ContrastLine ctx={ctx} label="С текстом" ratio={c.contrastWithText} />
                </div>
              </div>
            </div>
          ))}
        </div>
        {note}
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(section.colors.length, 4)}, 1fr)`, gap: 16 }}>
        {section.colors.map((c) => (
          <div key={c.id} style={{ breakInside: 'avoid', minWidth: 0 }}>
            <div style={{ background: c.hex, height: 200, border: `1px solid ${tokens.muted}`, display: 'flex', alignItems: 'flex-end', padding: 12, boxSizing: 'border-box', color: c.onColor }}>
              <span style={typeCss(tokens.type.caption)}>{c.roleLabel}</span>
            </div>
            <strong style={{ display: 'block', marginTop: 12, ...typeCss(tokens.type.body), fontWeight: 700, overflowWrap: 'anywhere' }}>{c.name || 'Без названия'}</strong>
            {values(c)}
            <div style={{ marginTop: 8 }}>
              <ContrastLine ctx={ctx} label="С фоном" ratio={c.contrastWithBackground} />
              <ContrastLine ctx={ctx} label="С текстом" ratio={c.contrastWithText} />
            </div>
          </div>
        ))}
      </div>
      {note}
    </div>
  );
}

function TypographyBody({ ctx, section }: { ctx: Ctx; section: Extract<SectionVM, { kind: 'typography' }> }) {
  const { tokens } = ctx;
  const [heading, body] = section.styles;
  return (
    <div>
      {section.styles.map((s) => (
        <Row key={s.role} ctx={ctx} label={s.roleLabel}>
          <p style={{ ...typeCss(tokens.type.caption), margin: '0 0 8px' }}>
            {s.familyLabel} {s.weightLabel} · {s.sizePx} px ({s.sizePt} pt) · интерлиньяж {s.lineHeight} · трекинг {s.trackingEm} em
          </p>
          <p style={{ ...typeCss(s), margin: 0, overflowWrap: 'anywhere' }}>{s.role === 'body' && section.sampleParagraph ? section.sampleParagraph.slice(0, 220) : section.sampleHeading}</p>
        </Row>
      ))}
      {heading && body && (
        <Row ctx={ctx} label="Набор символов">
          <p style={{ ...typeCss(heading, 0.6), margin: '0 0 8px', overflowWrap: 'anywhere' }}>{TYPE_SAMPLE.alphabetRu}</p>
          <p style={{ ...typeCss(heading, 0.6), margin: '0 0 8px', overflowWrap: 'anywhere' }}>{TYPE_SAMPLE.alphabetLatin}</p>
          <p style={{ ...typeCss(body), margin: '0 0 8px' }}>{TYPE_SAMPLE.digits}</p>
          <p style={{ ...typeCss(body), margin: 0 }}>{TYPE_SAMPLE.uzbek}</p>
        </Row>
      )}
    </div>
  );
}

