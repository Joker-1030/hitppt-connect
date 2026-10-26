# Releasing HitPPT Connect

1. Confirm the MIT license in `LICENSE`. Before a stable release or community listing, verify production pairing/read/revoke. A review preview must be labeled as a pre-release and disclose any unavailable service. Remove the release-preparation notice only after production verification.
2. Update `manifest.json`, `package.json` and `versions.json` consistently. The GitHub release tag must exactly match `manifest.version`, for example `0.1.0`, without a `v` prefix.
3. Run `npm install`, `npm run typecheck`, `npm test` and `npm run build` from a clean checkout. Review the network endpoints and source scope.
4. Publish the matching commit and create the release. Attach `dist/release/hitppt-connect/main.js` and `dist/release/hitppt-connect/manifest.json` as separate release assets. The release ZIP is an optional additional download. Never upload the local-development bundle as a community-release asset.
5. Sign in to https://community.obsidian.md with an Obsidian account, link the owning GitHub account and add the plugin. Review the actual permissions requested before granting access.
6. Resolve the directory's review findings. A published GitHub release is not evidence that Obsidian has accepted or listed the plugin.

Official submission guide: https://docs.obsidian.md/plugins/releasing/submit-plugin

Keep account, payment, networking and retention disclosures accurate across the README and privacy document. Do not place credentials, test vaults or internal service configuration in this repository.
