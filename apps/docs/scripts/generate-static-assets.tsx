import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { generate as DefaultImage } from 'fumadocs-ui/og';
import { getPageImage, source } from '@/lib/source';

const publicDir = path.join(process.cwd(), 'public');
const llmsPath = path.join(publicDir, 'llms-full.txt');
const ogDir = path.join(publicDir, 'og', 'docs');

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

await mkdir(publicDir, { recursive: true });
await Promise.all([generateLlmsText(), generateOgImages()]);
