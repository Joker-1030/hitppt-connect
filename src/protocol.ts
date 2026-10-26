/** Wire contract shared by the desktop plugin and the host. No filesystem access. */
export const OBSIDIAN_TTL_MS = 48 * 60 * 60 * 1000;
export const OBSIDIAN_NOTE_BYTES = 512 * 1024;
export const OBSIDIAN_BATCH_BYTES = 5 * 1024 * 1024;
export const OBSIDIAN_MAX_NOTES = 20;
export type ObsidianSource = {
  bindingId: string; vaultId: string; vaultName: string; path: string;
  fetchedAt: string; expiresAt: string; sha256: string;
};
export type ObsidianNote = { path: string; name: string; bytes: number; modifiedAt: number };
export type ObsidianDevice = { id: string; vaultId: string; vaultName: string; deviceName: string; folders: string[]; online: boolean; revoked: boolean };
export type ObsidianRequest = {
  version: 1; request_id: string; type: "list_notes" | "search_notes" | "read_notes";
  binding_id: string; vault_id: string; expires_at: string;
  input: { paths?: string[]; query?: string; folder?: string; offset?: number };
};
export function obsidianPath(value: string, folder = false): string {
  // Reject ASCII control characters in untrusted local paths.
  // eslint-disable-next-line no-control-regex -- Control characters must be rejected in untrusted vault paths.
  if (typeof value !== "string" || value.length > 1024 || /[\\\u0000-\u001f\u007f]/u.test(value) || value.startsWith("/") || /^[a-z]:/i.test(value)) throw new Error("路径不符合要求");
  if (folder && value === "") return value;
  const parts = value.split("/");
  if (parts.some(part => !part || part.startsWith(".") || part.trim() !== part || part.includes(":"))) throw new Error("路径不在允许范围内");
  if (!folder && !/\.md$/i.test(value)) throw new Error("仅支持 Markdown 笔记");
  return value;
}
export function obsidianAllowed(path: string, folders: readonly string[]): boolean {
  try { obsidianPath(path); return folders.some(folder => { obsidianPath(folder, true); return !folder || path.startsWith(folder + "/"); }); }
  catch { return false; }
}
export function obsidianExpired(source: Pick<ObsidianSource, "expiresAt">, now = Date.now()): boolean {
  const time = Date.parse(source.expiresAt); return !Number.isFinite(time) || time <= now;
}
export const OBSIDIAN_ERRORS: Record<string, string> = {
  CAPACITY: 'Obsidian 临时资料已达 1GB，请移除不需要的文件后重试',
  OFFLINE: "Obsidian 当前未连接，请打开对应 Vault 并启用 HitPPT Connect 后重试。",
  NOT_FOUND: "Obsidian 已连接，但原路径不存在；笔记可能已移动、重命名或删除。",
  FORBIDDEN: "该路径不在当前授权范围内，请检查 Obsidian 插件的文件夹授权。",
  TOO_LARGE: "笔记数量或大小超出限制，请减少选择后重试。",
  EXPIRED: "临时文件已失效，需要你授权后重新获取。",
  REVOKED: "Obsidian 授权已失效，请重新绑定。",
  TIMEOUT: "读取 Obsidian 超时，请检查连接后重试。",
  READ_FAILED: "Obsidian 未能读取笔记，请检查文件后重试。",
};
