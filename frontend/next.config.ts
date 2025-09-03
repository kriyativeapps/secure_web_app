import type { NextConfig } from "next";
import * as path from "path";

const nextConfig: NextConfig = {
  env: {
    // Load .env from parent directory
    ...require('dotenv').config({ path: path.join(process.cwd(), '..', '.env') }).parsed
  }
};

export default nextConfig;
