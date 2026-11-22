#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
# Prefer an existing Python installation, including common course/Jupyter distributions.
for interpreter in "$HOME/miniconda3/bin/python3" "$HOME/anaconda3/bin/python3" /opt/anaconda3/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3 python3; do
  if command -v "$interpreter" >/dev/null 2>&1 && "$interpreter" -c 'import sys; sys.exit(sys.version_info < (3, 7))' >/dev/null 2>&1; then
    "$interpreter" classroom.py
    code=$?
    if [ "$code" -ne 0 ]; then read -r -p "Press Enter to close this window."; fi
    exit "$code"
  fi
done
echo "Use Python 3.7 or later to run classroom.py from this folder."
read -r -p "Press Enter to close this window."
