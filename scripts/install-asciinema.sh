#!/usr/bin/env bash
set -euo pipefail

INSTALL_BIN="./.dg/bin"
WRAPPER="$INSTALL_BIN/asciinema"
VERSION="2.4.0"

mkdir -p "$INSTALL_BIN"

echo "🚀 Installing asciinema $VERSION..."

# check if installed and version matches
if command -v asciinema >/dev/null 2>&1; then
  INSTALLED_VERSION=$(asciinema --version | awk '{print $2}')
  if [[ "$INSTALLED_VERSION" == "$VERSION" ]]; then
    echo "✅ asciinema $VERSION is already installed globally."
    exit 0
  else
    echo "⚠️ Detected asciinema version $INSTALLED_VERSION (want $VERSION)"
  fi
fi

# check if has root permission
HAS_SUDO=0
if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  HAS_SUDO=1
elif [[ "$(id -u)" -eq 0 ]]; then
  HAS_SUDO=1
fi

# use apt or yum to install (if available)
if [[ "$HAS_SUDO" -eq 1 ]]; then
  if command -v apt-get >/dev/null 2>&1; then
    echo "📦 Installing via apt..."
    sudo apt-get update -y
    sudo apt-get install -y asciinema
    exit $?
  elif command -v yum >/dev/null 2>&1; then
    echo "📦 Installing via yum..."
    sudo yum install -y asciinema
    exit $?
  else
    echo "⚠️ No supported system package manager found."
  fi
fi

echo "🔒 No root access or no system installer available. Installing locally..."

# install asciinema to temporary directory
TEMP_DIR="$(mktemp -d)"
python3 -m pip install asciinema=="$VERSION" --target "$TEMP_DIR"

# create wrapper (directly execute Python module)
cat > "$WRAPPER" <<EOF
#!/usr/bin/env bash
PYTHONPATH="$TEMP_DIR" exec python3 -m asciinema "\$@"
EOF

chmod +x "$WRAPPER"

# verify local wrapper
if "$WRAPPER" --version | grep -q "$VERSION"; then
  echo "✅ asciinema $VERSION installed locally at $WRAPPER"
  echo "👉 You can run it using: $WRAPPER"
else
  echo "❌ Installation failed: unable to execute $WRAPPER"
  exit 1
fi
