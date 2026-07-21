import Document, { Html, Head, Main, NextScript } from "next/document";
import {
  DEFAULT_SYSTEM_BACKGROUND,
  loadSystemBackgroundFromEnv,
} from "../lib/systemColors";

export default function MyDocument({ systemBackground }) {
  const bg = systemBackground || DEFAULT_SYSTEM_BACKGROUND;

  return (
    <Html lang="en">
      <Head>
        {/* Render-blocking: first paint uses env SYSTEM_COLORS (no wrong-color flash) */}
        <link rel="stylesheet" href="/api/system/colors.css" />
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--system-page-bg:${bg};}html,body{background:var(--system-page-bg);background-attachment:fixed;}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var b=${JSON.stringify(bg)};document.documentElement.style.setProperty('--system-page-bg',b);sessionStorage.setItem('system-page-bg',b);}catch(e){}})();`,
          }}
        />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Font Awesome */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"
        />

        {/* Theme & App Settings */}
        <meta name="theme-color" content="#011E46" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Demo Full System" />
        <meta name="apple-touch-fullscreen" content="yes" />
        <meta property="og:title" content="Demo Full System" />
        <meta property="og:description" content="Demo Full System for Testing" />
        <meta property="og:image" content="/icons/apple-icon-180.png" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />

        {/* Camera Permission Policy */}
        <meta httpEquiv="Permissions-Policy" content="camera=(self)" />

        {/* Icons for iOS */}
        <link rel="apple-touch-icon" href="/icons/apple-icon-180.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

MyDocument.getInitialProps = async (ctx) => {
  const initialProps = await Document.getInitialProps(ctx);
  let systemBackground = DEFAULT_SYSTEM_BACKGROUND;
  try {
    systemBackground = loadSystemBackgroundFromEnv();
  } catch {
    /* keep default */
  }
  return { ...initialProps, systemBackground };
};
