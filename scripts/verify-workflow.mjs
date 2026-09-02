import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const url='http://localhost:3000/api/studio';
const ids=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
const clients={a:'',b:''}, checks=[];
async function req(body,client='a'){
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Origin':'http://localhost:3000',...(clients[client]?{cookie:clients[client]}:{})},body:JSON.stringify(body)});
 const cookie=r.headers.get('set-cookie');if(cookie)clients[client]=cookie.split(';')[0];
 return {status:r.status,body:await r.json()};
}
const card={action:'pair',classId:4,groupId:6,pairNo:99,members:2,change:'測試：限制根據重點卡',difference:'測試：修改前後具體差異',verification:'測試：對照重點卡第1點',version:0,id:ids[0]};
const check=(name,actual,expected)=>{assert.equal(actual,expected,name);checks.push(name)};
const pre=await (await fetch(url+'?classId=4')).json();
assert(!pre.pairs.some(p=>p.groupId===6&&p.pairNo>=99)&&!pre.conclusions.some(p=>p.groupId===6),'Local test group must be empty');
try{
 check('拒絕不存在的班級',(await req({...card,classId:5})).status,400);
 check('拒絕空白欄位',(await req({...card,change:' '})).status,400);
 check('提交第一張卡',(await req(card)).status,201);
 check('重送相同提交不產生第二張',(await req(card)).status,200);
 check('重複兩人編號保護',(await req({...card,id:ids[1]},'b')).status,409);
 check('其他裝置不能覆蓋比較卡',(await req({...card,change:'其他裝置改寫',version:1},'b')).status,403);
 check('原提交者修訂',(await req({...card,change:'已修訂測試',version:1})).status,200);
 check('舊版本不覆蓋新版本',(await req({...card,change:'舊版衝突',version:1})).status,409);
 check('跨班同編號可獨立提交',(await req({...card,classId:3,id:ids[2]},'b')).status,201);
 check('三人同行可提交',(await req({...card,pairNo:100,members:3,id:ids[1]},'b')).status,201);
 const final={action:'conclusion',classId:4,groupId:6,choice:'測試共同选择',evidence:[ids[0]],reason:'測試具體依據',rewrite:'測試共同修訂Prompt',uncertainty:'測試仍需查證',version:0,confirmed:true};
 check('拒絕引用別班卡片',(await req({...final,evidence:[ids[2]]})).status,400);
 check('要求組員確認',(await req({...final,confirmed:false})).status,400);
 check('共同結論提交',(await req(final)).status,201);
 check('共同結論重送不重複',(await req(final)).status,200);
 check('其他代表不能覆蓋結論',(await req({...final,version:1,reason:'其他代表改寫'},'b')).status,403);
 const results=await Promise.all([req({...final,version:1,reason:'同時修訂甲'}),req({...final,version:1,reason:'同時修訂乙'})]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);checks.push('同時修訂只有一筆成功');
 const read=await (await fetch(url+'?classId=4',{headers:{cookie:clients.a}})).json();
 check('新連線可以讀到两張卡',read.pairs.filter(p=>ids.includes(p.id)).length,2);
 assert(!read.pairs.some(p=>p.id===ids[2]));checks.push('班級查詢隔離');
 assert(read.pairs.some(p=>p.id===ids[0]&&p.canEdit));checks.push('原提交者修訂權限讀回');
 assert(!JSON.stringify(read).includes('"owner"'));checks.push('讀取結果不暴露提交者識別');
 writeFileSync('verification.json',JSON.stringify({date:new Date().toISOString(),checks,status:'passed'},null,2));
 console.log(JSON.stringify({status:'passed',checks:checks.length,names:checks},null,2));
}finally{
 writeFileSync('.openai/test-cleanup.sql',"DELETE FROM conclusions WHERE id='4-6' AND choice='測試共同选择';\nDELETE FROM pairs WHERE id IN ("+ids.map(x=>"'"+x+"'").join(',')+");\n");
}

