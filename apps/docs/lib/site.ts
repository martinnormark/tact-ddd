function normalizeBasePath(basePath: string | undefined): string {
	if (!basePath || basePath === '/') {
		return '';
	}

	const normalized = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

	return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export const BASE_PATH = normalizeBasePath(
	process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.DOCS_BASE_PATH,
);

export const SITE_ORIGIN = (process.env.DOCS_SITE_ORIGIN ?? 'http://localhost:3000').replace(
	/\/$/,
	'',
);

export function withBasePath(path: string): string {
	if (!path.startsWith('/')) {
		return path;
	}

	if (!BASE_PATH) {
		return path;
	}

	return path === '/' ? BASE_PATH : `${BASE_PATH}${path}`;
}
