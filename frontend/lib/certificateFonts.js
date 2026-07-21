/**
 * Certificate text fonts.
 * `google` = Google Fonts family query (loaded in UI + embedded for PNG).
 * System fonts have no `google` key (rely on OS / sharp defaults).
 */

export const CERTIFICATE_FONTS = [
  { name: 'Arial' },
  { name: 'Helvetica' },
  { name: 'Times New Roman' },
  { name: 'Georgia' },
  { name: 'Verdana' },
  { name: 'Tahoma' },
  { name: 'Trebuchet MS' },
  { name: 'Courier New' },
  { name: 'Lucida Sans' },
  { name: 'Lucida Console' },
  { name: 'Palatino Linotype' },
  { name: 'Book Antiqua' },
  { name: 'Garamond' },
  { name: 'Comic Sans MS' },
  { name: 'Impact' },
  { name: 'Segoe UI' },
  { name: 'Calibri' },
  { name: 'Cambria' },
  { name: 'Candara' },
  { name: 'Consolas' },
  { name: 'Constantia' },
  { name: 'Corbel' },
  { name: 'Franklin Gothic Medium' },
  { name: 'Century Gothic' },
  { name: 'Brush Script MT' },
  // System Copperplate is not on the server — Cinzel is the web stand-in for PNG + preview
  { name: 'Copperplate', google: 'Cinzel:wght@400;700', cssFamily: 'Cinzel', weight: 700 },
  { name: 'Papyrus' },
  { name: 'Segoe Print' },
  { name: 'Segoe Script' },
  { name: 'Lucida Handwriting' },
  { name: 'Freestyle Script' },
  { name: 'Edwardian Script ITC' },
  { name: 'French Script MT' },
  { name: 'Vivaldi' },
  { name: 'Mistral' },
  // Google / web fonts (handwriting + display)
  { name: 'Handwriting', google: 'Dancing Script:wght@400;700', cssFamily: 'Dancing Script', weight: 400 },
  { name: 'Dancing Script', google: 'Dancing Script:wght@400;700', weight: 400 },
  { name: 'Pacifico', google: 'Pacifico', weight: 400 },
  { name: 'Great Vibes', google: 'Great Vibes', weight: 400 },
  { name: 'Satisfy', google: 'Satisfy', weight: 400 },
  { name: 'Caveat', google: 'Caveat:wght@400;700', weight: 400 },
  { name: 'Homemade Apple', google: 'Homemade Apple', weight: 400 },
  { name: 'Indie Flower', google: 'Indie Flower', weight: 400 },
  { name: 'Patrick Hand', google: 'Patrick Hand', weight: 400 },
  { name: 'Shadows Into Light', google: 'Shadows Into Light', weight: 400 },
  { name: 'Kalam', google: 'Kalam:wght@400;700', weight: 400 },
  { name: 'Sacramento', google: 'Sacramento', weight: 400 },
  { name: 'Allura', google: 'Allura', weight: 400 },
  { name: 'Alex Brush', google: 'Alex Brush', weight: 400 },
  { name: 'Yellowtail', google: 'Yellowtail', weight: 400 },
  { name: 'Lobster', google: 'Lobster', weight: 400 },
  { name: 'Roboto', google: 'Roboto:wght@400;700' },
  { name: 'Open Sans', google: 'Open Sans:wght@400;700' },
  { name: 'Montserrat', google: 'Montserrat:wght@400;700' },
  { name: 'Lato', google: 'Lato:wght@400;700' },
  { name: 'Poppins', google: 'Poppins:wght@400;700' },
  { name: 'Nunito', google: 'Nunito:wght@400;700' },
  { name: 'Raleway', google: 'Raleway:wght@400;700' },
  { name: 'Ubuntu', google: 'Ubuntu:wght@400;700' },
  { name: 'Oswald', google: 'Oswald:wght@400;700' },
  { name: 'Playfair Display', google: 'Playfair Display:wght@400;700' },
  { name: 'Merriweather', google: 'Merriweather:wght@400;700' },
  { name: 'Inter', google: 'Inter:wght@400;700' },
  { name: 'Bebas Neue', google: 'Bebas Neue' },
  { name: 'Anton', google: 'Anton' },
];

export const CERTIFICATE_FONT_NAMES = CERTIFICATE_FONTS.map((f) => f.name);

const byName = new Map(CERTIFICATE_FONTS.map((f) => [f.name, f]));

export function getCertificateFont(name) {
  return byName.get(String(name || '').trim()) || byName.get('Arial');
}

/** CSS font-family value for preview / select */
export function fontCssFamily(name) {
  const font = getCertificateFont(name);
  const family = font?.cssFamily || font?.name || 'Arial';
  const isScript =
    !!font?.google &&
    /Script|Vibes|Satisfy|Caveat|Pacifico|Handwriting|Apple|Flower|Yellowtail|Allura|Brush|Sacramento|Lobster/i.test(
      `${font.name} ${font.cssFamily || ''} ${font.google}`
    );
  if (isScript) {
    return `'${family}', cursive, Arial, sans-serif`;
  }
  return `'${family}', Arial, Helvetica, sans-serif`;
}

export function fontWeightFor(name) {
  const font = getCertificateFont(name);
  return font?.weight || 700;
}

/**
 * Google Fonts CSS2 URL covering all google-backed certificate fonts
 */
export function getCertificateGoogleFontsHref() {
  const families = [];
  const seen = new Set();
  CERTIFICATE_FONTS.forEach((f) => {
    if (!f.google || seen.has(f.google)) return;
    seen.add(f.google);
    families.push(`family=${String(f.google).replace(/ /g, '+')}`);
  });
  if (!families.length) return '';
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}

/** Optional direct TTF URLs (more reliable for sharp than CSS scraping). */
const FONT_FILE_URLS = {
  Handwriting:
    'https://cdn.jsdelivr.net/fontsource/fonts/dancing-script@5.2.5/latin-400-normal.ttf',
  'Dancing Script':
    'https://cdn.jsdelivr.net/fontsource/fonts/dancing-script@5.2.5/latin-400-normal.ttf',
  Copperplate: 'https://cdn.jsdelivr.net/fontsource/fonts/cinzel@5.2.5/latin-700-normal.ttf',
  Cinzel: 'https://cdn.jsdelivr.net/fontsource/fonts/cinzel@5.2.5/latin-700-normal.ttf',
  Pacifico: 'https://cdn.jsdelivr.net/fontsource/fonts/pacifico@5.2.5/latin-400-normal.ttf',
  'Great Vibes':
    'https://cdn.jsdelivr.net/fontsource/fonts/great-vibes@5.2.5/latin-400-normal.ttf',
  Satisfy: 'https://cdn.jsdelivr.net/fontsource/fonts/satisfy@5.2.5/latin-400-normal.ttf',
  Caveat: 'https://cdn.jsdelivr.net/fontsource/fonts/caveat@5.2.5/latin-400-normal.ttf',
  'Homemade Apple':
    'https://cdn.jsdelivr.net/fontsource/fonts/homemade-apple@5.2.5/latin-400-normal.ttf',
  'Indie Flower':
    'https://cdn.jsdelivr.net/fontsource/fonts/indie-flower@5.2.5/latin-400-normal.ttf',
  'Patrick Hand':
    'https://cdn.jsdelivr.net/fontsource/fonts/patrick-hand@5.2.5/latin-400-normal.ttf',
  'Shadows Into Light':
    'https://cdn.jsdelivr.net/fontsource/fonts/shadows-into-light@5.2.5/latin-400-normal.ttf',
  Kalam: 'https://cdn.jsdelivr.net/fontsource/fonts/kalam@5.2.5/latin-400-normal.ttf',
  Sacramento: 'https://cdn.jsdelivr.net/fontsource/fonts/sacramento@5.2.5/latin-400-normal.ttf',
  Allura: 'https://cdn.jsdelivr.net/fontsource/fonts/allura@5.2.5/latin-400-normal.ttf',
  'Alex Brush': 'https://cdn.jsdelivr.net/fontsource/fonts/alex-brush@5.2.5/latin-400-normal.ttf',
  Yellowtail: 'https://cdn.jsdelivr.net/fontsource/fonts/yellowtail@5.2.5/latin-400-normal.ttf',
  Lobster: 'https://cdn.jsdelivr.net/fontsource/fonts/lobster@5.2.5/latin-400-normal.ttf',
  Roboto: 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@5.2.5/latin-400-normal.ttf',
  'Open Sans': 'https://cdn.jsdelivr.net/fontsource/fonts/open-sans@5.2.5/latin-400-normal.ttf',
  Montserrat: 'https://cdn.jsdelivr.net/fontsource/fonts/montserrat@5.2.5/latin-400-normal.ttf',
  Lato: 'https://cdn.jsdelivr.net/fontsource/fonts/lato@5.2.5/latin-400-normal.ttf',
  Poppins: 'https://cdn.jsdelivr.net/fontsource/fonts/poppins@5.2.5/latin-400-normal.ttf',
  Nunito: 'https://cdn.jsdelivr.net/fontsource/fonts/nunito@5.2.5/latin-400-normal.ttf',
  Raleway: 'https://cdn.jsdelivr.net/fontsource/fonts/raleway@5.2.5/latin-400-normal.ttf',
  Ubuntu: 'https://cdn.jsdelivr.net/fontsource/fonts/ubuntu@5.2.5/latin-400-normal.ttf',
  Oswald: 'https://cdn.jsdelivr.net/fontsource/fonts/oswald@5.2.5/latin-400-normal.ttf',
  'Playfair Display':
    'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@5.2.5/latin-400-normal.ttf',
  Merriweather: 'https://cdn.jsdelivr.net/fontsource/fonts/merriweather@5.2.5/latin-400-normal.ttf',
  Inter: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5.2.5/latin-400-normal.ttf',
  'Bebas Neue': 'https://cdn.jsdelivr.net/fontsource/fonts/bebas-neue@5.2.5/latin-400-normal.ttf',
  Anton: 'https://cdn.jsdelivr.net/fontsource/fonts/anton@5.2.5/latin-400-normal.ttf',
};

/**
 * Resolve a TTF buffer for SVG embedding (server-side PNG generation).
 */
export async function loadGoogleFontBuffer(fontName) {
  const font = getCertificateFont(fontName);
  const requested = String(fontName || '').trim();
  const family = font?.cssFamily || font?.name || requested;
  const directUrl =
    FONT_FILE_URLS[requested] ||
    FONT_FILE_URLS[family] ||
    FONT_FILE_URLS[font?.name] ||
    null;

  // Allow loading by direct map even if font has no google key
  if (!font?.google && !directUrl) return null;

  try {
    if (directUrl) {
      const fontRes = await fetch(directUrl);
      if (fontRes.ok) {
        const buffer = Buffer.from(await fontRes.arrayBuffer());
        return { buffer, format: 'truetype', family: family || 'Dancing Script' };
      }
    }
  } catch {
    /* fall through to CSS scrape */
  }

  if (!font?.google) return null;

  const familyParam = font.google.includes(':') ? font.google : `${font.google}:wght@400`;
  const cssUrl = `https://fonts.googleapis.com/css2?family=${String(familyParam).replace(/ /g, '+')}&display=swap`;

  const cssRes = await fetch(cssUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)',
    },
  });
  if (!cssRes.ok) return null;
  const css = await cssRes.text();

  const urlMatch =
    css.match(/src:\s*url\(([^)]+\.(?:ttf|otf))\)/i) ||
    css.match(/src:\s*url\(([^)]+\.woff2?)\)/i);
  if (!urlMatch?.[1]) return null;

  const fontUrl = urlMatch[1].replace(/['"]/g, '');
  const fontRes = await fetch(fontUrl);
  if (!fontRes.ok) return null;
  const buffer = Buffer.from(await fontRes.arrayBuffer());
  const format = fontUrl.includes('.woff2')
    ? 'woff2'
    : fontUrl.includes('.woff')
      ? 'woff'
      : fontUrl.includes('.otf')
        ? 'opentype'
        : 'truetype';

  return { buffer, format, family };
}

/** Public URL for a downloadable TTF used by preview + PNG generation */
export function getFontFileUrl(fontName) {
  const font = getCertificateFont(fontName);
  const requested = String(fontName || '').trim();
  const family = font?.cssFamily || font?.name || requested;
  return (
    FONT_FILE_URLS[requested] ||
    FONT_FILE_URLS[family] ||
    FONT_FILE_URLS[font?.name] ||
    null
  );
}
