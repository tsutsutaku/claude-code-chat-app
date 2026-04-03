import type { NextConfig } from "next";

// `serverExternalPackages` に SDK を入れると Turbopack が仮想パッケージ名を生成し、
// Lambda の `/var/task` で ERR_MODULE_NOT_FOUND になる。`claude-session.ts` の
// `pathToClaudeCodeExecutable` で cli.js を明示する。

const nextConfig: NextConfig = {};

export default nextConfig;
