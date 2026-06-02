/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Engine package ships TS source (no build step). Next must transpile it.
  transpilePackages: ["@dynamic-energy/engine"],
};

export default nextConfig;
