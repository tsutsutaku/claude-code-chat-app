import type { NextConfig } from "next";

// AWS SDK をバンドルに含めると Lambda 上で認証プロバイダーが壊れ
// 「Could not load credentials from any providers」になることがある。
const nextConfig: NextConfig = {
  // このクライアントだけ外部化。credential-provider を別指定すると Turbopack が
  // Lambda で解決できないハッシュ付き external 参照を生成することがある。
  serverExternalPackages: ["@aws-sdk/client-bedrock-agentcore"],
};

export default nextConfig;
