#!/bin/bash
# Hermes-nyx installer / updater
# Usage: curl -fsSL https://raw.githubusercontent.com/Catlina-2B/hermes-nyx/main/install.sh | bash
set -e

REPO="Catlina-2B/hermes-nyx"
APP_NAME="Hermes-nyx"
INSTALL_DIR="/Applications"

G='\033[0;32m' C='\033[0;36m' R='\033[0;31m' D='\033[0;90m' N='\033[0m'

echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo -e "${C}  ${APP_NAME} Installer${N}"
echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  ARCH_LABEL="arm64"
elif [ "$ARCH" = "x86_64" ]; then
  ARCH_LABEL="x64"
else
  echo -e "${R}不支持的架构: ${ARCH}${N}"
  exit 1
fi
echo -e "${D}  架构: ${ARCH_LABEL}${N}"

# Check current version
CURRENT_VERSION=""
PLIST="${INSTALL_DIR}/${APP_NAME}.app/Contents/Info.plist"
if [ -f "$PLIST" ]; then
  CURRENT_VERSION=$(/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" "$PLIST" 2>/dev/null || echo "")
  echo -e "${D}  当前版本: ${CURRENT_VERSION:-未安装}${N}"
fi

# Fetch latest release info
echo -e "${D}  正在检查最新版本...${N}"
RELEASE_JSON=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null || echo "")
if [ -z "$RELEASE_JSON" ]; then
  echo -e "${R}无法获取版本信息，请检查网络连接${N}"
  exit 1
fi

LATEST_VERSION=$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"v\{0,1\}\([^"]*\)".*/\1/')
echo -e "${G}  最新版本: ${LATEST_VERSION}${N}"

if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
  echo -e "${G}  已是最新版本，无需更新${N}"
  exit 0
fi

# Find DMG download URL
DMG_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep -i "${ARCH_LABEL}.*\.dmg\|\.dmg.*${ARCH_LABEL}" | head -1 | sed 's/.*"browser_download_url": *"\([^"]*\)".*/\1/')
if [ -z "$DMG_URL" ]; then
  # Fallback: try any DMG
  DMG_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep '\.dmg"' | head -1 | sed 's/.*"browser_download_url": *"\([^"]*\)".*/\1/')
fi

if [ -z "$DMG_URL" ]; then
  echo -e "${R}未找到 DMG 下载链接${N}"
  exit 1
fi

DMG_FILE=$(basename "$DMG_URL")
TMP_DIR=$(mktemp -d)
DMG_PATH="${TMP_DIR}/${DMG_FILE}"

# Download
echo -e "${C}  正在下载 ${DMG_FILE}...${N}"
curl -fSL --progress-bar -o "$DMG_PATH" "$DMG_URL"

# Close running app
if pgrep -f "${APP_NAME}" > /dev/null 2>&1; then
  echo -e "${D}  正在关闭运行中的 ${APP_NAME}...${N}"
  pkill -f "${APP_NAME}" 2>/dev/null || true
  sleep 2
fi

# Mount and install
echo -e "${C}  正在安装...${N}"
MOUNT_POINT=$(hdiutil attach "$DMG_PATH" -nobrowse -quiet | tail -1 | awk '{print $NF}')
if [ -z "$MOUNT_POINT" ] || [ ! -d "$MOUNT_POINT" ]; then
  # Fallback: find mount point
  MOUNT_POINT="/Volumes/${APP_NAME}"
fi

APP_SRC="${MOUNT_POINT}/${APP_NAME}.app"
if [ ! -d "$APP_SRC" ]; then
  # Try to find .app in mount point
  APP_SRC=$(find "$MOUNT_POINT" -maxdepth 1 -name "*.app" | head -1)
fi

if [ -z "$APP_SRC" ] || [ ! -d "$APP_SRC" ]; then
  echo -e "${R}DMG 中未找到 .app 文件${N}"
  hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
  rm -rf "$TMP_DIR"
  exit 1
fi

# Remove old and copy new
rm -rf "${INSTALL_DIR}/${APP_NAME}.app"
cp -R "$APP_SRC" "${INSTALL_DIR}/"

# Unmount and cleanup
hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
rm -rf "$TMP_DIR"

# Remove quarantine attribute
xattr -rd com.apple.quarantine "${INSTALL_DIR}/${APP_NAME}.app" 2>/dev/null || true

echo -e "${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
if [ -n "$CURRENT_VERSION" ]; then
  echo -e "${G}  更新完成: ${CURRENT_VERSION} → ${LATEST_VERSION}${N}"
else
  echo -e "${G}  安装完成: v${LATEST_VERSION}${N}"
fi
echo -e "${D}  位置: ${INSTALL_DIR}/${APP_NAME}.app${N}"
echo -e "${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"

# Ask to launch
read -p "  是否立即启动？(Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
  open "${INSTALL_DIR}/${APP_NAME}.app"
fi
