#!/data/data/com.termux/files/usr/bin/bash
set -e
cd "$(dirname "$0")"
[ -f "$HOME/.venv/bin/activate" ] && source "$HOME/.venv/bin/activate"
python build.py
