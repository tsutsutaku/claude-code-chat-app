#!/usr/bin/env bash
# SAM デプロイスクリプト（Lambda Function URL + RESPONSE_STREAM）
set -euo pipefail

STACK_NAME="${STACK_NAME:-sam-app}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== sam build ==="
sam build --template-file "${SCRIPT_DIR}/template.yaml"

echo ""
echo "=== sam deploy ==="
sam deploy \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --capabilities CAPABILITY_IAM \
  "$@"

echo ""
echo "=== Outputs 取得 ==="
API_URL=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='AgentApiUrl'].OutputValue" \
  --output text)

echo "  AgentApiUrl: ${API_URL}"

echo ""
echo "=== デプロイ完了 ==="
echo ""
echo "Amplify の環境変数に設定してください:"
echo "  AGENT_API_URL=${API_URL%/}"   # 末尾スラッシュを除去
echo ""

echo "${API_URL%/}" > "${SCRIPT_DIR}/.api-url"
echo "→ ${SCRIPT_DIR}/.api-url に保存"
