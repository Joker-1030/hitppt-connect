import {build} from 'esbuild';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import JSZip from 'jszip';
const root=dirname(fileURLToPath(import.meta.url));
async function atomicWrite(path,bytes){const temporary=path+'.'+randomUUID()+'.tmp';await writeFile(temporary,bytes);await rename(temporary,path);}
export async function buildPlugin({webPublicDir}={}){
 const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
 const license=await readFile(resolve(root,'LICENSE'),'utf8');
 const catalog={version:manifest.version,minAppVersion:manifest.minAppVersion,desktopOnly:manifest.isDesktopOnly,packages:{}};
 const downloads=webPublicDir?resolve(webPublicDir,'downloads/obsidian-connect'):undefined;
 if(downloads)await mkdir(downloads,{recursive:true});
 for(const environment of ['local','release']){
  const local=environment==='local',web=local?'http://localhost:3200':'https://hitppt.com',api=local?'http://127.0.0.1:4200':'https://hitppt.com/api';
  const outdir=resolve(root,'dist',environment,'hitppt-connect');await mkdir(outdir,{recursive:true});
  const result=await build({absWorkingDir:root,entryPoints:['src/main.ts'],bundle:true,write:false,platform:'node',target:'es2022',format:'cjs',external:['obsidian'],define:{HITPPT_API:JSON.stringify(api),HITPPT_WEB:JSON.stringify(web)},minify:false,banner:{js:'/*!\n'+license+'*/'}});
  const readme=`# HitPPT Connect ${manifest.version}\n\n${local?'本地测试版，仅连接这台电脑运行的 HitPPT。':'正式站点版。'}\n连接网站：${web}\n需要 Obsidian 桌面版 ${manifest.minAppVersion} 或以上。\n\n1. 将 hitppt-connect 整个文件夹放入目标 Vault 的 .obsidian/plugins/，没有 plugins 文件夹则新建。\n2. Obsidian 设置 → 第三方插件，允许第三方插件并启用 HitPPT Connect；未出现时重启 Obsidian。\n3. HitPPT 文件库 → Obsidian → 绑定 Vault，复制配对码。\n4. 插件设置中填写允许访问的文件夹，输入配对码；回到网页核对并确认。\n\n需要 HitPPT 账号。连接和按需获取不调用收费模型；PPT 生成沿用网站现有积分规则。插件只传输所选 Markdown 正文和授权目录元数据，不上传关联图片或笔记，不含遥测或广告。正文在运行数据库内48小时有效，到期删除正文和可复用缓存、保留来源路径及生成成果；历史数据库备份遵循服务的备份保留规则。设备凭据使用 Obsidian SecretStorage；可在网页或插件解除绑定。\n`;
  const files={'main.js':Buffer.from(result.outputFiles[0].contents),'manifest.json':Buffer.from(JSON.stringify(manifest,null,2)+'\n'),'README.md':Buffer.from(readme),'LICENSE':Buffer.from(license)};
  const zip=new JSZip();
  for(const [name,bytes] of Object.entries(files)){await atomicWrite(resolve(outdir,name),bytes);zip.file('hitppt-connect/'+name,bytes,{date:new Date('2026-01-01T00:00:00Z'),createFolders:false});}
  const buffer=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:9}});
  const filename=`hitppt-connect-${manifest.version}-${environment}.zip`;
  await atomicWrite(resolve(root,'dist',filename),buffer);
  if(downloads)await atomicWrite(resolve(downloads,filename),buffer);
  catalog.packages[environment]={filename,url:'/downloads/obsidian-connect/'+filename,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex')};
 }
 if(downloads)await atomicWrite(resolve(downloads,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
 return catalog;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const index=process.argv.indexOf('--web-public');
 if(index>=0&&!process.argv[index+1])throw Error('--web-public requires a directory');
 await buildPlugin({webPublicDir:index>=0?resolve(process.argv[index+1]):undefined});
}
