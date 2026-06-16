# rendermd dev container — environment-control role.
#
# Why a Dockerfile in a FE project? Not for shipping a runtime image
# (the production output is a static export served from GitHub Pages
# — no Node runtime in the deploy target). The role here is the
# modern one: reduce the number of variables that affect what
# Playwright sees when it screenshots the page.
#
# Variables this image pins:
#   - Node 20.x (LTS at time of writing)
#   - pnpm via corepack (lockfile-frozen install)
#   - chromium + every system dep Playwright needs
#   - font stack: Noto CJK + Noto color emoji (for fixtures with
#     Korean prose + emoji — without these, glyphs fall back to
#     boxes / different shape outlines across runners)
#
# What stays variable (intentionally):
#   - The user's host editor (mounted via devcontainer.json)
#   - npm registry / pnpm-store cache (mounted from host)
#
# Used from:
#   - VS Code / Cursor "Reopen in Container" (devcontainer.json)
#   - Future: GitHub Actions `container:` key if we ever bring back
#     pixel-diff visual regression (see render-corpus.ts doc-comment
#     for why we dropped that in #185)

FROM mcr.microsoft.com/playwright:v1.60.0-jammy

# Korean + emoji fonts are required by scripts/fixtures/04-korean-and-
# emoji.md. Without them, the same fixture renders box-glyphs on a
# bare Ubuntu and proper Hangul on a developer's machine — the exact
# class of cross-machine drift this image exists to eliminate.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        fonts-noto-cjk \
        fonts-noto-color-emoji \
        git \
    && rm -rf /var/lib/apt/lists/*

# Playwright's image ships a `pwuser`; we use `node` to match
# devcontainer conventions and avoid a permissions mismatch with the
# bind-mounted workspace owned by the host user.
RUN useradd --create-home --shell /bin/bash node \
    && mkdir -p /workspace \
    && chown -R node:node /workspace

USER node
WORKDIR /workspace

# Corepack is bundled with Node 20+ — enabling it makes `pnpm` available
# without a global install. The project's packageManager field in
# package.json pins the exact version.
ENV PATH=/home/node/.local/bin:$PATH
RUN corepack enable

# No `pnpm install` at image build time — the workspace is bind-mounted
# at runtime so node_modules belongs in the mount, not the image.
# devcontainer.json's postCreateCommand runs the install once the
# container is up.

CMD ["sleep", "infinity"]
