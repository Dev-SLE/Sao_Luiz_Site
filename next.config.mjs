/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: new URL('.', import.meta.url).pathname,
  serverExternalPackages: ["ffmpeg-static"],
};

export default nextConfig;

