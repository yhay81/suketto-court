import type { Child } from "hono/jsx";

import { product } from "../config/product";

type LayoutProps = {
  bodyClass?: string;
  canonical?: string;
  children: Child;
  description?: string;
  noindex?: boolean;
  title?: string;
};

export function Layout({
  bodyClass = "",
  canonical = product.url,
  children,
  description = product.description,
  noindex = false,
  title = product.name,
}: LayoutProps) {
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    applicationCategory: product.applicationCategory,
    description,
    isAccessibleForFree: true,
    name: product.name,
    operatingSystem: "Any",
    url: product.url,
  });

  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta content="#123b31" name="theme-color" />
        <meta content={description} name="description" />
        {noindex ? <meta content="noindex,nofollow,noarchive" name="robots" /> : null}
        <meta content={description} property="og:description" />
        <meta content={product.ogImage} property="og:image" />
        <meta content={product.ogImageAlt} property="og:image:alt" />
        <meta content="ja_JP" property="og:locale" />
        <meta content={title} property="og:title" />
        <meta content="website" property="og:type" />
        <meta content={canonical} property="og:url" />
        <meta content="summary_large_image" name="twitter:card" />
        <link href={canonical} rel="canonical" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        <link href="/manifest.webmanifest" rel="manifest" />
        <link href="/styles.css?v=1" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: structuredData }} type="application/ld+json" />
        <title>{title}</title>
      </head>
      <body class={bodyClass}>
        <a class="skip-link" href="#main">
          本文へ移動
        </a>
        <header class="site-header">
          <a class="brand" href="/">
            <span aria-hidden="true" class="brand-court">
              <i></i>
              <b></b>
            </span>
            <span>助っ人コート</span>
          </a>
          <nav aria-label="メイン">
            <a href="/guide">使い方</a>
            <a class="nav-action" href="/#recruit">
              募集枠をつくる
            </a>
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer>
          <span>© 2026 助っ人コート</span>
          <nav aria-label="フッター">
            <a href="https://tools.yhay81.com">ほかのツール</a>
            <a href="/privacy">プライバシー</a>
            <a href="https://github.com/yhay81/suketto-court">GitHub</a>
          </nav>
        </footer>
      </body>
    </html>
  );
}
