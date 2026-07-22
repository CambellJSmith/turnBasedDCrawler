#!/usr/bin/env sh

set -u

script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
url="http://127.0.0.1:5173"

cd "$script_directory" || exit 1

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' "Node.js 20 or newer is required to run ashfall depths."
  exit 1
fi

node server.js &
server_pid=$!

cleanup() {
  if kill -0 "$server_pid" >/dev/null 2>&1; then
    kill "$server_pid" >/dev/null 2>&1
  fi
}
trap cleanup INT TERM EXIT

attempt=0
while [ "$attempt" -lt 50 ]; do
  if node -e "fetch('$url').then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"; then
    break
  fi

  if ! kill -0 "$server_pid" >/dev/null 2>&1; then
    wait "$server_pid"
    exit $?
  fi

  attempt=$((attempt + 1))
  sleep 0.1
done

if command -v open >/dev/null 2>&1; then
  open "$url"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$url" >/dev/null 2>&1 &
else
  printf '%s\n' "Open $url in your browser."
fi

wait "$server_pid"
