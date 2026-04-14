import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();
const basePath = process.env.DOCS_BASE_PATH?.replace(/\/$/, '') ?? '';

/** @type {import('next').NextConfig} */
const config = {
  assetPrefix: basePath || undefined,
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
  },
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true,
};

export default withMDX(config);
