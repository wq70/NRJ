// Runs in the remote WebView; never receives a Capacitor bridge, credentials or app state.
export const commerceCaptureScript = String.raw`(() => {
  const visible = e => { const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0 && r.height>0 && r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth && s.visibility!=='hidden' && s.display!=='none'; };
  const sensitive = /login|passport|signin|cashier|payment|\/pay(?:\/|\?|$)|address|checkout/i.test(location.href) ||
    [...document.querySelectorAll('input')].some(e => visible(e) && /password|one-time-code|验证码|密码|身份证|银行卡/.test([e.type,e.autocomplete,e.placeholder,e.name].join(' '))) ||
    [...document.querySelectorAll('h1,h2,[role=heading]')].some(e => visible(e) && /登录|验证|支付|收货地址|确认订单/.test(e.textContent||''));
  const token = Date.now().toString(36)+Math.random().toString(36).slice(2);
  const state = { token, nodes: new Map(), used: false, url: location.href };
  window.__nrjCommercePage=state;
  const targets=[]; const texts=[];
  const blocked=/支付|付款|提交|下单|立即购买|立即抢购|确认|确定|拼单|开团|免密|购买并|取消订单|退款|删除|登录|验证|授权|退出|注销|同意|绑定|解绑|密码|地址|电话|联系|发送/;
  if(!sensitive) {
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let n; let total=0;
    while((n=walker.nextNode()) && total<16000) {
      const e=n.parentElement; if(!e || e.closest('script,style,input,textarea,select,[contenteditable=true],noscript') || !visible(e))continue;
      const t=(n.textContent||'').trim(); if(t){texts.push(t);total+=t.length;}
    }
    for(const e of document.querySelectorAll('a,button,[role=button],[onclick]')) {
      if(targets.length>=70)break;
      const label=(e.innerText||e.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,100);
      if(!visible(e)||!label||blocked.test(label)||e.disabled||e.getAttribute('aria-disabled')==='true')continue;
      if(e.tagName==='A') {
        const href=e.getAttribute('href')||'';
        if(href && !href.startsWith('#')) {
          let u;try{u=new URL(href,location.href)}catch{continue}
          if(u.protocol!=='https:' || /pay|order\/submit|checkout|buy_now|login|passport/i.test(u.href))continue;
        }
      }
      if(e.tagName==='BUTTON' && e.type==='submit' && e.closest('form'))continue;
      const id=String(targets.length); state.nodes.set(id,{element:e,label,href:e.getAttribute('href')});targets.push({id,label});
    }
  }
  return JSON.stringify({url:location.href,title:document.title,text:texts.join('\n'),token,sensitive,targets});
})()`

export function commerceClickScript(token: string, id: string) {
  return `(() => {
    const s=window.__nrjCommercePage;
    if(!s || s.token!==${JSON.stringify(token)} || s.used || s.url!==location.href) return JSON.stringify({ok:false,reason:'页面已变化，请重新看看当前页。'});
    const item=s.nodes.get(${JSON.stringify(id)}); const e=item?.element;
    if(!e || !e.isConnected) return JSON.stringify({ok:false,reason:'商品入口已变化。'});
    const label=(e.innerText||e.getAttribute('aria-label')||'').trim().replace(/\\s+/g,' ').slice(0,100);
    if(label!==item.label || e.getAttribute('href')!==item.href || e.disabled || e.getAttribute('aria-disabled')==='true') return JSON.stringify({ok:false,reason:'商品入口已更新，请重新看看当前页。'});
    const r=e.getBoundingClientRect();
    if(r.width<=0||r.height<=0||r.bottom<=0||r.top>=innerHeight) return JSON.stringify({ok:false,reason:'目标已不在当前页面，请重新读取。'});
    const hit=document.elementFromPoint(Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)),Math.max(0,Math.min(innerHeight-1,r.top+r.height/2)));
    if(!hit || (hit!==e && !e.contains(hit))) return JSON.stringify({ok:false,reason:'目标被弹层遮挡，请先处理弹层。'});
    s.used=true;e.click();return JSON.stringify({ok:true,label:item.label});
  })()`
}
