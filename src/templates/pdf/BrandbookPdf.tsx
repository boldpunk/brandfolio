/**
 * PDF adapter: renders the same BrandbookViewModel as the HTML preview with
 * react-pdf primitives. Layout values are authored in CSS px (like the HTML
 * templates) and converted to pt with u(). Text stays text; only logos and
 * photos are images.
 */
import { Document, Image, Link, Page, Svg, Line, Polygon, Text, View, type DocumentProps } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { pxToPt } from '@/domain/fonts';
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
import { LOCALE_TAGS } from '@/i18n/locales';
import { documentMessages } from '@/i18n/messages/document';
import { softBreak } from '@/lib/softBreak';
import { contentWidth, coverTitleScale, fitLogo, rowContentWidth, TEMPLATE_STYLES, type TemplateStyle } from '../templateStyle';

type Style = NonNullable<React.ComponentProps<typeof View>['style']>;
type TextStyle = Exclude<Style, unknown[]>;

/** Image sources prepared for the PDF: PNG/JPEG blobs, SVG already rasterized. */
export type PdfImages = ReadonlyMap<string, Blob>;

/** `m`: labels printed inside the document, in the document's language (vm.language). */
type Ctx = { vm: BrandbookViewModel; t: TemplateStyle; images: PdfImages; tokens: Tokens; m: (typeof documentMessages)['ru'] };

const u = (px: number) => Math.round(pxToPt(px) * 100) / 100;
const s = (text: string) => softBreak(text);

/** react-pdf resolves unitless lineHeight against the Text's own fontSize, so both are always set. */
function type(t: ResolvedType, scale = 1): TextStyle {
  const size = u(t.sizePx * scale);
  return { fontFamily: t.cssFamily, fontWeight: t.weight, fontSize: size, lineHeight: t.lineHeight, letterSpacing: t.trackingEm * size };
}

function Img({ asset, images, style }: { asset: AssetRef | null; images: PdfImages; style: TextStyle }) {
  if (!asset) return null;
  const blob = images.get(asset.id);
  if (!blob) return null;
  return <Image src={blob} style={{ objectFit: 'contain', ...style }} />;
}

/** Logo box with a known height and width from the asset's aspect ratio (react-pdf needs explicit sizes). */
function LogoImg({ asset, images, height, maxWidth }: { asset: AssetRef | null; images: PdfImages; height: number; maxWidth: number }) {
  if (!asset) return null;
  const ratio = asset.width / asset.height;
  const width = Math.min(maxWidth, height * ratio);
  return <Img asset={asset} images={images} style={{ width: u(width), height: u(width / ratio) }} />;
}

export function BrandbookPdf({ vm, images }: { vm: BrandbookViewModel; images: PdfImages }) {
  const ctx: Ctx = { vm, t: TEMPLATE_STYLES[vm.templateId], images, tokens: vm.tokens, m: documentMessages[vm.language] };
  const meta: DocumentProps = {
    title: vm.documentTitle,
    author: vm.author || undefined,
    subject: ctx.m.brandbook,
    creator: 'Brandfolio',
    producer: 'Brandfolio',
    language: LOCALE_TAGS[vm.language],
  };
  const sections = vm.sections.filter((section) => !section.isEmpty);
  return (
    <Document {...meta}>
      {sections.map((section) =>
        section.kind === 'cover' ? <CoverPage key="cover" ctx={ctx} section={section} /> : <SectionPage key={section.kind} ctx={ctx} section={section} />,
      )}
    </Document>
  );
}

function PageNumber({ ctx }: { ctx: Ctx }) {
  const { t, tokens } = ctx;
  return (
    <View fixed style={{ position: 'absolute', bottom: u(32), left: u(t.margin.left), right: u(t.margin.right), flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ ...type(tokens.type.caption), color: tokens.muted }}>{s(ctx.vm.documentTitle)}</Text>
      <Text style={{ ...type(tokens.type.caption), color: tokens.muted }} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function SectionPage({ ctx, section }: { ctx: Ctx; section: SectionVM }) {
  const { t, tokens } = ctx;
  return (
    <Page
      size="A4"
      wrap
      style={{
        backgroundColor: tokens.background,
        color: tokens.text,
        paddingTop: u(t.margin.top),
        paddingRight: u(t.margin.right),
        paddingBottom: u(t.margin.bottom),
        paddingLeft: u(t.margin.left),
        ...type(tokens.type.body),
      }}
    >
      {t.running && (
        <View fixed style={{ position: 'absolute', top: u(32), left: u(t.margin.left), right: u(t.margin.right), flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.75, borderBottomColor: tokens.text, paddingBottom: u(8) }}>
          <Text style={{ ...type(tokens.type.caption), flex: 1, paddingRight: u(16), maxLines: 1, textOverflow: 'ellipsis' }}>
            {ctx.vm.documentTitle}
          </Text>
          <Text style={type(tokens.type.caption)}>
            {String(section.number).padStart(2, '0')} · {section.title}
          </Text>
        </View>
      )}
      <Opener ctx={ctx} section={section} />
      <SectionBody ctx={ctx} section={section} />
      <PageNumber ctx={ctx} />
    </Page>
  );
}

function Opener({ ctx, section }: { ctx: Ctx; section: SectionVM }) {
  const { t, tokens, m } = ctx;
  const number = String(section.number).padStart(2, '0');
  const heading = type(tokens.type.heading, t.headingScale);
  if (t.opener === 'field') {
    const fg = readableOn(tokens.primary, tokens);
    return (
      <View
        wrap={false}
        style={{
          marginTop: -u(t.margin.top),
          marginLeft: -u(t.margin.left),
          marginRight: -u(t.margin.right),
          marginBottom: u(48),
          paddingTop: u(t.margin.top),
          paddingLeft: u(t.margin.left),
          paddingRight: u(t.margin.right),
          paddingBottom: u(40),
          minHeight: u(280),
          backgroundColor: tokens.primary,
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ ...type(tokens.type.heading, 3.2), lineHeight: 1, color: fg }}>{number}</Text>
        <Text style={{ ...heading, color: fg }}>{s(section.title)}</Text>
      </View>
    );
  }
  if (t.opener === 'rail') {
    return (
      <View wrap={false} style={{ flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1.5, borderBottomColor: tokens.text, paddingBottom: u(16), marginBottom: u(40) }}>
        <Text style={{ ...type(tokens.type.caption), width: `${t.labelColumn * 100}%`, textTransform: 'uppercase' }}>{m.sectionNumber(number)}</Text>
        <Text style={{ ...heading, flex: 1 }}>{s(section.title)}</Text>
      </View>
    );
  }
  return (
    <View wrap={false} style={{ marginBottom: u(56) }}>
      <Text style={{ ...type(tokens.type.caption), color: tokens.muted }}>{number}</Text>
      <Text style={{ ...heading, marginTop: u(8), maxWidth: '85%' }}>{s(section.title)}</Text>
    </View>
  );
}

function CoverPage({ ctx, section }: { ctx: Ctx; section: Extract<SectionVM, { kind: 'cover' }> }) {
  const { t, tokens, images, m } = ctx;
  const background = t.cover === 'bleed' && !section.backgroundChosen ? tokens.primary : section.background;
  const fg = t.cover === 'bleed' && !section.backgroundChosen ? readableOn(background, tokens) : section.foreground;
  const logo = logoForSurface(background, section.logo, null);
  const meta = [section.version && m.version(section.version), section.dateLabel, section.author].filter(Boolean) as string[];
  const title = { ...type(tokens.type.heading, coverTitleScale(section.heading, t.cover === 'bleed' ? 2.4 : 2, tokens.type.heading.sizePx, contentWidth(t))), color: fg };
  const pad = { paddingTop: u(t.margin.top), paddingRight: u(t.margin.right), paddingBottom: u(t.margin.bottom), paddingLeft: u(t.margin.left) };
  const page = { backgroundColor: background, color: fg, ...pad, ...type(tokens.type.body) };

  if (t.cover === 'grid') {
    return (
      <Page size="A4" style={{ ...page, flexDirection: 'column' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.75, borderBottomColor: fg, paddingBottom: u(8) }}>
          <Text style={{ ...type(tokens.type.caption), color: fg, paddingRight: u(16) }}>{m.brandbook}</Text>
          <Text style={{ ...type(tokens.type.caption), color: fg, flex: 1, textAlign: 'right' }}>{s(meta.join(' · '))}</Text>
        </View>
        <View style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', marginVertical: u(48), borderWidth: 0.75, borderColor: fg }}>
          <LogoImg asset={logo} images={images} height={180} maxWidth={320} />
        </View>
        <Text style={title}>{s(section.heading)}</Text>
        {section.subtitle ? <Text style={{ ...type(tokens.type.body, 1.25), marginTop: u(16), maxWidth: '75%', color: fg }}>{s(section.subtitle)}</Text> : null}
      </Page>
    );
  }
  if (t.cover === 'bleed') {
    return (
      <Page size="A4" style={{ ...page, justifyContent: 'space-between' }}>
        <LogoImg asset={logo} images={images} height={96} maxWidth={260} />
        <View>
          <Text style={title}>{s(section.heading)}</Text>
          {section.subtitle ? <Text style={{ ...type(tokens.type.body, 1.3), marginTop: u(20), color: fg }}>{s(section.subtitle)}</Text> : null}
          {meta.length > 0 && <Text style={{ ...type(tokens.type.caption), marginTop: u(40), borderTopWidth: 3, borderTopColor: fg, paddingTop: u(12), color: fg }}>{meta.join('   ·   ')}</Text>}
        </View>
      </Page>
    );
  }
  return (
    <Page size="A4" style={{ ...page, flexDirection: 'column' }}>
      <LogoImg asset={logo} images={images} height={72} maxWidth={220} />
      <View style={{ flexGrow: 1 }} />
      <Text style={{ ...title, maxWidth: '92%' }}>{s(section.heading)}</Text>
      {section.subtitle ? <Text style={{ ...type(tokens.type.body, 1.25), marginTop: u(20), width: '70%', marginLeft: '30%', color: fg }}>{s(section.subtitle)}</Text> : null}
      {meta.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: u(64), marginLeft: '30%' }}>
          {meta.map((m) => (
            <Text key={m} style={{ ...type(tokens.type.caption), marginRight: u(32), color: fg }}>
              {m}
            </Text>
          ))}
        </View>
      )}
    </Page>
  );
}

function Row({ ctx, label, children }: { ctx: Ctx; label: string; children: ReactNode }) {
  const { t, tokens } = ctx;
  return (
    <View style={{ flexDirection: 'row', paddingVertical: u(20), borderTopWidth: 0.75, borderTopColor: tokens.muted }}>
      <Text minPresenceAhead={u(60)} style={{ ...type(tokens.type.caption), fontWeight: 700, width: `${t.labelColumn * 100}%`, paddingRight: u(24), textTransform: t.id === 'studio' ? 'uppercase' : 'none' }}>
        {label}
      </Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function Para({ ctx, children, lead }: { ctx: Ctx; children: string; lead?: boolean }) {
  return <Text style={type(ctx.tokens.type.body, lead ? 1.25 : 1)}>{s(children)}</Text>;
}

function bulletText(ctx: Ctx, item: string, i: number, ordered?: boolean) {
  return (
    <Text key={i} style={{ ...type(ctx.tokens.type.body), marginBottom: u(6) }}>
      {ordered ? `${i + 1}.\u00A0\u00A0` : '•\u00A0\u00A0'}
      {s(item)}
    </Text>
  );
}

function Bullets({ ctx, items, ordered }: { ctx: Ctx; items: string[]; ordered?: boolean }) {
  // One Text per item: react-pdf splits a row of separate marker and text
  // boxes badly across pages (the marker stays behind, rows overlap).
  return <View>{items.map((item, i) => bulletText(ctx, item, i, ordered))}</View>;
}

/**
 * A labelled list that may run over several pages. The label is kept on the
 * page of the first item (both in an unbreakable row); later items continue in
 * the content column.
 */
function ListRow({ ctx, label, items, ordered }: { ctx: Ctx; label: string; items: string[]; ordered?: boolean }) {
  const { t, tokens } = ctx;
  const labelWidth = `${t.labelColumn * 100}%` as const;
  return (
    <View style={{ paddingVertical: u(20), borderTopWidth: 0.75, borderTopColor: tokens.muted }}>
      <View wrap={false} style={{ flexDirection: 'row' }}>
        <Text style={{ ...type(tokens.type.caption), fontWeight: 700, width: labelWidth, paddingRight: u(24), textTransform: t.id === 'studio' ? 'uppercase' : 'none' }}>{label}</Text>
        <View style={{ flex: 1 }}>{bulletText(ctx, items[0] ?? '', 0, ordered)}</View>
      </View>
      {items.length > 1 && <View style={{ marginLeft: labelWidth }}>{items.slice(1).map((item, i) => bulletText(ctx, item, i + 1, ordered))}</View>}
    </View>
  );
}

function SectionBody({ ctx, section }: { ctx: Ctx; section: SectionVM }) {
  const { tokens, m } = ctx;
  switch (section.kind) {
    case 'cover':
      return null;
    case 'about':
      return (
        <View>
          {section.description ? (
            <View style={{ marginBottom: u(32), maxWidth: ctx.t.id === 'editorial' ? '85%' : '100%' }}>
              <Para ctx={ctx} lead>
                {section.description}
              </Para>
            </View>
          ) : null}
          {section.blocks.map((b) => (
            <Row key={b.label} ctx={ctx} label={b.label}>
              <Para ctx={ctx}>{b.text}</Para>
            </Row>
          ))}
          {section.values.length > 0 && (
            <ListRow ctx={ctx} label={m.about.values} items={section.values} ordered />
          )}
        </View>
      );
    case 'logo':
      return <LogoBody ctx={ctx} section={section} />;
    case 'colors':
      return <ColorsBody ctx={ctx} section={section} />;
    case 'typography': {
      const [heading, body] = section.styles;
      return (
        <View>
          {section.styles.map((st) => (
            <Row key={st.role} ctx={ctx} label={st.roleLabel}>
              <Text style={{ ...type(tokens.type.caption), marginBottom: u(8) }}>
                {st.familyLabel} {st.weightLabel} · {st.sizePx} px ({st.sizePt} pt) · {m.typography.lineHeight} {st.lineHeight} · {m.typography.tracking} {st.trackingEm} em
              </Text>
              <Text style={type(st)}>{s(st.role === 'body' && section.sampleParagraph ? section.sampleParagraph.slice(0, 220) : section.sampleHeading)}</Text>
            </Row>
          ))}
          {heading && body && (
            <Row ctx={ctx} label={m.typography.characterSet}>
              <Text style={{ ...type(heading, 0.6), marginBottom: u(8) }}>{s(TYPE_SAMPLE.alphabetRu)}</Text>
              <Text style={{ ...type(heading, 0.6), marginBottom: u(8) }}>{s(TYPE_SAMPLE.alphabetLatin)}</Text>
              <Text style={{ ...type(body), marginBottom: u(8) }}>{TYPE_SAMPLE.digits}</Text>
              <Text style={type(body)}>{TYPE_SAMPLE.uzbek}</Text>
            </Row>
          )}
        </View>
      );
    }
    case 'imagery':
      return (
        <View>
          {section.images.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: u(16) }}>
              {section.images.map((img) => {
                const blob = ctx.images.get(img.asset.id);
                return (
                  <View key={img.id} wrap={false} style={{ width: '48.5%', marginBottom: u(16) }}>
                    <View style={{ height: u(236), backgroundColor: tokens.muted, overflow: 'hidden' }}>
                      {blob && <Image src={blob} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPositionX: `${img.focalX}%`, objectPositionY: `${img.focalY}%` }} />}
                    </View>
                    {img.caption ? <Text style={{ ...type(tokens.type.caption), marginTop: u(8) }}>{s(img.caption)}</Text> : null}
                  </View>
                );
              })}
            </View>
          )}
          {section.rules.map((r) => (
            <Row key={r.label} ctx={ctx} label={r.label}>
              <Para ctx={ctx}>{r.text}</Para>
            </Row>
          ))}
        </View>
      );
    case 'voice':
      return (
        <View>
          {section.qualities.length > 0 && (
            <View style={{ flexDirection: 'row', marginBottom: u(32) }} wrap={false}>
              {section.qualities.map((q, i) => (
                <View key={i} style={{ flex: 1, borderTopWidth: 2.25, borderTopColor: tokens.accent, paddingTop: u(12), marginLeft: i ? u(16) : 0 }}>
                  <Text style={type(tokens.type.heading, 0.55)}>{s(q.title)}</Text>
                  {q.description ? <Text style={{ ...type(tokens.type.body), marginTop: u(8) }}>{s(q.description)}</Text> : null}
                </View>
              ))}
            </View>
          )}
          {section.rules.length > 0 && (
            <ListRow ctx={ctx} label={m.voice.rules} items={section.rules} />
          )}
          {section.pairs.length > 0 && (
            <View style={{ marginTop: u(24) }}>
              <View style={{ flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: tokens.text, paddingBottom: u(8) }} minPresenceAhead={u(60)}>
                <Text style={{ ...type(tokens.type.caption), fontWeight: 700, flex: 1, paddingRight: u(12) }}>{m.voice.say}</Text>
                <Text style={{ ...type(tokens.type.caption), fontWeight: 700, flex: 1, paddingLeft: u(12) }}>{m.voice.avoid}</Text>
              </View>
              {section.pairs.map((p, i) => (
                <View key={i} wrap={false} style={{ flexDirection: 'row', borderBottomWidth: 0.75, borderBottomColor: tokens.muted, paddingVertical: u(12) }}>
                  <Text style={{ ...type(tokens.type.body), flex: 1, paddingRight: u(12) }}>{s(p.say)}</Text>
                  <Text style={{ ...type(tokens.type.body), flex: 1, paddingLeft: u(12), textDecoration: 'line-through', textDecorationColor: tokens.muted }}>{s(p.avoid)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      );
    case 'applications':
      return <MockupsPdf ctx={ctx} section={section} />;
    case 'contacts':
      return (
        <View>
          {section.organization ? (
            <Row ctx={ctx} label={m.contacts.organization}>
              <Para ctx={ctx}>{section.organization}</Para>
            </Row>
          ) : null}
          {section.email ? (
            <Row ctx={ctx} label={m.contacts.email}>
              <Link src={`mailto:${section.email}`} style={{ ...type(tokens.type.body), color: tokens.text }}>
                {s(section.email)}
              </Link>
            </Row>
          ) : null}
          {section.website ? (
            <Row ctx={ctx} label={m.contacts.website}>
              {isHttpUrl(section.website) ? (
                <Link src={section.website} style={{ ...type(tokens.type.body), color: tokens.text }}>
                  {s(section.website)}
                </Link>
              ) : (
                <Para ctx={ctx}>{section.website}</Para>
              )}
            </Row>
          ) : null}
          {section.usageNote ? (
            <Row ctx={ctx} label={m.contacts.usageNote}>
              <Para ctx={ctx}>{section.usageNote}</Para>
            </Row>
          ) : null}
        </View>
      );
  }
}

function LogoTile({ ctx, background, asset, label, clearSpace, width }: { ctx: Ctx; background: string; asset: AssetRef | null; label: string; clearSpace?: number; width: number }) {
  const fg = readableOn(background, ctx.tokens);
  const pad = 20;
  const height = width * 0.75;
  const size = asset ? fitLogo(asset.width / asset.height, width - 2 * pad, height - 2 * pad, clearSpace ?? 0) : null;
  return (
    <View style={{ width: u(width) }} wrap={false}>
      <View style={{ backgroundColor: background, height: u(height), alignItems: 'center', justifyContent: 'center', borderWidth: 0.75, borderColor: ctx.tokens.muted }}>
        {asset && size ? (
          <View style={clearSpace !== undefined ? { padding: u(clearSpace * size.height), borderWidth: 0.75, borderColor: fg, borderStyle: 'dashed' } : {}}>
            <Img asset={asset} images={ctx.images} style={{ width: u(size.width), height: u(size.height) }} />
          </View>
        ) : (
          <Text style={{ ...type(ctx.tokens.type.caption), color: fg }}>{ctx.m.logo.noFile}</Text>
        )}
      </View>
      <Text style={{ ...type(ctx.tokens.type.caption), marginTop: u(8) }}>{label}</Text>
    </View>
  );
}

function LogoBody({ ctx, section }: { ctx: Ctx; section: Extract<SectionVM, { kind: 'logo' }> }) {
  const { tokens, images, t } = ctx;
  const l = ctx.m.logo;
  const main = section.primary;
  const full = contentWidth(t);
  const row = rowContentWidth(t);
  const onDark = logoForSurface(section.backgrounds.dark, main, section.light);
  const onBrand = logoForSurface(section.backgrounds.brand, main, section.light);
  const misuse = [
    section.misuse.stretch && { label: l.misuseStretch, kind: 'stretch' as const },
    section.misuse.rotate && { label: l.misuseRotate, kind: 'rotate' as const },
    section.misuse.busyBackground && { label: l.misuseBusy, kind: 'busy' as const },
  ].filter(Boolean) as { label: string; kind: 'stretch' | 'rotate' | 'busy' }[];
  const box = 150;
  return (
    <View>
      {section.variants.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: u(16) }}>
          {section.variants.map((v) => (
            <View key={v.kind} style={{ marginBottom: u(16) }}>
              <LogoTile ctx={ctx} background={v.kind === 'light' ? section.backgrounds.dark : section.backgrounds.light} asset={v.asset} label={v.label} width={(full - 16) / 2} />
            </View>
          ))}
        </View>
      )}
      {main && (
        <Row ctx={ctx} label={l.backgrounds}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <LogoTile ctx={ctx} background={section.backgrounds.light} asset={main} label={l.lightBackground} width={(row - 24) / 3} />
            <LogoTile ctx={ctx} background={section.backgrounds.dark} asset={onDark} label={section.light ? l.darkBackgroundLightVersion : l.darkBackground} width={(row - 24) / 3} />
            <LogoTile ctx={ctx} background={section.backgrounds.brand} asset={onBrand} label={l.brandColor} width={(row - 24) / 3} />
          </View>
        </Row>
      )}
      {main && (
        <Row ctx={ctx} label={l.clearSpace}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} wrap={false}>
            <LogoTile ctx={ctx} background={section.backgrounds.light} asset={main} label={l.clearSpaceCaption(section.clearSpace)} clearSpace={section.clearSpace} width={(row - 16) / 2} />
            <View style={{ width: '48%' }}>
              <Text style={type(tokens.type.body)}>{l.clearSpaceNote(section.clearSpace)}</Text>
              {section.minSizePx !== null || section.minSizeMm !== null ? (
                <Text style={{ ...type(tokens.type.body), marginTop: u(12) }}>
                  {l.minSize} {[section.minSizePx !== null && l.minSizeScreen(section.minSizePx), section.minSizeMm !== null && l.minSizePrint(section.minSizeMm)].filter(Boolean).join(', ')}.
                </Text>
              ) : null}
            </View>
          </View>
        </Row>
      )}
      {section.usageRules ? (
        <Row ctx={ctx} label={l.usageRules}>
          <Para ctx={ctx}>{section.usageRules}</Para>
        </Row>
      ) : null}
      {section.doRules.length > 0 || section.dontRules.length > 0 ? (
        <Row ctx={ctx} label={l.doAndDont}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, paddingRight: u(12) }}>
              <Text style={{ ...type(tokens.type.caption), fontWeight: 700, marginBottom: u(8) }}>{l.allowed}</Text>
              <Bullets ctx={ctx} items={section.doRules} />
            </View>
            <View style={{ flex: 1, paddingLeft: u(12) }}>
              <Text style={{ ...type(tokens.type.caption), fontWeight: 700, marginBottom: u(8) }}>{l.forbidden}</Text>
              <Bullets ctx={ctx} items={section.dontRules} />
            </View>
          </View>
        </Row>
      ) : null}
      {main && misuse.length > 0 && (
        <Row ctx={ctx} label={l.misuse}>
          <View style={{ flexDirection: 'row' }} wrap={false}>
            {misuse.map((m, i) => {
              const fit = fitLogo(main.width / main.height, 90, 90, 0, 40);
              return (
                <View key={m.kind} style={{ width: u(box), marginLeft: i ? u(12) : 0 }}>
                  <View style={{ width: u(box), height: u(box), borderWidth: 1.5, borderColor: tokens.text, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                    {m.kind === 'busy' && <Stripes size={u(box)} colors={[tokens.primary, tokens.accent, tokens.secondary]} />}
                    <Img
                      asset={main}
                      images={images}
                      style={{ width: u(fit.width), height: u(fit.height), transform: m.kind === 'stretch' ? 'scaleX(1.6)' : m.kind === 'rotate' ? 'rotate(-18deg)' : undefined }}
                    />
                    <Svg width={u(box)} height={u(box)} style={{ position: 'absolute', top: 0, left: 0 }}>
                      <Line x1={0} y1={u(box)} x2={u(box)} y2={0} stroke={tokens.text} strokeWidth={2} />
                    </Svg>
                  </View>
                  <Text style={{ ...type(tokens.type.caption), fontWeight: 700, marginTop: u(8) }}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        </Row>
      )}
    </View>
  );
}

function Stripes({ size, colors }: { size: number; colors: string[] }) {
  const band = size / 9;
  const polys = Array.from({ length: 18 }, (_, i) => {
    const x = i * band - size;
    return { points: `${x},${size} ${x + band},${size} ${x + band + size},0 ${x + size},0`, color: colors[i % colors.length]! };
  });
  return (
    <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
      {polys.map((p, i) => (
        <Polygon key={i} points={p.points} fill={p.color} />
      ))}
    </Svg>
  );
}

function ContrastLines({ ctx, c }: { ctx: Ctx; c: { contrastWithBackground: number; contrastWithText: number } }) {
  const m = ctx.m.colors;
  const aa = (r: number) => (r >= 4.5 ? m.aaText : r >= 3 ? m.aaLargeOnly : m.notForText);
  return (
    <>
      <Text style={type(ctx.tokens.type.caption)}>
        {m.withBackground}: {ratioLabel(c.contrastWithBackground)}, {aa(c.contrastWithBackground)}
      </Text>
      <Text style={type(ctx.tokens.type.caption)}>
        {m.withText}: {ratioLabel(c.contrastWithText)}, {aa(c.contrastWithText)}
      </Text>
    </>
  );
}

function ColorsBody({ ctx, section }: { ctx: Ctx; section: Extract<SectionVM, { kind: 'colors' }> }) {
  const { t, tokens } = ctx;
  const m = ctx.m.colors;
  const mono: TextStyle = { fontFamily: 'BF Noto Sans', fontSize: 9, lineHeight: 1.5 };
  const values = (c: (typeof section.colors)[number], color?: string) => (
    <>
      <Text style={{ ...mono, color }}>{c.hex}</Text>
      <Text style={{ ...mono, color }}>{c.rgb.toUpperCase()}</Text>
      <Text style={{ ...mono, color }}>{c.hsl.toUpperCase()}</Text>
    </>
  );
  const note = (
    <Text style={{ ...type(tokens.type.caption), marginTop: u(24), color: tokens.muted }}>
      {m.contrastNote(section.backgroundHex, section.textHex)}
    </Text>
  );
  if (t.colors === 'bands') {
    return (
      <View>
        {section.colors.map((c) => (
          <View key={c.id} wrap={false} style={{ backgroundColor: c.hex, flexDirection: 'row', paddingVertical: u(20), paddingHorizontal: u(24) }}>
            <View style={{ flex: 1.2, paddingRight: u(12) }}>
              <Text style={{ ...type(tokens.type.heading, 0.5), color: c.onColor }}>{softBreak(c.name || m.untitled, 10, 8)}</Text>
              <Text style={{ ...type(tokens.type.caption), color: c.onColor }}>{c.roleLabel}</Text>
            </View>
            <View style={{ flex: 1 }}>{values(c, c.onColor)}</View>
            <View style={{ flex: 1.3 }}>
              <Text style={{ ...type(tokens.type.caption), color: c.onColor }}>
                {m.withBackground}: {ratioLabel(c.contrastWithBackground)}
              </Text>
              <Text style={{ ...type(tokens.type.caption), color: c.onColor }}>
                {m.withText}: {ratioLabel(c.contrastWithText)}
              </Text>
            </View>
          </View>
        ))}
        {note}
      </View>
    );
  }
  const columns = t.colors === 'cards' ? 3 : Math.min(section.colors.length, 4);
  const width = `${(100 - (columns - 1) * 2.5) / columns}%`;
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {section.colors.map((c, i) =>
          t.colors === 'cards' ? (
            <View key={c.id} wrap={false} style={{ width, marginLeft: i % columns ? '2.5%' : 0, marginBottom: u(12), borderWidth: 0.75, borderColor: tokens.text }}>
              <View style={{ backgroundColor: c.hex, height: u(96) }} />
              <View style={{ padding: u(12) }}>
                <Text style={{ ...type(tokens.type.body), fontWeight: 700 }}>{softBreak(c.name || m.untitled, 10, 8)}</Text>
                <Text style={{ ...type(tokens.type.caption), marginBottom: u(8) }}>{c.roleLabel}</Text>
                {values(c)}
                <View style={{ marginTop: u(8) }}>
                  <ContrastLines ctx={ctx} c={c} />
                </View>
              </View>
            </View>
          ) : (
            <View key={c.id} wrap={false} style={{ width, marginLeft: i % columns ? '2.5%' : 0, marginBottom: u(20) }}>
              <View style={{ backgroundColor: c.hex, height: u(200), borderWidth: 0.75, borderColor: tokens.muted, justifyContent: 'flex-end', padding: u(12) }}>
                <Text style={{ ...type(tokens.type.caption), color: c.onColor }}>{c.roleLabel}</Text>
              </View>
              <Text style={{ ...type(tokens.type.body), fontWeight: 700, marginTop: u(12) }}>{softBreak(c.name || m.untitled, 10, 8)}</Text>
              {values(c)}
              <View style={{ marginTop: u(8) }}>
                <ContrastLines ctx={ctx} c={c} />
              </View>
            </View>
          ),
        )}
      </View>
      {note}
    </View>
  );
}

function hostOf(url: string): string {
  return isHttpUrl(url) ? new URL(url).host.replace(/^www\./, '') : url;
}

function MockupsPdf({ ctx, section }: { ctx: Ctx; section: Extract<SectionVM, { kind: 'applications' }> }) {
  const { tokens, images } = ctx;
  const logo = (surface: string, height: number) => <LogoImg asset={logoForSurface(surface, section.logo, section.logoOnDark)} images={images} height={height} maxWidth={height * 4} />;
  return (
    <View>
      {section.mockups.map((m) => {
        const { background, text, accent } = m.colors;
        let body: ReactNode;
        switch (m.kind) {
          case 'business-card': {
            const backFg = readableOn(accent, tokens);
            const card = { width: u(300), minHeight: u(167), padding: u(20), borderRadius: 4, borderWidth: 0.5, borderColor: '#C9C6BE' } as const;
            body = (
              <View style={{ flexDirection: 'row' }}>
                <View style={{ ...card, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}>
                  {logo(background, 44)}
                  {!section.logo && <Text style={{ ...type(tokens.type.heading, 0.55), color: text, textAlign: 'center' }}>{s(section.brandName)}</Text>}
                </View>
                <View style={{ ...card, backgroundColor: accent, marginLeft: u(24), justifyContent: 'space-between' }}>
                  <View>
                    {m.personName ? <Text style={{ ...type(tokens.type.heading, 0.45), color: backFg }}>{s(m.personName)}</Text> : null}
                    {m.personRole ? <Text style={{ ...type(tokens.type.caption), color: backFg }}>{s(m.personRole)}</Text> : null}
                  </View>
                  <View style={{ marginTop: u(12) }}>
                    {m.phone ? <Text style={{ ...type(tokens.type.caption), color: backFg }}>{s(m.phone)}</Text> : null}
                    {section.contacts.email ? <Text style={{ ...type(tokens.type.caption), color: backFg }}>{s(section.contacts.email)}</Text> : null}
                    {section.contacts.website ? <Text style={{ ...type(tokens.type.caption), color: backFg }}>{s(hostOf(section.contacts.website))}</Text> : null}
                  </View>
                </View>
              </View>
            );
            break;
          }
          case 'social-post':
            body = (
              <View style={{ width: u(320), minHeight: u(320), backgroundColor: background, padding: u(28), justifyContent: 'space-between', borderWidth: 0.5, borderColor: '#C9C6BE' }}>
                <View style={{ width: u(48), height: u(6), backgroundColor: accent }} />
                <View style={{ marginVertical: u(16) }}>
                  {m.headline ? <Text style={{ ...type(tokens.type.heading, 0.8), color: text }}>{s(m.headline)}</Text> : null}
                  {m.caption ? <Text style={{ ...type(tokens.type.body), color: text, marginTop: u(10) }}>{s(m.caption)}</Text> : null}
                </View>
                {logo(background, 28)}
              </View>
            );
            break;
          case 'website-hero': {
            const ctaFg = readableOn(accent, tokens);
            body = (
              <View style={{ borderWidth: 0.75, borderColor: '#C9C6BE', borderRadius: 6, overflow: 'hidden' }}>
                <View style={{ height: u(28), backgroundColor: '#E9E7E1', flexDirection: 'row', alignItems: 'center', paddingHorizontal: u(12) }}>
                  {[0, 1, 2].map((i) => (
                    <View key={i} style={{ width: u(9), height: u(9), borderRadius: u(5), backgroundColor: '#C9C6BE', marginRight: u(6) }} />
                  ))}
                  {section.contacts.website ? <Text style={{ fontFamily: 'BF Noto Sans', fontSize: 8, lineHeight: 1.2, color: '#62615B', marginLeft: u(8) }}>{hostOf(section.contacts.website)}</Text> : null}
                </View>
                <View style={{ backgroundColor: background, paddingTop: u(20), paddingHorizontal: u(32), paddingBottom: u(40), minHeight: u(280) }}>
                  {logo(background, 26)}
                  <View style={{ width: '78%', marginTop: u(48) }}>
                    {m.headline ? <Text style={{ ...type(tokens.type.heading, 0.95), color: text }}>{s(m.headline)}</Text> : null}
                    {m.subheadline ? <Text style={{ ...type(tokens.type.body), color: text, marginTop: u(12) }}>{s(m.subheadline)}</Text> : null}
                    {m.ctaLabel ? (
                      <View style={{ flexDirection: 'row', marginTop: u(20) }}>
                        <Text style={{ ...type(tokens.type.body), fontWeight: 700, color: ctaFg, backgroundColor: accent, paddingVertical: u(10), paddingHorizontal: u(18), borderRadius: 3 }}>{s(m.ctaLabel)}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            );
            break;
          }
          case 'packaging-label':
            body = (
              <View style={{ width: u(340), minHeight: u(220), backgroundColor: background, borderRadius: u(14), borderWidth: u(6), borderColor: accent, padding: u(22), justifyContent: 'space-between' }}>
                {logo(background, 24)}
                <View style={{ marginVertical: u(12) }}>
                  {m.productName ? <Text style={{ ...type(tokens.type.heading, 0.7), color: text }}>{s(m.productName)}</Text> : null}
                  {m.descriptor ? <Text style={{ ...type(tokens.type.body), color: text, marginTop: u(6) }}>{s(m.descriptor)}</Text> : null}
                </View>
                {m.netContent ? <Text style={{ ...type(tokens.type.caption), color: text, alignSelf: 'flex-end', borderTopWidth: 1.5, borderTopColor: accent, paddingTop: u(4) }}>{s(m.netContent)}</Text> : null}
              </View>
            );
            break;
        }
        return (
          <View key={m.kind} wrap={false} style={{ marginBottom: u(40) }}>
            {body}
            <Text style={{ ...type(tokens.type.caption), marginTop: u(10) }}>{ctx.m.mockupCaptions[m.kind]}</Text>
          </View>
        );
      })}
    </View>
  );
}
