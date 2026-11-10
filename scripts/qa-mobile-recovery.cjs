// Deterministic browser regression: real HTMLAudioElement, fixture EPUB, stubbed TTS transport.
// QA_BASE_URL overrides localhost:5173. QA_TAP_ONLY=1 tests desktop and short-chapter margins; QA_GAP_ONLY=1 tests sentence pause timing.
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict');
const WebSocket = require('ws'), JSZip = require('jszip');
const base = process.env.QA_BASE_URL || 'http://localhost:5173', port = 9349;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'audioepub-mobile-qa-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let child, ws, seq = 0, failNetwork = false;
const pending = new Map(), requests = [];
const wav = Buffer.alloc(44 + 8000 * 2 * 30);
wav.write('RIFF');
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24);
wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(wav.length - 44, 40);
function send(method, params = {}) { const id = ++seq; return new Promise((resolve, reject) => { const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout ' + method)); }, 15000); pending.set(id, msg => { clearTimeout(timer); msg.error ? reject(Error(JSON.stringify(msg.error))) : resolve(msg.result); }); ws.send(JSON.stringify({ id, method, params })); }); }
async function ev(expression) {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails)
        throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
}
async function until(expr, label, timeout = 15000) {
    const t = Date.now();
    while (Date.now() - t < timeout) {
        const r = await ev(`!!(${expr})`);
        if (r)
            return r;
        await sleep(100);
    }
    throw Error('Timed out: ' + label);
}
async function click(label) { return ev(`(()=>{const el=[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)}&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0);if(!el)throw Error('Missing '+${JSON.stringify(label)});el.click()})()`); }
async function fixture(short = false, blankMiddle = false) {
    const z = new JSZip();
    z.file('mimetype', 'application/epub+zip');
    z.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    z.file('OEBPS/content.opf', `<?xml version="1.0"?><package version="3.0" unique-identifier="id" xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">qa-mobile</dc:identifier><dc:title>Mobile QA</dc:title><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${[1, 2, 3].map(n => `<item id="c${n}" href="c${n}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${[1, 2, 3].map(n => `<itemref idref="c${n}"/>`).join('')}</spine></package>`);
    z.file('OEBPS/nav.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>TOC</title></head><body><nav epub:type="toc"><ol>${[1, 2, 3].map(n => `<li><a href="c${n}.xhtml">Chapter ${n}</a></li>`).join('')}</ol></nav></body></html>`);
    for (const n of [1, 2, 3])
        z.file(`OEBPS/c${n}.xhtml`, `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter ${n}</title></head><body><h1>Chapter ${n}</h1>${Array.from({ length: short ? 2 : 60 }, (_, i) => `<p>Chapter ${n} sentence ${i + 1} has enough words for mobile listening and scrolling.</p>`).join('')}</body></html>`);
    if(blankMiddle)z.file('OEBPS/c2.xhtml','<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Empty chapter</title></head><body><div></div></body></html>');
    const data = await z.generateAsync({ type: 'base64' });
    await ev(`(async()=>{const {db}=await import('/src/db/index.ts');await db.books.clear();const b=new Blob([Uint8Array.from(atob('${data}'),c=>c.charCodeAt(0))],{type:'application/epub+zip'});const id=await db.books.add({title:'Mobile QA',author:'QA',fileBlob:b,fileSize:b.size,progressPercent:0,addedAt:new Date()});localStorage.setItem('audioepub_active_book_id',String(id));localStorage.setItem('audioepub-settings-v2',JSON.stringify({state:{selectedVoiceURI:'vi-VN-HoaiMyNeural',engineMode:'edge',ttsEngine:'edge',readingMode:'continuous',autoScroll:true,highlightSentence:true},version:0}))})()`);
    await send('Page.reload');
    await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.tts-sentence').length>${short ? 2 : 20}`, 'fixture render');
}
const active = `window.__qaPlayed?.some(a=>a.src.startsWith('blob:')&&!a.loop&&!a.paused)`;
const loading = `!!document.querySelector('.mobile-only-player .anticon-loading')`;
async function touchAt(x, y, moveY) {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await sleep(90);
    if (moveY !== undefined) {
        for (let i = 1; i <= 6; i++) {
            await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + moveY * i / 6 }] });
            await sleep(25);
        }
    }
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function tapRegression() {
    await ev(`window.__qaEvents=[];for(const type of ['touchstart','touchend','click'])document.querySelector('iframe').contentDocument.addEventListener(type,e=>window.__qaEvents.push({type,trusted:e.isTrusted,target:e.target.tagName}),true)`);
    const point = await ev(`(()=>{const f=document.querySelector('iframe'),r=f.getBoundingClientRect();const spans=[...f.contentDocument.querySelectorAll('.tts-sentence')];const el=spans.find(e=>{const t=e.getBoundingClientRect().top+r.top;return t>220&&t<450});const b=el.getBoundingClientRect();return {x:r.left+b.left+20,y:r.top+b.top+8,marginX:r.left+3}})()`);
    const visible = `document.querySelector('.app-header-bar').style.pointerEvents!=='none'`;
    assert.equal(await ev(visible), true, 'chrome initially visible');
    await touchAt(point.x, point.y);
    await sleep(800);
    assert.equal(await ev(`window.__qaEvents.some(e=>e.type==='touchend'&&e.trusted)`), true, 'browser sends trusted native touch');
    assert.equal(await ev(visible), false, 'native text tap hides chrome once');
    assert.equal(await ev(`document.querySelector('.reader-chapter-bar').style.opacity`), '0', 'chapter header hidden');
    assert.equal(await ev(`getComputedStyle([...document.querySelectorAll('button')].find(e=>e.textContent.includes('Nghe chương này')).parentElement).opacity`), '0', 'reading footer hidden');
    await touchAt(point.marginX, point.y);
    await sleep(800);
    assert.equal(await ev(visible), true, 'native margin tap shows chrome once');
    await touchAt(point.x, point.y, -120);
    await sleep(800);
    assert.equal(await ev(visible), true, 'swipe does not toggle chrome');
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - 70 }] });
    await sleep(60);
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(800);
    assert.equal(await ev(visible), true, 'drag away then return is not a tap');
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
    await sleep(70);
    await send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await sleep(800);
    assert.equal(await ev(visible), true, 'cancelled touch does not toggle chrome');
    assert.equal(await ev(`!!document.querySelector('.mobile-only-player')`), false, 'cancelled long press cannot start listening');
    console.log('PASS native touch text/margin toggles once; swipe, drag-return, cancellation preserve chrome');
}
async function desktopAndOuterGapRegression() {
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await sleep(700);
    const point = await ev(`(()=>{const f=document.querySelector('iframe'),r=f.getBoundingClientRect();const spans=[...f.contentDocument.querySelectorAll('.tts-sentence')];const el=spans.find(e=>{const t=e.getBoundingClientRect().top+r.top;return t>220&&t<450});const b=el.getBoundingClientRect();return {x:r.left+b.left+20,y:r.top+b.top+8}})()`);
    await touchAt(point.x, point.y);
    await sleep(800);
    const hidden = await ev(`(()=>{const h=document.querySelector('.app-header-bar'),b=document.querySelector('.reader-chapter-bar');return {display:getComputedStyle(h).display,chapterOpacity:getComputedStyle(b).opacity}})()`);
    assert.equal(hidden.display, 'none', 'desktop header hides after text tap');
    assert.equal(hidden.chapterOpacity, '0', 'desktop chapter bar hides after text tap');
    await touchAt(point.x, point.y);
    await sleep(800);
    assert.notEqual(await ev(`getComputedStyle(document.querySelector('.app-header-bar')).display`), 'none', 'desktop tap restores header');
    console.log('PASS desktop1280 text tap hides/restores header and chapter bar');
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
    await fixture(true);
    await sleep(500);
    const gap = await ev(`(()=>{for(let y=200;y<560;y+=20){for(let x=2;x<375;x+=20){const el=document.elementFromPoint(x,y);if(el?.matches('.epub-container,.epub-viewer-wrapper'))return {x,y,cls:el.className}}}return null})()`);
    assert(gap, 'short chapter exposes actual outer reader gap');
    await touchAt(gap.x, gap.y);
    await sleep(800);
    assert.equal(await ev(`document.querySelector('.app-header-bar').style.pointerEvents`), 'none', 'tap actual outer gap hides chrome');
    await touchAt(gap.x, gap.y);
    await sleep(800);
    assert.notEqual(await ev(`document.querySelector('.app-header-bar').style.pointerEvents`), 'none', 'tap actual outer gap restores chrome');
    console.log('PASS mobile native touch on actual short-chapter outer gap', JSON.stringify(gap));
}
async function finishMainSentence() {
    await until(`window.__qaMain && !window.__qaMain.paused && window.__qaMain.readyState>=2 && Number.isFinite(window.__qaMain.duration)`, 'main audio ready');
    return ev(`new Promise(resolve=>{const a=window.__qaMain,count=window.__qaMainPlays.length,index=window.__qaCounter();a.addEventListener('ended',()=>resolve({at:performance.now(),count,index}),{once:true,capture:true});a.currentTime=a.duration-0.015})`);
}
async function gapRegression() {
    await ev(`window.__qaMainPlays=[];window.__qaMainEnds=[];window.__qaCounter=()=>Number(document.body.textContent.match(/Câu (\\d+)\\/61/)?.[1]||0);const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(!this.loop&&this.src.startsWith('blob:')){window.__qaMain=this;window.__qaMainPlays.push({at:performance.now()});if(!this.__qaWatched){this.__qaWatched=true;this.addEventListener('ended',()=>window.__qaMainEnds.push(performance.now()),true)}}return original.call(this)}`);
    await ev(`[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Nghe chương này')).click()`);
    await until(`window.__qaMain&&!window.__qaMain.paused`, 'gap test playback');
    await click('Mở trình phát');
    await sleep(400);
    assert.equal(await ev(`document.querySelector('[aria-label="Nghỉ giữa các câu 0 ms"]').getAttribute('aria-pressed')`), 'true', 'default zero pause');
    const timings = [];
    for (const gap of [0, 100, 200, 300]) {
        await click(`Nghỉ giữa các câu ${gap} ms`);
        await sleep(120);
        assert.equal(await ev(`document.querySelector('[aria-label="Nghỉ giữa các câu ${gap} ms"]').getAttribute('aria-pressed')`), 'true');
        const ended = await finishMainSentence();
        if (gap > 0) {
            assert.equal(await ev(`window.__qaCounter()`), ended.index, 'index remains during gap');
        }
        await until(`window.__qaMainPlays.length>${ended.count}`, 'next natural audio');
        const delta = await ev(`window.__qaMainPlays[${ended.count}].at-${ended.at}`);
        assert(delta >= gap - 15, `gap ${gap} too short: ${delta}`);
        assert(delta < gap + 230, `gap ${gap} unexpectedly long: ${delta}`);
        timings.push({ selected: gap, measured: Math.round(delta) });
        await until(`window.__qaCounter()===${ended.index + 1}`, 'next natural index');
    }
    console.log('PASS all natural sentence gaps', JSON.stringify(timings));
    const layout = await ev(`(()=>{const g=[...document.querySelectorAll('[aria-label="Nghỉ giữa các câu"]')].find(e=>e.getBoundingClientRect().width>0);return {overflow:document.documentElement.scrollWidth>innerWidth,width:g.getBoundingClientRect().width,buttons:[...g.querySelectorAll('button')].map(b=>({h:b.getBoundingClientRect().height,w:b.getBoundingClientRect().width}))}})()`);
    assert.equal(layout.overflow, false);
    assert(layout.buttons.every(b => b.h >= 44 && b.w >= 44));
    console.log('PASS 375px gap controls fit with 44px touch targets');
    // Pause inside the300ms interval; resume should start the next sentence exactly once.
    let ended = await finishMainSentence();
    await click('Tạm dừng');
    await sleep(400);
    assert.equal(await ev(`window.__qaMainPlays.length`), ended.count, 'pause cancels gap');
    await click('Phát');
    await until(`window.__qaMainPlays.length>${ended.count}`, 'resume after gap pause');
    await until(`window.__qaCounter()===${ended.index + 1}`, 'pause gap resume goes next');
    console.log('PASS pause cancels pending gap; resume starts next sentence');
    ended = await finishMainSentence();
    const manualAt = await ev(`performance.now()`);
    await click('Câu sau');
    await until(`window.__qaMainPlays.length>${ended.count}`, 'manual next during gap');
    const manualDelta = await ev(`window.__qaMainPlays[${ended.count}].at-${manualAt}`);
    assert(manualDelta < 220, `manual next must bypass300ms pause: ${manualDelta}`);
    await sleep(400);
    assert.equal(await ev(`window.__qaCounter()`), ended.index + 1, 'manual next cancels old pending next');
    console.log('PASS manual next is immediate and cancels pending gap');
    ended = await finishMainSentence();
    await ev(`(()=>{const d=document.querySelector('iframe').contentDocument,t=d.querySelector('[data-tts-idx="30"]');t.dispatchEvent(new MouseEvent('click',{bubbles:true}));t.dispatchEvent(new MouseEvent('click',{bubbles:true}))})()`);
    await until(`window.__qaCounter()===31`, 'seek sentence 31');
    await sleep(400);
    assert.equal(await ev(`window.__qaCounter()`), 31, 'seek cancels gap');
    console.log('PASS double-tap seek cancels pending gap');
    ended = await finishMainSentence();
    await click('Chương sau');
    await until(`document.querySelector('iframe')?.contentDocument?.body.textContent.includes('Chapter 2 sentence')&&window.__qaCounter()===1`, 'new chapter starts first');
    await sleep(400);
    assert.equal(await ev(`window.__qaCounter()`), 1, 'old gap cannot advance new chapter');
    console.log('PASS chapter change cancels pending gap');
    ended = await finishMainSentence();
    await click('Dừng nghe');
    await sleep(400);
    assert.equal(await ev(`!!document.querySelector('.mobile-only-player')`), false);
    assert.equal(await ev(`window.__qaMainPlays.length`), ended.count, 'stop cancels pending gap');
    assert.equal(await ev(`JSON.parse(localStorage.getItem('audioepub-settings-v2')).state.sentenceGapMs`), 300);
    await send('Page.reload');
    await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.tts-sentence')`, 'reload book');
    assert.equal(await ev(`(async()=> (await import('/src/store/useSettingsStore.ts')).useSettingsStore.getState().sentenceGapMs)()`), 300, 'gap persists reload');
    console.log('PASS stop cancels gap and300ms setting persists reload');
}
async function chapterRegression() {
    const results=[];
    for(const gap of [0,300]){
        for(const hidden of [false,true]){
            await fixture();
            await ev(`window.__qaMainPlays=[];window.__qaMainEnds=[];window.__qaCounter=()=>Number(document.body.textContent.match(/Câu (\\d+)\\/61/)?.[1]||0);const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(!this.loop&&this.src.startsWith('blob:')){window.__qaMain=this;window.__qaMainPlays.push({at:performance.now()});if(!this.__qaWatched){this.__qaWatched=true;this.addEventListener('ended',()=>window.__qaMainEnds.push(performance.now()),true)}}return original.call(this)}`);
            await ev(`window.__qaSilentPauses=[];window.__qaMediaStates=[];const p=HTMLMediaElement.prototype.pause;HTMLMediaElement.prototype.pause=function(){if(this.loop)window.__qaSilentPauses.push(performance.now());return p.call(this)};const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator.mediaSession),'playbackState');if(d?.get&&d?.set)Object.defineProperty(navigator.mediaSession,'playbackState',{configurable:true,get(){return d.get.call(this)},set(v){window.__qaMediaStates.push(v);d.set.call(this,v)}})`);
            await ev(`[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Nghe chương này')).click()`);
            await until(`window.__qaMain&&!window.__qaMain.paused`, 'chapter test playing');
            await click('Mở trình phát');await sleep(400);
            await click(`Nghỉ giữa các câu ${gap} ms`);
            await ev(`(()=>{const d=document.querySelector('iframe').contentDocument,t=d.querySelector('[data-tts-idx="60"]');t.dispatchEvent(new MouseEvent('click',{bubbles:true}));t.dispatchEvent(new MouseEvent('click',{bubbles:true}))})()`);
            await until(`window.__qaCounter()===61&&!window.__qaMain.paused`, 'last sentence playing');
            await sleep(200);
            if(hidden)await ev(`Object.defineProperty(document,'hidden',{configurable:true,get:()=>true})`);
            const traces=await ev(`({silent:window.__qaSilentPauses.length,state:window.__qaMediaStates.length})`);
            const last=await finishMainSentence();
            await until(`document.body.textContent.includes('Chapter 2')&&window.__qaCounter()===1&&window.__qaMainPlays.length>${last.count}&&!window.__qaMain.paused`, 'automatic new chapter first narration', 5000);
            await sleep(120);
            const first=await finishMainSentence();
            await until(`window.__qaCounter()===2&&window.__qaMainPlays.length>${first.count}&&!window.__qaMain.paused`, 'automatic new chapter second narration',5000);
            if(hidden){
                await ev(`delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))`);
                await until(`document.querySelector('iframe')?.contentDocument?.body.textContent.includes('Chapter 2 sentence')`, 'visible current chapter');
                await sleep(300);
                assert.equal(await ev(`window.__qaCounter()`),2,'visible sync keeps second sentence');
                assert.equal(await ev(`window.__qaMain.paused`),false,'visible sync keeps narration playing');
                const second=await finishMainSentence();
                await until(`window.__qaCounter()===3&&window.__qaMainPlays.length>${second.count}&&!window.__qaMain.paused`, 'third narration after visibility',5000);
            }
            const beforeManual=await finishMainSentence();
            await click('Chương sau');
            await until(`document.body.textContent.includes('Chapter 3')&&window.__qaCounter()===1&&window.__qaMainPlays.length>${beforeManual.count}&&!window.__qaMain.paused`, 'manual chapter narration starts',5000);
            const manualFirst=await finishMainSentence();
            await until(`window.__qaCounter()===2&&window.__qaMainPlays.length>${manualFirst.count}&&!window.__qaMain.paused`, 'manual chapter second narration',5000);
            console.log('PASS manual chapter during boundary continues through second sentence',JSON.stringify({gap,hidden}));
            assert.equal(await ev(`window.__qaSilentPauses.length`),traces.silent,'chapter transitions must preserve silent keepalive');
            assert.equal(await ev(`window.__qaMediaStates.slice(${traces.state}).includes('paused')`),false,'chapter transitions must not pause MediaSession');
            const log=await ev(`(async()=> (await import('/src/utils/audioDebugLog.ts')).getAudioLog())()`);
            const errors=log.filter(x=>/audio\.error|resume-failed/.test(x));
            assert.equal(errors.length,0,JSON.stringify(errors));
            results.push({gap,hidden,firstTwoPlayed:true});
            console.log('PASS automatic chapter continuation',JSON.stringify(results.at(-1)));
            await click('Dừng nghe');
        }
    }
    console.log('PASS chapter scenarios',JSON.stringify(results));
}
async function chapterEdgeRegression() {
    await fixture(false,true);
    await ev(`window.__qaMainPlays=[];window.__qaMainEnds=[];window.__qaCounter=()=>Number(document.body.textContent.match(/Câu (\\d+)\\/61/)?.[1]||0);const p=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(!this.loop&&this.src.startsWith('blob:')){window.__qaMain=this;window.__qaMainPlays.push({at:performance.now()})}return p.call(this)}`);
    await ev(`[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Nghe chương này')).click()`);
    await until(`window.__qaMain&&!window.__qaMain.paused`, 'blank fixture playing');await click('Mở trình phát');await sleep(300);
    await ev(`(()=>{const d=document.querySelector('iframe').contentDocument,t=d.querySelector('[data-tts-idx="60"]');t.dispatchEvent(new MouseEvent('click',{bubbles:true}));t.dispatchEvent(new MouseEvent('click',{bubbles:true}))})()`);
    await until(`window.__qaCounter()===61&&!window.__qaMain.paused`, 'last before blank');
    const last=await finishMainSentence();
    await until(`document.body.textContent.includes('Chapter 3')&&window.__qaCounter()===1&&window.__qaMainPlays.length>${last.count}&&!window.__qaMain.paused`, 'skip blank middle chapter',7000);
    const first=await finishMainSentence();await until(`window.__qaCounter()===2&&window.__qaMainPlays.length>${first.count}&&!window.__qaMain.paused`, 'narration after blank');
    console.log('PASS blank middle chapter skipped and narration continues');
    await ev(`(()=>{const d=document.querySelector('iframe').contentDocument,t=d.querySelector('[data-tts-idx="60"]');t.dispatchEvent(new MouseEvent('click',{bubbles:true}));t.dispatchEvent(new MouseEvent('click',{bubbles:true}))})()`);
    await until(`window.__qaCounter()===61&&!window.__qaMain.paused`, 'book final sentence');
    const final=await finishMainSentence();
    await until(`!document.querySelector('.mobile-only-player')`, 'final chapter terminal idle',3000);
    await sleep(500);assert.equal(await ev(`window.__qaMainPlays.length`),final.count,'end book cannot restart narration');
    console.log('PASS final chapter finishes idle without replay');
    // Simulate a delayed rejected resume from the old source after a new chapter owns playback.
    await fixture();
    await ev(`window.__qaMainPlays=[];window.__qaMainEnds=[];window.__qaCounter=()=>Number(document.body.textContent.match(/Câu (\\d+)\\/61/)?.[1]||0);const p=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(!this.loop&&this.src.startsWith('blob:')){window.__qaMain=this;window.__qaMainPlays.push({at:performance.now()});if(window.__qaDeferResume){window.__qaDeferResume=false;return new Promise((resolve,reject)=>window.__qaRejectOldResume=reject)}}return p.call(this)}`);
    await ev(`[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Nghe chương này')).click()`);
    await until(`window.__qaMain&&!window.__qaMain.paused`, 'before stale resume');await click('Mở trình phát');await sleep(300);
    await ev(`window.__qaDeferResume=true;Object.defineProperty(window.__qaMain,'paused',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));delete window.__qaMain.paused`);
    await until(`!!window.__qaRejectOldResume`, 'old visibility resume pending');
    await click('Chương sau');await until(`window.__qaCounter()===1&&document.body.textContent.includes('Chapter 2')&&!window.__qaMain.paused`, 'new chapter owns audio');
    await ev(`window.__qaRejectOldResume(new DOMException('Old source interrupted','AbortError'))`);await sleep(250);
    assert.equal(await ev(`window.__qaMain.paused`),false,'late old resume reject cannot pause new chapter');
    const started=await finishMainSentence();await until(`window.__qaCounter()===2&&window.__qaMainPlays.length>${started.count}&&!window.__qaMain.paused`, 'new narration advances after stale reject');
    console.log('PASS delayed old visibility resume rejection cannot pause new chapter');
    await click('Dừng nghe');
}
async function main() {
    console.log('Launching isolated Edge');
    child = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    child.on('error', e => console.error(e));
    let targets;
    for (let i = 0; i < 35; i++) {
        try {
            targets = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(1000) })).json();
            if (targets.length)
                break;
        }
        catch { }
        await sleep(200);
    }
    assert(targets?.length, 'CDP ready');
    console.log('CDP ready');
    ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    ws.on('message', raw => {
        const m = JSON.parse(raw);
        if (m.id) {
            pending.get(m.id)?.(m);
            pending.delete(m.id);
        }
        if (m.method === 'Fetch.requestPaused') {
            const { requestId, request } = m.params;
            (async () => {
                if (request.method === 'POST') {
                    const body = JSON.parse(request.postData);
                    requests.push({ text: body.text, failed: failNetwork });
                    if (failNetwork)
                        return send('Fetch.failRequest', { requestId, errorReason: 'ConnectionReset' });
                    return send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'audio/wav' }], body: wav.toString('base64') });
                }
                return send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from('{"ok":true}').toString('base64') });
            })().catch(e => console.error('intercept', e.message));
        }
    });
    await new Promise(r => ws.once('open', r));
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/tts*', requestStage: 'Request' }] });
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await send('Page.navigate', { url: base });
    await until(`document.querySelector('main')`, 'app load');
    await fixture();
    console.log('Fixture ready');
    if(process.env.QA_CHAPTER_ONLY==='1'){await chapterRegression();await chapterEdgeRegression();return;}
    if (process.env.QA_GAP_ONLY === '1') {
        await gapRegression();
        return;
    }
    await tapRegression();
    if (process.env.QA_TAP_ONLY === '1') {
        await desktopAndOuterGapRegression();
        return;
    }
    await ev(`window.__qaPlayed=[];const p=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(!window.__qaPlayed.includes(this))window.__qaPlayed.push(this);return p.call(this)}`);
    await ev(`(()=>{const el=document.querySelector('iframe').contentDocument.querySelector('[data-tts-idx="20"]');el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[new Touch({identifier:1,target:el,clientX:100,clientY:200})]}))})()`);
    await sleep(650);
    await until(active, 'midchapter playing');
    assert.equal(await ev(`document.body.textContent.includes('21/61')`), true, 'fixture starts at middle sentence');
    await click('Mở trình phát');
    await sleep(400);
    await click('Chương sau');
    await until(`document.querySelector('iframe')?.contentDocument?.body.textContent.includes('Chapter 2 sentence')`, 'next rendered');
    await until(`document.body.textContent.includes('Câu 1/61')`, 'new sentence one');
    await until(active, 'new playing');
    const layout = await ev(`(()=>{const f=document.querySelector('iframe');return {frames:document.querySelectorAll('iframe').length,top:f.contentDocument.querySelector('[data-tts-idx="0"]').getBoundingClientRect().top,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
    assert.equal(layout.frames, 1);
    assert.equal(layout.overflow, false);
    assert(layout.top < 400, JSON.stringify(layout));
    console.log('PASS 375px next chapter: sentence 1, top, one iframe, no overflow');
    await click('Tạm dừng');
    await click('Chương sau');
    await until(`document.querySelector('iframe')?.contentDocument?.body.textContent.includes('Chapter 3 sentence')`, 'paused chapter');
    await sleep(400);
    assert.equal(await ev(active), false);
    console.log('PASS paused chapter remains paused');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await sleep(500);
    await click('Phát');
    await until(active, 'resume');
    failNetwork = true;
    for (let i = 0; i < 3; i++) {
        await click('Câu sau');
        await sleep(250);
    }
    await until(loading, 'retry loading');
    const failed = requests.filter(x => x.failed).at(-1);
    assert(failed);
    failNetwork = false;
    await until(`${active}&&!(${loading})`, 'route recovery', 22000);
    assert(requests.some(x => !x.failed && x.text === failed.text), 'same sentence retry');
    console.log('PASS 390px route interruption retries same sentence without online event');
    failNetwork = true;
    for (let i = 0; i < 4; i++) {
        await click('Câu sau');
        await sleep(100);
    }
    await until(loading, 'second failure');
    await click('Tạm dừng');
    failNetwork = false;
    await ev(`window.dispatchEvent(new Event('online'))`);
    await sleep(2200);
    assert.equal(await ev(active), false);
    console.log('PASS pause cancels recovery after online');
    await click('Chương trước');
    await until(`document.querySelector('iframe')?.contentDocument?.body.textContent.includes('Chapter 2 sentence')`, 'chapter 2 before background');
    await click('Phát');
    await until(active, 'before hidden playback');
    await ev(`Object.defineProperty(document,'hidden',{configurable:true,get:()=>true})`);
    await click('Chương sau');
    await until(`document.body.textContent.includes('Câu 1/61')&&${active}`, 'headless chapter playing');
    assert.equal(await ev(`document.querySelector('iframe').contentDocument.body.textContent.includes('Chapter 2 sentence')`), true);
    await click('Câu sau');
    await until(`document.body.textContent.includes('Câu 2/61')&&${active}`, 'headless sentence 2');
    await ev(`delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))`);
    await until(`document.querySelector('iframe')?.contentDocument?.body.textContent.includes('Chapter 3 sentence')`, 'visible chapter catchup');
    await sleep(300);
    assert.equal(await ev(`document.body.textContent.includes('Câu 2/61')`), true);
    console.log('PASS simulated hidden -> visible preserves spoken sentence and block indices');
    await click('Tạm dừng');
    await click('Chương trước');
    await sleep(300);
    await click('Chương trước');
    await until(`document.querySelector('iframe')?.contentDocument?.body.textContent.includes('Chapter 1 sentence')`, 'rapid setup');
    await click('Chương sau');
    await click('Chương sau');
    await until(`document.querySelector('iframe')?.contentDocument?.body.textContent.includes('Chapter 3 sentence')`, 'rapid final selection');
    await sleep(300);
    assert.equal(await ev(`document.body.textContent.includes('Câu 1/61')`), true);
    console.log('PASS rapid chapter selection final chapter owns sentence 1');
    await click('Phát');
    await until(active, 'before stop test');
    failNetwork = true;
    for (let i = 0; i < 4; i++) {
        await click('Câu sau');
        await sleep(100);
    }
    await until(loading, 'stop retry loading');
    await click('Dừng nghe');
    failNetwork = false;
    await ev(`window.dispatchEvent(new Event('online'))`);
    await sleep(2200);
    assert.equal(await ev(`!!document.querySelector('.mobile-only-player')`), false);
    assert.equal(await ev(active), false);
    console.log('PASS stop cancels recovery and does not reopen player');
    console.log(JSON.stringify({ requests: requests.length, failed: requests.filter(x => x.failed).length, realSafari: false, realTailscale: false }));
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; }).finally(async () => {
    if (ws?.readyState === WebSocket.OPEN)
        await send('Browser.close').catch(() => { });
    ws?.close();
    child?.kill();
});
