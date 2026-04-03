# SAM の Metadata BuildMethod: makefile 用（ターゲット名 = build-<CloudFormation論理ID>）
build-ChatAgentFunction:
	npm ci
	npm run build
	mkdir -p "$(ARTIFACTS_DIR)"
	cp -r dist package.json package-lock.json "$(ARTIFACTS_DIR)/"
	cd "$(ARTIFACTS_DIR)" && npm ci --omit=dev
