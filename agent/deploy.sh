#!/usr/bin/env bash
# （任意）Bedrock AgentCore へコンテナ手動デプロイ。本番は agent/sam（Lambda+API Gateway）を推奨。
# AgentCore ChatAgent — 手動デプロイスクリプト
# 使い方: ./deploy.sh [--update]
#   --update: 既存 runtime を更新（新しいイメージを push してバージョンを作成）
set -euo pipefail

# ── 設定 ────────────────────────────────────────────────────────────────────
AWS_ACCOUNT_ID="043928387950"
AWS_REGION="us-east-1"
ECR_REPO_NAME="agentcore-chat-agent"
AGENT_RUNTIME_NAME="ChatAgent"
IAM_ROLE_NAME="AgentCoreExecutionRole"
IMAGE_TAG="latest"

UPDATE_MODE=false
if [[ "${1:-}" == "--update" ]]; then
  UPDATE_MODE=true
fi

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHAT_AGENT_DIR="${SCRIPT_DIR}/app/ChatAgent"
IAM_DIR="${SCRIPT_DIR}/iam"

echo "=== AgentCore ChatAgent デプロイ ==="
echo "Account : ${AWS_ACCOUNT_ID}"
echo "Region  : ${AWS_REGION}"
echo "ECR URI : ${ECR_URI}:${IMAGE_TAG}"
echo ""

# ── 1. ECR リポジトリ作成（既存の場合はスキップ） ────────────────────────
echo "[1/6] ECR リポジトリの確認 / 作成..."
if aws ecr describe-repositories \
    --repository-names "${ECR_REPO_NAME}" \
    --region "${AWS_REGION}" > /dev/null 2>&1; then
  echo "  → 既存リポジトリを使用: ${ECR_REPO_NAME}"
else
  aws ecr create-repository \
    --repository-name "${ECR_REPO_NAME}" \
    --region "${AWS_REGION}" \
    --image-scanning-configuration scanOnPush=true \
    --output json | jq -r '.repository.repositoryUri'
  echo "  → 作成完了"
fi

# ── 2. Docker イメージのビルド & ECR へ push ────────────────────────────────
echo ""
echo "[2/6] Docker イメージをビルド (linux/amd64)..."
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin \
    "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

docker build \
  --platform linux/arm64 \
  -t "${ECR_URI}:${IMAGE_TAG}" \
  "${CHAT_AGENT_DIR}"

echo ""
echo "[3/6] ECR へ push..."
docker push "${ECR_URI}:${IMAGE_TAG}"

# ── 3. IAM ロール作成（既存の場合はスキップ） ────────────────────────────
echo ""
echo "[4/6] IAM 実行ロールの確認 / 作成..."
if ROLE_ARN=$(aws iam get-role \
    --role-name "${IAM_ROLE_NAME}" \
    --query 'Role.Arn' --output text 2>/dev/null); then
  echo "  → 既存ロールを使用: ${ROLE_ARN}"
else
  ROLE_ARN=$(aws iam create-role \
    --role-name "${IAM_ROLE_NAME}" \
    --assume-role-policy-document "file://${IAM_DIR}/agentcore-trust-policy.json" \
    --query 'Role.Arn' --output text)
  echo "  → ロール作成: ${ROLE_ARN}"

  aws iam put-role-policy \
    --role-name "${IAM_ROLE_NAME}" \
    --policy-name "AgentCoreExecutionPolicy" \
    --policy-document "file://${IAM_DIR}/agentcore-execution-policy.json"
  echo "  → インラインポリシー適用"

  # IAM ロールの伝播待ち
  echo "  → IAM ロール伝播待ち (10s)..."
  sleep 10
fi

# ── 4. AgentCore Runtime 作成 or 更新 ────────────────────────────────────
echo ""
if [ "${UPDATE_MODE}" = false ]; then
  echo "[5/6] AgentCore Runtime を作成..."

  # 環境変数の確認（必須）
  : "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY が未設定です}"

  ENV_VARS="ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"
  if [ -n "${LANGFUSE_SECRET_KEY:-}" ]; then
    ENV_VARS="${ENV_VARS},LANGFUSE_SECRET_KEY=${LANGFUSE_SECRET_KEY}"
  fi
  if [ -n "${LANGFUSE_PUBLIC_KEY:-}" ]; then
    ENV_VARS="${ENV_VARS},LANGFUSE_PUBLIC_KEY=${LANGFUSE_PUBLIC_KEY}"
  fi
  if [ -n "${LANGFUSE_BASE_URL:-}" ]; then
    ENV_VARS="${ENV_VARS},LANGFUSE_BASE_URL=${LANGFUSE_BASE_URL}"
  fi

  RUNTIME_RESULT=$(aws bedrock-agentcore-control create-agent-runtime \
    --agent-runtime-name "${AGENT_RUNTIME_NAME}" \
    --agent-runtime-artifact "containerConfiguration={containerUri=${ECR_URI}:${IMAGE_TAG}}" \
    --role-arn "${ROLE_ARN}" \
    --network-configuration "networkMode=PUBLIC" \
    --protocol-configuration "serverProtocol=HTTP" \
    --environment-variables "${ENV_VARS}" \
    --region "${AWS_REGION}" \
    --output json)

  RUNTIME_ID=$(echo "${RUNTIME_RESULT}" | jq -r '.agentRuntimeId')
  RUNTIME_ARN=$(echo "${RUNTIME_RESULT}" | jq -r '.agentRuntimeArn')
  echo "  → Runtime ID : ${RUNTIME_ID}"
  echo "  → Runtime ARN: ${RUNTIME_ARN}"

  # ── 5. Runtime が READY になるまで待機 ──────────────────────────────
  echo ""
  echo "[5.5/6] Runtime が READY になるまで待機..."
  for i in $(seq 1 30); do
    CURRENT_STATUS=$(aws bedrock-agentcore-control get-agent-runtime \
      --agent-runtime-id "${RUNTIME_ID}" \
      --region "${AWS_REGION}" \
      --query 'status' --output text 2>/dev/null || echo "UNKNOWN")
    echo "  → [${i}/30] status: ${CURRENT_STATUS}"
    if [ "${CURRENT_STATUS}" = "READY" ]; then
      break
    fi
    if [ "${CURRENT_STATUS}" = "FAILED" ]; then
      echo "ERROR: Runtime が FAILED 状態になりました"
      exit 1
    fi
    sleep 20
  done
  if [ "${CURRENT_STATUS}" != "READY" ]; then
    echo "ERROR: タイムアウト (${CURRENT_STATUS}). 手動で確認してください:"
    echo "  aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id ${RUNTIME_ID} --region ${AWS_REGION}"
    exit 1
  fi

  # ── 6. Endpoint 作成 ──────────────────────────────────────────────────
  echo ""
  echo "[6/6] AgentCore Endpoint を作成..."
  ENDPOINT_RESULT=$(aws bedrock-agentcore-control create-agent-runtime-endpoint \
    --agent-runtime-id "${RUNTIME_ID}" \
    --name "default" \
    --region "${AWS_REGION}" \
    --output json)

  ENDPOINT_STATUS=$(echo "${ENDPOINT_RESULT}" | jq -r '.status')
  echo "  → Endpoint status: ${ENDPOINT_STATUS}"

  echo ""
  echo "=== デプロイ完了 ==="
  echo ""
  echo "Amplify の環境変数に設定してください:"
  echo "  AGENTCORE_AGENT_ARN=${RUNTIME_ARN}"
  echo "  AWS_REGION=${AWS_REGION}"
  echo ""
  echo "Runtime ARN をファイルに保存しています..."
  echo "${RUNTIME_ARN}" > "${SCRIPT_DIR}/.runtime-arn"
  echo "  → ${SCRIPT_DIR}/.runtime-arn"

else
  echo "[5/6] AgentCore Runtime を更新（新バージョン作成）..."

  if [ ! -f "${SCRIPT_DIR}/.runtime-arn" ]; then
    echo "ERROR: .runtime-arn が見つかりません。先に通常デプロイを実行してください。"
    exit 1
  fi

  RUNTIME_ARN=$(cat "${SCRIPT_DIR}/.runtime-arn")
  RUNTIME_ID=$(aws bedrock-agentcore-control list-agent-runtimes \
    --region "${AWS_REGION}" \
    --query "agentRuntimes[?agentRuntimeArn=='${RUNTIME_ARN}'].agentRuntimeId" \
    --output text)

  echo "  → Runtime ID: ${RUNTIME_ID}"

  aws bedrock-agentcore-control update-agent-runtime \
    --agent-runtime-id "${RUNTIME_ID}" \
    --agent-runtime-artifact "containerConfiguration={containerUri=${ECR_URI}:${IMAGE_TAG}}" \
    --role-arn "${ROLE_ARN}" \
    --network-configuration "networkMode=PUBLIC" \
    --region "${AWS_REGION}" \
    --output json > /dev/null

  echo "  → Runtime 更新完了"
  echo ""
  echo "[6/6] 完了（Endpoint は変わりません）"
  echo ""
  echo "=== 更新完了 ==="
fi
