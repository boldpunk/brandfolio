import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { FONT_FAMILIES, pxToPt } from '@/domain/fonts';

/**
 * Stage-1 technical prototype: proves Cyrillic + Uzbek Latin glyphs, a
 * transparent PNG, a sanitized-then-rasterized SVG, a long wrapping paragraph,
 * page numbers and metadata before the real templates are built on top.
 */
const styles = StyleSheet.create({
  page: { padding: 56, fontFamily: FONT_FAMILIES['noto-sans'].cssFamily, fontSize: pxToPt(14), color: '#242424', backgroundColor: '#F3EFE7' },
  heading: { fontFamily: FONT_FAMILIES.manrope.cssFamily, fontWeight: 700, fontSize: pxToPt(40), marginBottom: 12 },
  serif: { fontFamily: FONT_FAMILIES['noto-serif'].cssFamily, fontSize: pxToPt(18), marginBottom: 16 },
  row: { flexDirection: 'row', gap: 16, marginVertical: 16 },
  swatch: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 110, height: 110, objectFit: 'contain' },
  caption: { fontSize: pxToPt(11), color: '#62615B', marginTop: 4 },
  // react-pdf resolves a unitless lineHeight against the Text's own fontSize
  // (default 18), not the inherited one, so both are always set together.
  paragraph: { fontSize: pxToPt(14), lineHeight: 1.5, marginBottom: 10 },
  footer: { position: 'absolute', bottom: 28, left: 56, right: 56, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#62615B' },
});

const LONG_PARAGRAPH =
  'Брендбук фиксирует правила, по которым бренд узнают в любом канале: на визитке, в соцсетях, на сайте и упаковке. ' +
  'Документ описывает логотип и охранное поле, палитру с проверкой контраста, типографику и тон общения. ' +
  'Текст этого абзаца специально длинный, чтобы проверить перенос строк, межстрочный интервал и продолжение на следующей странице без обрезки и наложений. ';

export type PrototypeImages = { png: Blob; svgRaster: Blob };

export function PrototypeDocument({ images }: { images: PrototypeImages }) {
  return (
    <Document title="Brandfolio — прототип PDF" author="Brandfolio" subject="Технический прототип" language="ru" creator="Brandfolio" producer="Brandfolio">
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>Прототип брендбука</Text>
        <Text style={styles.serif}>Кириллица: Съешь же ещё этих мягких французских булок, да выпей чаю. Ёё Йй Щщ Ъъ</Text>
        <Text style={styles.serif}>O‘zbekiston, G‘ijduvon, o‘, g‘ — Oʻzbekiston (U+02BB)</Text>
        <View style={styles.row}>
          {(['#F3EFE7', '#242424', '#8C9A82'] as const).map((bg) => (
            <View key={bg}>
              <View style={[styles.swatch, { backgroundColor: bg }]}>
                <Image src={images.png} style={styles.logo} />
              </View>
              <Text style={styles.caption}>PNG с прозрачностью на {bg}</Text>
            </View>
          ))}
        </View>
        <View style={styles.row} wrap={false}>
          <View>
            <View style={[styles.swatch, { backgroundColor: '#FFFFFF' }]}>
              <Image src={images.svgRaster} style={styles.logo} />
            </View>
            <Text style={styles.caption}>SVG после очистки, растр 1600 px</Text>
          </View>
        </View>
        {Array.from({ length: 9 }, (_, i) => (
          <Text key={i} style={styles.paragraph}>
            {i + 1}. {LONG_PARAGRAPH}
          </Text>
        ))}
        <Text style={styles.paragraph}>Длинный URL: https://example.com/brand/guidelines/very/long/path/that/should/not/overflow</Text>
        <View style={styles.footer} fixed>
          <Text>Brandfolio · прототип</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
