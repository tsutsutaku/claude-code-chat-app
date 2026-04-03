import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * バンドルで `import.meta.url` がチャンクを指すと `cli.js` が解決できず、
   * Claude Code 子プロセスが即終了する（Amplify Lambda / Vercel 等）。
   */
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
};

export default nextConfig;
