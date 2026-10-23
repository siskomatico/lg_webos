#!/bin/sh
# Run on the TV over SSH after changing the redirect script's target.
set -eu
SCRIPT=/var/lib/webosbrew/init.d/freemytv-home-redirect
LOCK=/tmp/freemytv-home-redirect.lock
if [ -f "$LOCK/pid" ]; then
    pid=$(cat "$LOCK/pid")
    case "$pid" in ''|*[!0-9]*) echo 'Invalid PID file; refusing to stop anything.' >&2; exit 1;; esac
    if [ -r "/proc/$pid/cmdline" ]; then
        if ! tr '\000' ' ' < "/proc/$pid/cmdline" | grep -Fq "$SCRIPT"; then
            echo 'PID belongs to another process; refusing to stop it.' >&2
            exit 1
        fi
        children=$(pgrep -P "$pid" || true)
        kill -TERM "$pid" $children 2>/dev/null || true
        sleep 2
        if kill -0 "$pid" 2>/dev/null; then
            echo 'Redirect has not stopped cleanly; refusing to create a duplicate.' >&2
            exit 1
        fi
    fi
    rm -f "$LOCK/pid"
    rmdir "$LOCK" 2>/dev/null || true
fi
sh -n "$SCRIPT"
"$SCRIPT"
echo 'Redirect restarted; subscription will be ready after its normal startup delay.'
