const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),JSZip=require('jszip');
test('published website packages contain complete installable files and the correct environment without API credentials',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'obsidian-distribution-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const {buildPlugin}=await import('../build.mjs');const catalog=await buildPlugin({webPublicDir:root});
 assert.equal(catalog.desktopOnly,true);assert.equal(catalog.minAppVersion,'1.11.4');assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,'downloads/obsidian-connect/catalog.json'),'utf8')),catalog);
 for(const env of ['local','release']){
  const p=catalog.packages[env],body=await fs.readFile(path.join(root,p.url));assert.equal(body.length,p.bytes);assert.equal(crypto.createHash('sha256').update(body).digest('hex'),p.sha256);
  const zip=await JSZip.loadAsync(body,{checkCRC32:true});assert.deepEqual(Object.keys(zip.files).sort(),['hitppt-connect/LICENSE','hitppt-connect/README.md','hitppt-connect/main.js','hitppt-connect/manifest.json']);
  const manifest=JSON.parse(await zip.file('hitppt-connect/manifest.json').async('string'));assert.equal(manifest.version,catalog.version);
  const code=await zip.file('hitppt-connect/main.js').async('string');assert(code.includes(env==='local'?'http://127.0.0.1:4200':'https://hitppt.com/api'));assert(!code.includes(env==='local'?'https://hitppt.com/api':'http://127.0.0.1:4200'));assert(!code.includes('sourceMappingURL='));
  const license=await fs.readFile(path.join(__dirname,'../LICENSE'),'utf8');assert.equal(await zip.file('hitppt-connect/LICENSE').async('string'),license);assert(code.startsWith('/*!\n'+license+'*/'));
 }
 const next=await buildPlugin({webPublicDir:root});assert.deepEqual(next,catalog,'rebuilding unchanged sources produces the same archive hashes');
});
