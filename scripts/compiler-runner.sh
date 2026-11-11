#!/bin/sh
engine="$1"
shift
"$engine" "$@" > /work/compiler.log 2>&1
code=$?
if [ "$code" -eq 0 ]; then
  "$engine" "$@" > /work/compiler.log 2>&1
  code=$?
fi
/usr/bin/head -c 100000 /work/compiler.log >&2
if [ "$code" -eq 0 ]; then /usr/bin/base64 /work/resume.pdf; fi
exit "$code"
