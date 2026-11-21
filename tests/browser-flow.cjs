const puppeteer=require(process.env.PUPPETEER_CORE_PATH || 'puppeteer-core');
(async()=>{
 const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
 const p=await browser.newPage();await p.setViewport({width:430,height:920,deviceScaleFactor:1.5});
 p.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await p.goto('http://127.0.0.1:8899/amr.html',{waitUntil:'networkidle2'});
 await p.screenshot({path:'/downloads/amr-auth-signin.png'});
 await p.type('#adminEmail','admin@example.test');await p.type('#adminPassword','Local-test-only-739!');await p.click('#pinBtn');
 await p.waitForFunction(()=>document.querySelector('#allList').textContent.includes('أم يوسف'),{timeout:20000});
 await p.screenshot({path:'/downloads/amr-auth-approved.png',fullPage:true});
 const context=await browser.createBrowserContext();const parent=await context.newPage();
 await parent.setViewport({width:430,height:920,deviceScaleFactor:1.5});
 await parent.goto('http://127.0.0.1:8899/parent.html',{waitUntil:'networkidle2'}).catch(()=>{});
 // Authenticate synthetic fixture through emulator, never production.
 await parent.goto('http://127.0.0.1:8899/amr.html',{waitUntil:'networkidle2'});
 await parent.type('#adminEmail','parent1@test.com');await parent.type('#adminPassword','Local-test-only-739!');await parent.click('#pinBtn');
 await parent.waitForFunction(()=>document.querySelector('#adminError').textContent.includes('ليس'),{timeout:20000});
 console.log('PASS: non-admin rejected by admin UI');
 // Sign in via Firebase emulator SDK on the parent page before the auth route guard redirects.
 // Admin guard signs out non-admin accounts, so seed parent auth via isolated fixture page instead.
 await parent.goto('http://127.0.0.1:8899/tests/auth-fixture.html',{waitUntil:'networkidle2'});
 await parent.waitForFunction(()=>document.body.dataset.ready==='yes');
 await parent.goto('http://127.0.0.1:8899/parent.html',{waitUntil:'networkidle2'});
 await parent.waitForFunction(()=>document.querySelector('#app').style.display==='block');
 await parent.type('#childCodeInput','USR-123456');await parent.click('#addChildBtn');
 await parent.waitForFunction(()=>document.querySelector('#toast').textContent.includes('طلب الربط'),{timeout:15000});
 await parent.screenshot({path:'/downloads/parent-safe-request.png',fullPage:true});
 await p.click('[data-tab="links"]');
 await p.waitForFunction(()=>document.querySelector('#linkRequests').textContent.includes('USR-123456'));
 p.on('dialog',d=>d.accept());
 await p.click('#linkRequests button.ok');
 await p.waitForFunction(()=>document.querySelector('#linkRequests').textContent.includes('لا توجد'),{timeout:15000});
 await parent.waitForFunction(()=>document.querySelector('#childrenList').textContent.includes('18'),{timeout:15000});
 await parent.waitForFunction(()=>getComputedStyle(document.querySelector('#toast')).opacity==='0');
 await parent.screenshot({path:'/downloads/parent-safe-results.png',fullPage:true});
 await p.type('#pLookup','PAR-555555');await p.click('#pLookupBtn');
 await p.waitForFunction(()=>document.querySelector('#pResult').textContent.includes('يوسف أحمد'),{timeout:15000});
 await p.screenshot({path:'/downloads/amr-auth-links.png',fullPage:true});
 await p.click('#lockBtn');await p.waitForFunction(()=>document.querySelector('#pinScreen').style.display==='flex');
 if(await p.$eval('main',x=>!x.hidden))throw new Error('Admin contents remain visible after sign-out');
 console.log('PASS: parent request -> authenticated admin approval -> private child results; signout clears view');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
