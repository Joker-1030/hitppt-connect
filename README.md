# HitPPT Connect

Use selected Markdown notes as temporary reference material for presentations in HitPPT. Browse authorized folders from HitPPT, choose notes, and confirm before their contents leave your vault. You can also send the current note or selected notes from Obsidian to HitPPT.

**Release preparation:** this plugin has not yet been listed in the Obsidian community directory. The production connector is not yet available; the production package cannot currently complete pairing. This notice must be updated only after production verification.

HitPPT Connect is a third-party integration, not an Obsidian first-party product. It requires **Obsidian desktop 1.11.4 or later** and a **HitPPT account**. The plugin interface is currently in Chinese. Mobile is not supported.

## Account, network and payment

- The production package communicates with `https://hitppt.com/api` and `wss://hitppt.com/api/connectors/obsidian/ws` for pairing, connection status, authorized browsing and selected-note transfer. It opens `https://hitppt.com/home` for confirmation.
- Pairing and note transfer do not invoke a paid AI model. Presentation generation uses HitPPT's existing points and confirmation rules. During generation, selected material may be sent to the model provider used for that task.
- The plugin contains no telemetry, advertisements, remote code loading, self-updater or dependency installer.
- Read [Privacy and data handling](PRIVACY.md) before pairing. Browsing shares note metadata; it does not upload all note contents.

## Installation and pairing

When a GitHub release is available, download its `main.js` and `manifest.json` into `<vault>/.obsidian/plugins/hitppt-connect/`. Alternatively, extract the release ZIP's `hitppt-connect` directory into `<vault>/.obsidian/plugins/`. Enable **HitPPT Connect** in Obsidian settings → Community plugins. Do not install the local-development package for use with the production website.

1. Sign in to HitPPT and open the file library (文件库).
2. Select **Obsidian**, to the left of the upload button, then **绑定 Vault** to create a short-lived pairing code.
3. In Obsidian → Settings → HitPPT Connect, enter allowed vault-relative folders, one per line, or explicitly allow the whole vault. Hidden paths remain excluded.
4. Enter the pairing code, then confirm the vault and folder scope on the HitPPT website.
5. Keep this vault open to browse or read it from HitPPT. Successful pairing persists across restarts. Each vault is paired separately.

The command **发送当前笔记到 HitPPT** and note context menus send selected notes to the bound account. HitPPT then asks you to confirm using them in a presentation. Changing scope requires unpairing and pairing again. Unpair in either the plugin or the HitPPT file library to revoke access.

## Temporary materials

Each successful import is a snapshot with a 48-hour lifetime measured from retrieval. Previewing, chatting or using it does not extend that lifetime. After expiry, the active service removes the note body and reusable source caches, while retaining source metadata and generated presentation results. Historical database backups follow the service's backup retention policy; this is **not** a promise of physical erasure from backups within 48 hours.

If a later request needs an expired original note, HitPPT asks permission before fetching the current contents from its recorded path. Re-fetching for one project does not silently replace another project's snapshot. Already imported, unexpired materials remain usable when Obsidian disconnects.

Limits: 512 KiB per note, 20 notes and 5 MiB per read, and 1 GiB of active temporary note bodies per account. Linked notes, embedded local images and remote images are not automatically fetched. Search matches note names and paths, not the contents of every note.

## Troubleshooting

- **Not connected:** open the paired vault, enable the plugin, check the network and use **重新连接**. This status alone cannot identify whether Obsidian is closed or the network is unavailable.
- **Path missing:** when connected, the original path could not be found. The note may have moved, been renamed or been deleted.
- **Permission denied:** check the authorized folders. Hidden paths and paths outside the selected scope cannot be read.
- **Expired authorization:** pair again. Credentials are revocable and expire after 90 days without a connection.
- **Pairing unavailable on production:** the release-preparation notice above applies until the production connector is deployed and verified.

Use this repository's Issues tab for plugin bugs. Include the plugin and Obsidian versions and a redacted error description; do not post pairing codes, credentials, private notes or account details.

## Development

This repository contains only the desktop plugin and its wire protocol. Node.js 22 or later is recommended. From the repository root:

```sh
npm install
npm run typecheck
npm test
npm run build
```

`npm run build` creates `dist/release/hitppt-connect/main.js`, `manifest.json` and a release ZIP. It also creates a separate local package for `http://127.0.0.1:4200` / `http://localhost:3200`; that package requires a locally running HitPPT backend and is not a community-release asset. The build uses esbuild without minification; it does not bundle Obsidian itself.

See [RELEASING.md](RELEASING.md) for release checks. The plugin source in this repository is licensed under the [MIT License](LICENSE). This license covers this plugin repository only, not the HitPPT service or its private source code.
