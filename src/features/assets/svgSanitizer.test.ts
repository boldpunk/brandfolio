// @vitest-environment jsdom
import markSvg from '@/tests/fixtures/mark.svg?raw';
import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from './svgSanitizer';

const wrap = (body: string, attrs = 'viewBox="0 0 100 100"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${attrs}>${body}</svg>`;

function ok(source: string) {
  const result = sanitizeSvg(source);
  if (!result.ok) throw new Error(`expected ok, got: ${result.reason}`);
  return result;
}
function refused(source: string) {
  const result = sanitizeSvg(source);
  expect(result.ok).toBe(false);
  return result.ok ? '' : result.reason;
}

describe('sanitizeSvg', () => {
  it('keeps a simple logo and its size', () => {
    const r = ok(markSvg);
    expect(r.width).toBe(120);
    expect(r.height).toBe(120);
    expect(r.svg).toContain('<rect');
    expect(r.svg).toContain('fill="#B65C3A"');
  });

  it('removes scripts and event handlers', () => {
    const r = ok(wrap('<script>alert(1)</script><rect width="10" height="10" onclick="alert(1)" onload="x()"/>', 'viewBox="0 0 10 10" onload="alert(2)"'));
    expect(r.svg).not.toMatch(/script|onclick|onload|alert/i);
  });

  it('refuses foreignObject', () => {
    expect(refused(wrap('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>'))).toMatch(/foreignObject/);
  });

  it('refuses DOCTYPE and entities', () => {
    const xxe = '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + wrap('<text>&x;</text>');
    expect(refused(xxe)).toMatch(/DOCTYPE/);
  });

  it('refuses external hrefs and css url()', () => {
    refused(wrap('<use href="https://evil.example/x.svg#a"/>'));
    refused(wrap('<use xlink:href="data:image/svg+xml;base64,AAAA"/>'));
    refused(wrap('<rect width="1" height="1" fill="url(https://evil.example/p)"/>'));
    refused(wrap('<rect width="1" height="1" style="fill:url(//evil.example/p)"/>'));
    refused(wrap('<rect width="1" height="1" style="fill:red;background:url(x)"/>'));
  });

  it('keeps internal gradient references', () => {
    const r = ok(wrap('<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/>'));
    expect(r.svg).toContain('url(#g)');
    expect(r.svg).toContain('linearGradient');
  });

  it('refuses dangling internal references', () => {
    refused(wrap('<rect width="10" height="10" fill="url(#missing)"/>'));
  });

  it('refuses features it cannot keep, suggesting PNG', () => {
    expect(refused(wrap('<text x="0" y="10">FORMA</text>'))).toMatch(/кривые.*PNG/s);
    expect(refused(wrap('<image href="x.png" width="10" height="10"/>'))).toMatch(/растровое/);
    expect(refused(wrap('<style>rect{fill:red}</style><rect width="1" height="1"/>'))).toMatch(/style/);
  });

  it('drops editor metadata namespaces', () => {
    const r = ok(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 10 10" inkscape:version="1"><metadata>x</metadata><inkscape:grid/><rect width="10" height="10"/></svg>',
    );
    expect(r.svg).not.toMatch(/inkscape|metadata/);
  });

  it('refuses broken files and non-svg', () => {
    refused('<svg xmlns="http://www.w3.org/2000/svg"><rect></svg>');
    refused('<html><body>hi</body></html>');
    refused('not xml at all');
  });

  it('requires size information', () => {
    expect(refused(wrap('<rect width="1" height="1"/>', ''))).toMatch(/viewBox/);
  });

  it('limits complexity', () => {
    expect(refused(wrap('<rect width="1" height="1"/>'.repeat(5001)))).toMatch(/5000/);
    const deep = '<g>'.repeat(70) + '<rect width="1" height="1"/>' + '</g>'.repeat(70);
    expect(refused(wrap(deep))).toMatch(/вложен/);
  });
});
