#!/usr/bin/env bash
# SAM デプロイ + InvokeMode: RESPONSE_STREAM の post-deploy 設定
# AWS::ApiGatewayV2::Integration に InvokeMode が CFN スキーマ未対応のため CLI で設定する
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
  "$@"   # -- 追加引数（例: --parameter-overrides AnthropicApiKey=sk-ant-...）

echo ""
echo "=== Outputs 取得 ==="
API_ID=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='ChatHttpApiId'].OutputValue" \
  --output text)

INTEGRATION_ID=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='ChatLambdaIntegrationId'].OutputValue" \
  --output text)

API_URL=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='HttpApiUrl'].OutputValue" \
  --output text)

echo "  ApiId         : ${API_ID}"
echo "  IntegrationId : ${INTEGRATION_ID}"
echo "  HttpApiUrl    : ${API_URL}"

echo ""
echo "=== InvokeMode: RESPONSE_STREAM を設定 ==="
aws apigatewayv2 update-integration \
  --api-id "${API_ID}" \
  --integration-id "${INTEGRATION_ID}" \
  --invoke-mode RESPONSE_STREAM \
  --region "${REGION}" \
  --output json | jq -r '.InvokeMode'

echo ""
echo "=== デプロイ完了 ==="
echo ""
echo "Amplify の環境変数に設定してください:"
echo "  AGENT_API_URL=${API_URL}"
echo ""
echo "API_URL をファイルに保存..."
echo "${API_URL}" > "${SCRIPT_DIR}/.api-url"
echo "  → ${SCRIPT_DIR}/.api-url"
