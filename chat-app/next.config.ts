import type { NextConfig } from "next";

// AWS SDK をバンドルに含めると Lambda 上で認証プロバイダーが壊れ
// 「Could not load credentials from any providers」になることがある。
const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@aws-sdk/client-bedrock-agentcore",
    "@aws-sdk/credential-provider-node",
    "@smithy/node-http-handler",
  ],
};

export default nextConfig;
