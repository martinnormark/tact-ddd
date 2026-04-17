import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { generate as DefaultImage } from 'fumadocs-ui/og';
import { getPageImage, source } from '@/lib/source';
import { BASE_PATH, SITE_ORIGIN } from '@/lib/site';

const publicDir = path.join(process.cwd(), 'public');
const llmsPath = path.join(publicDir, 'llms-full.txt');
const ogDir = path.join(publicDir, 'og', 'docs');
const sitemapPath = path.join(publicDir, 'sitemap.xml');
const robotsPath = path.join(publicDir, 'robots.txt');

function parseFrontmatter(raw: string): {
	readonly content: string;
	readonly description?: string;
	readonly title?: string;
} {
	const match = raw.match(/^---\n([\s\S]*?)\n---\n*/);

	if (!match) {
		return { content: raw.trim() };
	}

	const frontmatter = match[1];
	const content = raw.slice(match[0].length).trim();
	const title = frontmatter.match(/^title:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
	const description = frontmatter
		.match(/^description:\s*(.+)$/m)?.[1]
		?.trim()
		.replace(/^['"]|['"]$/g, '');

	return { content, description, title };
}

async function generateLlmsText() {
	const pages = source.getPages();
	const scanned = await Promise.all(
		pages.map(async (page) => {
			const raw = await page.data.getText('raw');
			const { content, description, title } = parseFrontmatter(raw);
			const resolvedTitle = title ?? (page.url === '/docs' ? 'Documentation' : page.url.split('/').at(-1)?.replace(/-/g, ' ') ?? 'Document');
			const summary = description ? `${description}\n\n` : '';

			return `# ${resolvedTitle}\n\n${summary}${content}`;
		}),
	);

	await writeFile(llmsPath, `${scanned.join('\n\n')}\n`);
}

async function generateOgImages() {
	await rm(ogDir, { force: true, recursive: true });

	for (const page of source.getPages()) {
		const raw = await page.data.getText('raw');
		const { description, title } = parseFrontmatter(raw);
		const image = getPageImage(page);
		const filePath = path.join(ogDir, ...image.segments);
		const response = new ImageResponse(
			(
				<DefaultImage
					description={description}
					site="tact-ddd"
					title={title ?? 'tact-ddd'}
				/>
			),
			{
				height: 630,
				width: 1200,
			},
		);

		await mkdir(path.dirname(filePath), { recursive: true });
		await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
	}
}

function canonicalUrl(urlPath: string): string {
	const withBase = BASE_PATH ? `${BASE_PATH}${urlPath}` : urlPath;
	const withSlash = withBase.endsWith('/') ? withBase : `${withBase}/`;

	return `${SITE_ORIGIN}${withSlash}`;
}

async function generateSitemap() {
	const pages = source.getPages();

	const urls = [
		canonicalUrl('/'),
		...pages.map((page) => canonicalUrl(page.url)),
	];

	const xml = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...urls.map((loc) => `  <url>\n    <loc>${loc}</loc>\n  </url>`),
		'</urlset>',
		'',
	].join('\n');

	await writeFile(sitemapPath, xml);
}

async function generateRobotsTxt() {
	const sitemapUrl = canonicalUrl('/sitemap.xml').replace(/\/$/, '');

	const aiBots = [
		'GPTBot',
		'OAI-SearchBot',
		'Claude-Web',
		'anthropic-ai',
		'Google-Extended',
		'Amazonbot',
		'Applebot-Extended',
		'Bytespider',
		'CCBot',
	];

	const aiRules = aiBots
		.map((bot) => `User-agent: ${bot}\nAllow: /\nDisallow: /api/`)
		.join('\n\n');

	const content = [
		'# robots.txt – tact-ddd documentation',
		'# https://www.rfc-editor.org/rfc/rfc9309',
		'',
		'User-agent: *',
		'Allow: /',
		'Disallow: /api/',
		'',
		'# AI crawlers – explicitly allowed for open-source documentation',
		aiRules,
		'',
		`Sitemap: ${sitemapUrl}`,
		'',
	].join('\n');

	await writeFile(robotsPath, content);
}

await mkdir(publicDir, { recursive: true });
await Promise.all([generateLlmsText(), generateOgImages(), generateSitemap(), generateRobotsTxt()]);
