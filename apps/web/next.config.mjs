/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Tell Next.js to transpile monorepo packages directly from source.
   * Without this, Vercel (and local builds) fail to resolve
   * @dynamic-energy/data and @dynamic-energy/engine because those
   * packages point directly to their .ts source files and are never
   * pre-compiled into dist/.
   */
  transpilePackages: [
    "@dynamic-energy/data",
    "@dynamic-energy/engine",
  ],
};

export default nextConfig;
