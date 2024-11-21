
  /** @type {import('next').NextConfig} */
  const nextConfig = process.env.NODE_ENV === 'development' ?
    {
      reactStrictMode: true,
      trailingSlash: true
    } :
    {
      output: 'export',
      distDir: 'out',
      reactStrictMode: true,
      trailingSlash: true
    };

  export default nextConfig;
