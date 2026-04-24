/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: new URL('.', import.meta.url).pathname,
  serverExternalPackages: ["ffmpeg-static"],
  /** Binário linux da Vercel: sem isto o ffmpeg-static pode faltar no trace da função serverless. */
  outputFileTracingIncludes: {
    "/api/crm/messages": ["./node_modules/ffmpeg-static/**/*"],
  },
};

export default nextConfig;

