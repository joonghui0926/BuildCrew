import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const applicationDirectory = path.dirname(fileURLToPath(import.meta.url));
const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "export",
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: path.resolve(applicationDirectory, "../.."),
  },
};

export default nextConfig;
