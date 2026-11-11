#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .tools
archive=.tools/tinytex-v2026.11.tar.xz
if [ ! -x .tools/.TinyTeX/bin/x86_64-linux/pdflatex ]; then
  curl --fail --location --retry 3 https://github.com/rstudio/tinytex-releases/releases/download/v2026.11/TinyTeX-1-linux-x86_64-v2026.11.tar.xz --output "$archive"
  echo '5b75befa848deae702ae6fa12ff0eef3f110d7e4e2a979ae99f101eba3c9c70d  .tools/tinytex-v2026.11.tar.xz' | sha256sum --check
  tar -xJf "$archive" -C .tools
fi
texbin="$PWD/.tools/.TinyTeX/bin/x86_64-linux"
"$texbin/tlmgr" update --self
"$texbin/tlmgr" install babel-english preprint xetex moderncv fontawesome5 fontawesome6 academicons multirow arydshln microtype fontspec xcolor geometry enumitem titlesec hyperref collection-fontsrecommended lm latexmk etoolbox iftex tools fancyhdr marvosym parskip tikzmark pgf qrcode adjustbox collectbox xpatch unicode-math
mkdir -p .tools/rootfs/usr/bin .tools/rootfs/etc .tools/rootfs/fonts .tools/rootfs/bin .tools/rootfs/input .tools/rootfs/lib64 .tools/rootfs/work .tools/rootfs/tmp .tools/rootfs/proc .tools/rootfs/dev .tools/rootfs/tex
runtime_shell=/usr/bin/dash
if [ ! -x "$runtime_shell" ]; then runtime_shell=/usr/bin/bash; fi
cp "$runtime_shell" .tools/rootfs/bin/sh
cp /usr/bin/base64 /usr/bin/head .tools/rootfs/usr/bin/
if [ -f .tools/rootfs/usr/bin/compiler-runner ]; then chmod u+w .tools/rootfs/usr/bin/compiler-runner; fi
cp scripts/compiler-runner.sh .tools/rootfs/usr/bin/compiler-runner
chmod 555 .tools/rootfs/usr/bin/compiler-runner
touch .tools/rootfs/input/main.tex
cp /usr/bin/prlimit .tools/rootfs/usr/bin/
for executable in "$runtime_shell" /usr/bin/base64 /usr/bin/head /usr/bin/prlimit "$texbin/pdftex" "$texbin/xetex" "$texbin/xdvipdfmx"; do
  while IFS= read -r library; do cp --parents --dereference "$library" .tools/rootfs/; done < <(ldd "$executable" | awk '/=> \// {print $3} /^[[:space:]]*\// {print $1}')
done
if [ -d /usr/share/fonts/truetype ]; then cp -a /usr/share/fonts/truetype .tools/rootfs/fonts/; fi
cat > .tools/rootfs/etc/fonts.conf <<'FONTS'
<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><dir>/fonts</dir><dir>/tex/texmf-dist/fonts/opentype</dir><cachedir>/tmp/font-cache</cachedir></fontconfig>
FONTS
"$texbin/tlmgr" info --only-installed --data name,localrev > .tools/tex-packages.lock
find .tools/rootfs -type f -exec sha256sum {} + > .tools/rootfs.sha256
cat .tools/tex-packages.lock .tools/rootfs.sha256 | sha256sum > .tools/toolchain.sha256
printf '%s\n' 'TinyTeX ready. Runtime must use bubblewrap; never compile directly on the host.'
