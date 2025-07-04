#!/usr/bin/env bash

function get_termsvg() {
  local DIST=""
  local EXT=""
  local FILENAME=""
  local KERNEL=""
  local MACHINE=""
  local TMP_DIR=""
  local URL=""
  local TAG=""
  local VER=""
  local INSTALL_DIR=""

  # Determine installation directory based on user ID
  if [ "$(id -u)" -eq 0 ]; then
    INSTALL_DIR="/usr/local/bin"
    echo "Running as root. termsvg will be installed to ${INSTALL_DIR}"
  else
    # macOS lacks `readlink -f`, use portable method
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    INSTALL_DIR="${SCRIPT_DIR}/.dg/bin"
    echo "Running as non-root user. termsvg will be installed to ${INSTALL_DIR}"
    mkdir -p "${INSTALL_DIR}"
  fi

  # Get the latest released tag_name from GitHub API
  TAG=$(curl -sL https://api.github.com/repos/mrmarble/termsvg/releases \
        | grep tag_name | head -n1 | cut -d'"' -f4)

  if [ -n "${TAG}" ]; then
    URL="https://github.com/MrMarble/termsvg/releases/download/${TAG}"
    VER="${TAG:1}"
  else
    echo "ERROR! Failed to retrieve latest termsvg version."
    exit 1
  fi

  # Detect kernel and architecture
  KERNEL=$(uname -s)
  MACHINE=$(uname -m)

  # Determine the target distrubution
  if [ "${KERNEL}" == "Linux" ]; then
    EXT="tar.gz"
    if [ "${MACHINE}" == "i386" ]; then
      DIST="linux-386"
    elif [ "${MACHINE}" == "x86_64" ]; then
      DIST="linux-amd64"
    elif [ "${MACHINE}" == "armv6l" ]; then
      DIST="linux-armv6"
    elif [ "${MACHINE}" == "armv7l" ]; then
      DIST="linux-armv7"
    elif [ "${MACHINE}" == "aarch64" ]; then
      DIST="linux-arm64"
    fi
  elif [ "${KERNEL}" == "Darwin" ]; then
    EXT="zip"
    if [ "${MACHINE}" == "x86_64" ]; then
      DIST="darwin-amd64"
    elif [ "${MACHINE}" == "arm64" ]; then
      DIST="darwin-arm64"
    fi
  elif [ "${KERNEL}" == "FreeBSD" ]; then
    EXT="tar.gz"
    if [ "${MACHINE}" == "i386" ]; then
      DIST="freebsd-386"
    elif [ "${MACHINE}" == "x86_64" ]; then
      DIST="freebsd-amd64"
    elif [ "${MACHINE}" == "armv6l" ]; then
      DIST="freebsd-armv6"
    elif [ "${MACHINE}" == "armv7l" ]; then
      DIST="freebsd-armv7"
    fi
  else
    echo "ERROR! ${KERNEL} is not a supported platform."
    exit 1
  fi


  if [ -z "${DIST}" ]; then
    echo "ERROR! ${MACHINE} is not a supported architecture."
    exit 1
  fi

  # Construct filename
  FILENAME="termsvg-${VER}-${DIST}.${EXT}"

  echo " - Downloading ${URL}/${FILENAME}"
  TMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t termsvg)
  curl -sLo "${TMP_DIR}/${FILENAME}" "${URL}/${FILENAME}"

  echo " - Unpacking ${FILENAME}"
  if [ "${EXT}" == "zip" ]; then
    unzip -qq -o "${TMP_DIR}/${FILENAME}" -d "${TMP_DIR}"
  elif [ "${EXT}" == "tar.gz" ]; then
    tar -xf "${TMP_DIR}/${FILENAME}" -C "${TMP_DIR}"
  else
    echo "ERROR! Unknown file extension."
    exit 1
  fi

  # Move binary to install directory
  if [ -d "${INSTALL_DIR}" ]; then
    echo " - Moving termsvg to ${INSTALL_DIR}"
    mv "${TMP_DIR}/termsvg-${VER}-${DIST}/termsvg" "${INSTALL_DIR}/"
    chmod +x "${INSTALL_DIR}/termsvg"

    echo " - Cleaning up temporary files"
    rm -rf "${TMP_DIR}"

    echo -en " - Verifying installation: "
    if [ "$(id -u)" -eq 0 ]; then
      termsvg --version
    else
      "${INSTALL_DIR}/termsvg" --version
    fi
  else
    echo "ERROR! Installation directory ${INSTALL_DIR} is invalid. Aborting."
    rm -rf "${TMP_DIR}"
    exit 1
  fi
}

echo "termsvg installation script"
get_termsvg
