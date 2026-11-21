import { mkdir,writeFile,readFile,readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const files=await readdir(new URL('../game/src/',import.meta.url));
let urls=[];for(const f of ['index.html','style.css',...files.map(f=>'src/'+f)]){let s=await readFile(new URL('../game/'+f,import.meta.url),'utf8');if(/https?:\/\//.test(s))urls.push(f);}
assert.equal(urls.length,0);console.log('Resource URL scan: PASS — no http:/https:// references in game/');
await mkdir('/tmp/check',{recursive:true});
const screenshotDir=new URL('../screenshots/',import.meta.url);
await mkdir(screenshotDir,{recursive:true});
const shots=JSON.parse(await readFile(new URL('../shots.json',import.meta.url),'utf8'));
const target=await (await fetch('http://localhost:9222/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0,pending=new Map(),errors=[],requests=[];
ws.onmessage=e=>{let m=JSON.parse(e.data);if(m.id){let p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(JSON.stringify(m.params.args));if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);}};
const call=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Timeout '+expression);};
await call('Runtime.enable');await call('Network.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});
for(const shot of shots){const name=new URLSearchParams(shot.query).get('shot');errors=[];requests=[];await call('Page.navigate',{url:`http://localhost:8080/${shot.query}`});await until('window.__shotReady===true');if(name==='play'){assert.equal(await evaluate('window.__game.state.found.length'),4);assert.equal(await evaluate('document.getElementById("remaining").textContent'),'3 left');}assert.equal(errors.length,0,JSON.stringify(errors));assert(requests.every(u=>u.startsWith('http://localhost:8080/')||u.startsWith('data:')),requests.join('\n'));const {data}=await call('Page.captureScreenshot',{format:'png'});await writeFile(`/tmp/check/${name}.png`,Buffer.from(data,'base64'));const jpeg=await call('Page.captureScreenshot',{format:'jpeg',quality:88});const bytes=Buffer.from(jpeg.data,'base64');assert(bytes.length<256*1024);await writeFile(new URL(shot.name,screenshotDir),bytes);console.log(`Shot ${name}: PASS — 1600x900, no console errors, localhost/data only; screenshots/${shot.name} (${bytes.length} bytes); /tmp/check/${name}.png`);}
await call('Page.navigate',{url:'http://localhost:8080/?seed=1'});await until('!!window.__game && !window.__shotReady');
const key=async(key,code=key)=>{await call('Input.dispatchKeyEvent',{type:'keyDown',key,code});await call('Input.dispatchKeyEvent',{type:'keyUp',key,code});};
await key('Enter');await until('window.__game.state.screen==="playing"');
await key('s');assert.equal(await evaluate('document.getElementById("sound").textContent'),'Sound on');await key('n');assert.equal(await evaluate('document.getElementById("sound").textContent'),'Sound off');await key('n');console.log('Sound controls: PASS — S leaves sound unchanged; N toggles sound');
const click=async(x,y)=>{let p=await evaluate(`(()=>{let r=document.getElementById('original').getBoundingClientRect();return {x:r.left+${x}/600*r.width,y:r.top+${y}/440*r.height}})()`);await call('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});};
await click(590,15);assert.equal(await evaluate('window.__game.state.mistakes'),1);
const differences=await evaluate('window.__game.differences');
// Position with real pointer input, then move and check using real keyboard input.
let first=differences.shift();let p=await evaluate(`(()=>{let r=document.getElementById('original').getBoundingClientRect();return{x:r.left+${first.x}/600*r.width,y:r.top+${first.y}/440*r.height}})()`);await call('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await new Promise(r=>setTimeout(r,100));await key('ArrowRight');await key(' ','Space');assert.equal(await evaluate('window.__game.state.found.length'),1);
await key('p');assert.equal(await evaluate('window.__game.state.screen'),'paused');await key('Escape');await key('h');assert.equal(await evaluate('window.__game.state.hints'),2);
for(let o of differences)await click(o.x,o.y);
assert.equal(await evaluate('window.__game.state.screen'),'complete');assert.equal(await evaluate('window.__game.state.found.length'),7);
console.log('Real play: PASS — Enter start, one miss, arrow movement + Space find, pause/resume, hint, six pointer finds → level complete');
for(let level=1;level<5;level++){await key('Enter');assert.equal(await evaluate('window.__game.state.level'),level);for(let o of await evaluate('window.__game.differences'))await click(o.x,o.y);assert.equal(await evaluate('window.__game.state.screen'),'complete');}
await key('Enter');assert.equal(await evaluate('window.__game.state.screen'),'final');assert((await evaluate('Number(localStorage.getItem("little-elsewhere-best"))'))>0);await key('Enter');assert.equal(await evaluate('window.__game.state.level'),0);assert.equal(await evaluate('window.__game.state.found.length'),0);
assert.equal(errors.length,0,JSON.stringify(errors));console.log('Full collection: PASS — all five scenes, final results, saved best, restart; no runtime errors');
await call('Page.close');ws.close();
