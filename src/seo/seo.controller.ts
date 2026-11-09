import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { BlogService } from '../blog/blog.service';
import { baseUrl } from '../common/request';
import { excerpt } from '../common/view-helpers';

function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

@Controller()
export class SeoController {
  constructor(private readonly blogService: BlogService) {}

  @Get('rss.xml')
  async rss(@Req() req: Request, @Res() res: Response): Promise<void> {
    const site = baseUrl(req);
    const posts = await this.blogService.findRecents(20);
    const items = posts
      .map(
        (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${site}/single_post/${encodeURIComponent(post.slug)}</link>
      <guid isPermaLink="true">${site}/single_post/${encodeURIComponent(post.slug)}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <description>${escapeXml(excerpt(post.content, 400))}</description>
      <author>${escapeXml(post.postUser?.name ?? 'Anonymous')}</author>
    </item>`,
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>PhotographItem Blog</title>
    <link>${site}/blog</link>
    <description>Últimos artículos del blog de fotografía.</description>
    <language>es</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

    res.type('application/rss+xml').send(xml);
  }

  @Get('sitemap.xml')
  async sitemap(@Req() req: Request, @Res() res: Response): Promise<void> {
    const site = baseUrl(req);
    const [posts, categories] = await Promise.all([
      this.blogService.findRecents(1000),
      this.blogService.listCategories(),
    ]);

    const urls = [
      '',
      '/about',
      '/blog',
      '/contact',
      '/login',
      '/register',
      ...posts.map((post) => `/single_post/${encodeURIComponent(post.slug)}`),
      ...categories
        .filter((category) => category.slug)
        .map(
          (category) =>
            `/blog/categoria/${encodeURIComponent(category.slug)}`,
        ),
    ];

    const entries = urls
      .map(
        (url) => `  <url>
    <loc>${site}${url}</loc>
    <changefreq>${url === '' ? 'daily' : 'weekly'}</changefreq>
    <priority>${url === '' ? '1.0' : '0.7'}</priority>
  </url>`,
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;

    res.type('application/xml').send(xml);
  }

  @Get('robots.txt')
  robots(@Req() req: Request, @Res() res: Response): void {
    const site = baseUrl(req);
    res
      .type('text/plain')
      .send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${site}/sitemap.xml\n`);
  }
}
