import type { NextConfig } from "next";

// Amplify の Lambda では `serverExternalPackages` に AWS SDK を入れると、Turbopack が
// `@aws-sdk/...-<hash>` の仮想パスで external 参照し、実行時にモジュールが見つからず落ちる。
// SDK はバンドルに含める（認証は Lambda の環境変数経由で default chain が効く）。

const nextConfig: NextConfig = {};

export default nextConfig;
