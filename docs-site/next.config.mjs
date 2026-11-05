import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Standalone output is what the Dockerfile copies into the runtime image.
  output: 'standalone',
};

export default withMDX(config);
