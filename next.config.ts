import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/school-guide/images/[fileName]": ["./private/school-guide/**/*"],
  },
  async rewrites() {
    return [
      {
        source: "/school-guide/:fileName",
        destination: "/api/school-guide/images/:fileName",
      },
    ];
  },
};

export default nextConfig;
