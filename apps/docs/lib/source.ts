import { docs } from 'fumadocs-mdx:collections/server';
import { type InferPageType, loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { withBasePath } from '@/lib/site';

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
	baseUrl: withBasePath('/docs'),
	source: docs.toFumadocsSource(),
	plugins: [lucideIconsPlugin()],
});

export function getPageImage(page: InferPageType<typeof source>) {
	const segments = [...page.slugs, 'image.png'];

	return {
		segments,
		url: withBasePath(`/og/docs/${segments.join('/')}`),
	};
}
