<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes" />

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title><xsl:value-of select="/rss/channel/title" /> — RSS Feed</title>
        <style>
          :root {
            --bg: #ffffff;
            --bg-soft: #f6f6f7;
            --text-1: #1b1b1f;
            --text-2: rgba(60, 60, 67, 0.66);
            --text-3: rgba(60, 60, 67, 0.4);
            --border: #e2e2e3;
            --accent: #e54d2e;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #1b1b1f;
              --bg-soft: #202127;
              --text-1: rgba(255, 255, 245, 0.92);
              --text-2: rgba(235, 235, 245, 0.6);
              --text-3: rgba(235, 235, 245, 0.38);
              --border: #2e2e32;
              --accent: #ff6b4a;
            }
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 2rem 1.25rem 4rem;
            background: var(--bg);
            color: var(--text-1);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
          }
          .wrap { max-width: 42rem; margin: 0 auto; }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            font-size: 0.78rem;
            font-weight: 600;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: var(--accent);
            margin-bottom: 1rem;
          }
          .badge::before {
            content: "";
            width: 8px; height: 8px;
            border-radius: 50%;
            background: var(--accent);
          }
          h1 {
            font-size: clamp(1.75rem, 5vw, 2.5rem);
            line-height: 1.1;
            letter-spacing: -0.02em;
            margin: 0 0 0.5rem;
          }
          .lede { color: var(--text-2); font-size: 1.05rem; max-width: 38ch; margin: 0 0 1.5rem; }
          .notice {
            background: var(--bg-soft);
            border: 1px solid var(--border);
            border-radius: 0.6rem;
            padding: 0.9rem 1rem;
            font-size: 0.92rem;
            color: var(--text-2);
            margin-bottom: 2.5rem;
          }
          .notice code {
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 0.35rem;
            padding: 0.1rem 0.4rem;
            font-size: 0.85rem;
            color: var(--text-1);
            word-break: break-all;
          }
          ol { list-style: none; margin: 0; padding: 0; }
          li {
            border-top: 1px solid var(--border);
            padding: 1rem 0;
          }
          li:last-child { border-bottom: 1px solid var(--border); }
          a.title {
            color: var(--text-1);
            text-decoration: none;
            font-size: 1.15rem;
            font-weight: 600;
            letter-spacing: -0.01em;
          }
          a.title:hover { color: var(--accent); }
          .meta {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem 0.9rem;
            align-items: baseline;
            margin-top: 0.35rem;
            font-size: 0.82rem;
            color: var(--text-3);
          }
          .desc { margin: 0.45rem 0 0; color: var(--text-2); font-size: 0.95rem; }
          .cat {
            font-size: 0.72rem;
            color: var(--accent);
            background: var(--bg-soft);
            border: 1px solid var(--border);
            border-radius: 999px;
            padding: 0.1rem 0.55rem;
          }
          .empty { color: var(--text-3); font-style: italic; margin-top: 2rem; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <span class="badge">RSS Feed</span>
          <h1><xsl:value-of select="/rss/channel/title" /></h1>
          <p class="lede"><xsl:value-of select="/rss/channel/description" /></p>
          <div class="notice">
            <strong>This is a web feed</strong>, also known as an RSS feed.
            <strong>Subscribe</strong> by copying the URL from your address bar into your news reader.
            <br /><br />
            <code><xsl:value-of select="/rss/channel/link" />rss.xml</code>
          </div>

          <xsl:choose>
            <xsl:when test="count(/rss/channel/item) = 0">
              <p class="empty">No posts yet.</p>
            </xsl:when>
            <xsl:otherwise>
              <ol>
                <xsl:for-each select="/rss/channel/item">
                  <li>
                    <a class="title">
                      <xsl:attribute name="href"><xsl:value-of select="link" /></xsl:attribute>
                      <xsl:value-of select="title" />
                    </a>
                    <div class="meta">
                      <xsl:if test="pubDate">
                        <span><xsl:value-of select="pubDate" /></span>
                      </xsl:if>
                      <xsl:for-each select="category">
                        <span class="cat"><xsl:value-of select="." /></span>
                      </xsl:for-each>
                    </div>
                    <xsl:if test="description">
                      <p class="desc"><xsl:value-of select="description" /></p>
                    </xsl:if>
                  </li>
                </xsl:for-each>
              </ol>
            </xsl:otherwise>
          </xsl:choose>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
