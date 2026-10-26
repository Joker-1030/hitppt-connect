import { Plugin, PluginSettingTab, Setting, Notice, TFile, FileSystemAdapter, requestUrl, type App } from 'obsidian';
import { realpath } from 'node:fs/promises';
import { relative, sep } from 'node:path';
import { OBSIDIAN_BATCH_BYTES, OBSIDIAN_MAX_NOTES, OBSIDIAN_NOTE_BYTES, obsidianAllowed, obsidianPath, type ObsidianRequest } from './protocol';
declare const HITPPT_API: string;
declare const HITPPT_WEB: string;
type Settings = { vaultId: string; bindingId?: string; folders: string[] };
const freshSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2,'0')).join('');
class ReadError extends Error { constructor(readonly code: string) { super(code); } }
class ApiError extends Error { constructor(readonly status: number, message: string) { super(message); } }
export default class HitPptConnect extends Plugin {
  settings!: Settings;
  socket?: WebSocket;
  status = '未绑定';
  private statusItem!: HTMLElement;
  private reconnect?: number;
  private heartbeat?: number;
  private stopped = false;
  private attempt = 0;
  private lastHeartbeat = 0;
  private requests = new Map<string, number>();
  private chain = Promise.resolve();
  private pairing = false;
  private secretId() { return `hitppt-connect-${this.settings.vaultId}`; }
  async onload() {
    this.settings = Object.assign({ vaultId: crypto.randomUUID(), folders: [] }, await this.loadData());
    await this.saveData(this.settings);
    this.statusItem = this.addStatusBarItem(); this.setStatus(this.settings.bindingId ? '未连接' : '未绑定');
    this.addSettingTab(new ConnectSettings(this.app, this));
    this.addCommand({ id: 'send-current-note', name: '发送当前笔记到 HitPPT', checkCallback: checking => { const file=this.app.workspace.getActiveFile(); if(!file || file.extension!=='md')return false; if(!checking)void this.send([file]);return true; } });
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => { if (file instanceof TFile && file.extension === 'md') menu.addItem(item => item.setTitle('发送到 HitPPT').setIcon('send').onClick(() => this.send([file]))); }));
    this.registerEvent(this.app.workspace.on('files-menu', (menu, files) => { const notes=files.filter((file):file is TFile=>file instanceof TFile && file.extension==='md');if(notes.length)menu.addItem(item=>item.setTitle('发送到 HitPPT').setIcon('send').onClick(()=>this.send(notes))); }));
    if (this.settings.bindingId) this.connect();
  }
  onunload() { this.stopped = true; this.disconnect(); }
  private setStatus(status: string) { this.status = status; this.statusItem?.setText(`HitPPT · ${status}`); }
  private disconnect() { window.clearTimeout(this.reconnect); window.clearInterval(this.heartbeat); this.socket?.close(); this.socket = undefined; }
  async api(path: string, body?: unknown, token?: string) {
    const response = await requestUrl({ url: HITPPT_API + '/connectors/obsidian' + path, method: 'POST', contentType: 'application/json', body: JSON.stringify(body ?? {}), headers: token ? { Authorization: `Bearer ${token}` } : {}, throw: false });
    if (response.status >= 400) throw new ApiError(response.status, typeof response.json?.message === 'string' ? response.json.message : '连接失败，请稍后重试');
    return response.json;
  }
  async pair(code: string, folders: string[]) {
    if (this.pairing) return;
    this.pairing = true;
    try {
      if (!folders.length) throw new Error('请先选择允许访问的文件夹');
      folders.forEach(folder => obsidianPath(folder, true));
      const credential = freshSecret(), claimSecret = freshSecret();
      const pair = await this.api('/claim', { code, credential, claimSecret, proposal: { vaultId: this.settings.vaultId, vaultName: this.app.vault.getName(), deviceName: `${this.app.vault.getName()} · 桌面`, folders } });
      this.setStatus('等待网页确认');
      const deadline = Date.now() + 300000;
      while (!this.stopped && Date.now() < deadline) {
        await new Promise(resolve => window.setTimeout(resolve, 2000));
        const result = await this.api('/claim-status', { id: pair.id, claimSecret });
        if (result.state === 'cancelled') throw new Error('网页已取消本次配对');
        if (result.state !== 'approved') continue;
        this.app.secretStorage.setSecret(this.secretId(), credential);
        this.settings = { ...this.settings, bindingId: result.bindingId, folders };
        await this.saveData(this.settings); this.connect(); new Notice('HitPPT 绑定成功'); return;
      }
      throw new Error('配对已过期，请重试');
    } catch (error) { this.setStatus(this.settings.bindingId ? '未连接' : '未绑定'); new Notice(error instanceof Error ? error.message : '配对失败'); }
    finally { this.pairing = false; }
  }
  connect() {
    if (this.stopped || !this.settings.bindingId) return;
    this.disconnect();
    const token = this.app.secretStorage.getSecret(this.secretId());
    if (!token) { this.setStatus('授权失效'); return; }
    this.setStatus('连接中');
    const ws = this.socket = new WebSocket(HITPPT_API.replace(/^http/, 'ws') + '/connectors/obsidian/ws');
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
    ws.onmessage = event => {
      this.chain = this.chain.then(async () => {
        if (this.socket !== ws) return;
        const message = JSON.parse(String(event.data));
        if (message.type === 'ready') {
          if (message.binding_id !== this.settings.bindingId || message.vault_id !== this.settings.vaultId || JSON.stringify(message.folders) !== JSON.stringify(this.settings.folders)) { ws.close();this.setStatus('授权范围不一致');return; }
          this.attempt = 0; this.lastHeartbeat = Date.now(); this.setStatus('已连接');
          this.heartbeat = window.setInterval(() => { if (Date.now() - this.lastHeartbeat > 30000) ws.close(); else if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'heartbeat' })); }, 10000); return;
        }
        if (message.type === 'heartbeat') { this.lastHeartbeat = Date.now(); return; }
        await this.handle(ws, message);
      }).catch(() => { ws.close(); });
    };
    ws.onclose = event => {
      if (this.socket !== ws) return;
      window.clearInterval(this.heartbeat); this.setStatus(event.code === 4001 ? '授权失效或连接过期' : '未连接');
      if (!this.stopped && this.settings.bindingId) this.reconnect = window.setTimeout(() => this.connect(), Math.min(30000, 1000 * 2 ** Math.min(this.attempt++, 5)) + Math.random() * 500);
    };
    ws.onerror = () => this.setStatus('连接失败');
  }
  private async read(path: string) {
    if (!obsidianAllowed(path, this.settings.folders)) throw new ReadError('FORBIDDEN');
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || file.extension !== 'md') throw new ReadError('NOT_FOUND');
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) throw new ReadError('FORBIDDEN');
    // Reject aliases/symlinks outside the authorized folder, including hidden real paths.
    const base = await realpath(adapter.getBasePath());
    let actual: string;
    try { actual = await realpath(adapter.getFullPath(path)); } catch { throw new ReadError('NOT_FOUND'); }
    const actualPath = relative(base, actual).split(sep).join('/');
    if (!obsidianAllowed(actualPath, this.settings.folders)) throw new ReadError('FORBIDDEN');
    if (file.stat.size > OBSIDIAN_NOTE_BYTES) throw new ReadError('TOO_LARGE');
    const text = await this.app.vault.read(file);
    if (new TextEncoder().encode(text).length > OBSIDIAN_NOTE_BYTES) throw new ReadError('TOO_LARGE');
    return { path, text, modifiedAt: file.stat.mtime };
  }
  private async readMany(paths: string[]) {
    if (!Array.isArray(paths) || !paths.length || paths.length > OBSIDIAN_MAX_NOTES || new Set(paths).size !== paths.length) throw new ReadError('TOO_LARGE');
    const notes = []; let size = 0;
    for (const path of paths) { const note = await this.read(path);size += new TextEncoder().encode(note.text).length;if (size > OBSIDIAN_BATCH_BYTES) throw new ReadError('TOO_LARGE'); notes.push(note); }
    return notes;
  }
  private async handle(ws: WebSocket, request: ObsidianRequest) {
    if (request.version !== 1 || typeof request.request_id !== 'string' || request.binding_id !== this.settings.bindingId || request.vault_id !== this.settings.vaultId || !Number.isFinite(Date.parse(request.expires_at)) || Date.parse(request.expires_at) <= Date.now() || Date.parse(request.expires_at) > Date.now()+60000) return;
    for(const [id,time] of this.requests) if(time<Date.now())this.requests.delete(id);
    if(this.requests.has(request.request_id)) return;
    this.requests.set(request.request_id,Date.parse(request.expires_at)+60000);
    try {
      let result: unknown;
      if (request.type === 'read_notes') result = { notes: await this.readMany(request.input.paths ?? []) };
      else if (request.type === 'list_notes' || request.type === 'search_notes') {
        const folder = obsidianPath(request.input.folder ?? '', true), query = (request.input.query ?? '').toLocaleLowerCase(), offset = request.input.offset ?? 0;
        if (!Number.isSafeInteger(offset) || offset < 0) throw new ReadError('READ_FAILED');
        const all = this.app.vault.getMarkdownFiles().filter(file => obsidianAllowed(file.path, this.settings.folders));
        const folders = [...new Set(all.flatMap(file => { const tail = folder ? file.path.startsWith(folder + '/') ? file.path.slice(folder.length + 1) : '' : file.path;return tail.includes('/') ? [(folder ? folder+'/' : '') + tail.split('/')[0]] : []; }))].sort();
        const matching = all.filter(file => (!folder || file.path.startsWith(folder+'/')) && (query ? file.path.toLocaleLowerCase().includes(query) : file.parent?.path === (folder || '/'))).sort((a,b) => a.path.localeCompare(b.path));
        result = { folders: folders.slice(offset,offset+100), notes: matching.slice(offset,offset+100).map(file => ({ path: file.path, name:file.name, bytes:file.stat.size, modifiedAt:file.stat.mtime })), nextOffset:offset+100 < Math.max(matching.length,folders.length) ? offset+100 : null };
      } else return;
      if (ws === this.socket && ws.readyState === WebSocket.OPEN && Date.parse(request.expires_at)>Date.now()) ws.send(JSON.stringify({ type:'result', request_id:request.request_id, result }));
    } catch (error) { if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({ type:'request_error', request_id:request.request_id, code:error instanceof ReadError ? error.code : 'READ_FAILED' })); }
  }
  async send(files: TFile[]) {
    try {
      if (this.status !== '已连接') throw new Error('请先在插件设置中绑定并连接 HitPPT');
      const token = this.app.secretStorage.getSecret(this.secretId()); if (!token) throw new Error('授权已失效');
      const notes = await this.readMany(files.map(file=>file.path));
      const result = await this.api('/send', { requestId:crypto.randomUUID(), confirmed:true, notes }, token);
      window.open(`${HITPPT_WEB}/home?obsidianImport=${encodeURIComponent(result.importId)}`);
      new Notice('已发送到绑定账号，请在 HitPPT 网页确认使用');
    } catch(error) { const messages:Record<string,string>={FORBIDDEN:'笔记不在授权文件夹内',NOT_FOUND:'原路径不存在',TOO_LARGE:'笔记数量或大小超出限制'};new Notice(error instanceof ReadError ? messages[error.code] ?? '笔记读取失败' : error instanceof Error ? error.message : '发送失败'); }
  }
  async unbind() {
    const token = this.app.secretStorage.getSecret(this.secretId());
    try { if(token)await this.api('/disconnect', {}, token); }
    catch (error) { if (!(error instanceof ApiError && error.status === 401)) { new Notice('服务端撤销未完成，请在 HitPPT 文件库解除绑定后重试');return; } }
    this.settings.bindingId = undefined; this.disconnect(); this.app.secretStorage.setSecret(this.secretId(), ''); await this.saveData(this.settings); this.setStatus('未绑定');
  }
}
class ConnectSettings extends PluginSettingTab {
  constructor(app: App, private plugin: HitPptConnect) { super(app, plugin); }
  display() {
    const el = this.containerEl; el.empty();
    new Setting(el).setName('HitPPT Connect').setHeading();
    el.createEl('p',{text:`${this.plugin.status} · ${this.app.vault.getName()}`});
    el.createEl('p',{text:'只获取你在网页选择或主动发送的 Markdown。正文在 HitPPT 保留 48 小时，不同步整个 Vault，不自动读取图片或关联笔记。'});
    if (this.plugin.settings.bindingId) {
      el.createEl('p',{text:'已授权：'+this.plugin.settings.folders.map(p=>p||'整个 Vault（排除隐藏文件）').join('、')});
      new Setting(el).setName('连接').addButton(b=>b.setButtonText('重新连接').onClick(()=>this.plugin.connect())).addButton(b=>b.setButtonText('解除绑定').onClick(async()=>{await this.plugin.unbind();this.display();}));return;
    }
    let code = '', foldersText = '', whole = false;
    new Setting(el).setName('允许访问的文件夹').setDesc('Vault 内相对路径，每行一个；子文件夹包含在内。').addTextArea(t=>t.setPlaceholder('工作/项目\n演讲资料').onChange(v=>{foldersText=v;}));
    new Setting(el).setName('允许整个 Vault').setDesc('仍排除隐藏文件，且只在选择确认后获取正文。').addToggle(t=>t.onChange(v=>{whole=v;}));
    new Setting(el).setName('配对码').setDesc('在 HitPPT 文件库右上角点击 Obsidian 获取。').addText(t=>t.setPlaceholder('XXXX-XXXX-XXXX-XXXX').onChange(v=>{code=v;}));
    new Setting(el).addButton(b=>b.setButtonText('申请绑定').setCta().onClick(async()=>{b.setDisabled(true);try{await this.plugin.pair(code,whole?['']:foldersText.split('\n').map(s=>s.trim()).filter(Boolean));}finally{this.display();}}));
  }
}
