# Privacy and data handling

This document describes the HitPPT Connect plugin's implemented data flows. It does not replace the HitPPT account terms or promise retention guarantees that the service does not implement.

## Data sent to HitPPT

Pairing sends the vault ID and name, a device label based on the vault name, allowed folder paths and the one-time pairing claim. After approval, a revocable device credential authenticates the connection. Credentials are kept in Obsidian's official SecretStorage; the service stores a hash. Plugin settings retain the vault ID, binding ID and folder scope. Other malicious code running inside the same Obsidian process is not isolated by SecretStorage.

Opening the selector shares authorized folder names and Markdown metadata, including note name, path, size and modification time. It does not send every note body. Selecting and confirming notes on the website, or explicitly sending notes from Obsidian, permits transmission of those selected Markdown bodies.

The plugin validates vault scope, hidden paths, real filesystem paths, request expiry and file-size limits. It uses filesystem realpath checks to reject links outside allowed folders; it does not intentionally read file contents outside the authorized vault scope. It does not follow linked notes, upload embedded local images or fetch remote images.

## Destination and use

The production plugin sends data to HitPPT over HTTPS and WSS at `hitppt.com`. Data is associated with the paired HitPPT account. Imported notes become temporary reference materials. Presentation generation may send selected material to the model provider configured for that task and follows HitPPT's existing charging and confirmation flow.

The plugin contains no analytics or advertising SDK and emits no client-side telemetry. Server authentication, abuse protection and operational processing are separate from this plugin; this document does not assert that the service has no access logs.

## Retention and revocation

Note bodies and reusable source caches expire from the active service after 48 hours from retrieval. Source records, including vault and path, and generated results remain. Historical backups follow existing server backup retention; physical removal of note bodies from every backup within 48 hours is not guaranteed.

Unpairing revokes future device access. It does not erase already generated presentations or retroactively remove database backups. Imported snapshots retain their own expiry. Re-reading expired source material requires permission and fetches the latest file at the retained path.

For plugin issues, use the repository's Issues tab without posting note bodies, credentials, private paths or pairing codes. Account and service data requests need to be handled by HitPPT service support; do not post account details in a public issue.
