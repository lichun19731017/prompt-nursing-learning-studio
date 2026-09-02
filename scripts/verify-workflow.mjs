import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const url='http://localhost:3000/api/studio';
const ids=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
const clients={a:'',b:''}, checks=[];
async function req(body,client='a',method='POST',origin='http://localhost:3000'){
 const r=await fetch(url,{method,headers:{'Content-Type':'application/json','Origin':origin,...(clients[client]?{cookie:clients[client]}:{})},body:JSON.stringify(body)});
 const cookie=r.headers.get('set-cookie');if(cookie)clients[client]=cookie.split(';')[0];
 const text=await r.text();
 let responseBody;try{responseBody=JSON.parse(text)}catch{responseBody={error:text}}
 return {status:r.status,body:responseBody};
}
const card={action:'pair',classId:4,groupId:6,pairNo:99,members:2,nameOne:'測試同學甲',nameTwo:'測試同學乙',change:'測試：限制根據講義',difference:'測試：修改前後具體差異',verification:'測試：對照講義第1點',version:0,id:ids[0]};
const check=(name,actual,expected)=>{assert.equal(actual,expected,name);checks.push(name)};
const otherPre=await (await fetch(url+'?classId=3')).json();
assert(!otherPre.conclusions.some(p=>p.groupId===6),'Local second test group must have no conclusion');
const pre=await (await fetch(url+'?classId=4')).json();
assert(!pre.pairs.some(p=>p.groupId===6&&p.pairNo>=99)&&!pre.conclusions.some(p=>p.groupId===6),'Local test group must be empty');
try{
 check('拒絕不存在的班級',(await req({...card,classId:5})).status,400);
 check('拒絕空白欄位',(await req({...card,change:' '})).status,400);
 check('第一位姓名必填',(await req({...card,nameOne:' '})).status,400);
 check('第二位姓名必填',(await req({...card,nameTwo:''})).status,400);
 check('姓名長度限制',(await req({...card,nameOne:'甲'.repeat(81)})).status,400);
 check('固定兩人',(await req({...card,members:3})).status,400);
 check('提交第一張卡',(await req(card)).status,201);
 check('重送相同提交不產生第二張',(await req(card)).status,200);
 check('重複兩人編號保護',(await req({...card,id:ids[1]},'b')).status,409);
 check('其他裝置不能覆蓋比較卡',(await req({...card,change:'其他裝置改寫',version:1},'b')).status,403);
 check('原提交者修訂',(await req({...card,change:'已修訂測試',version:1})).status,200);
 check('舊版本不覆蓋新版本',(await req({...card,change:'舊版衝突',version:1})).status,409);
 check('跨班同編號可獨立提交',(await req({...card,classId:3,id:ids[2]},'b')).status,201);
 check('第二對兩人可提交',(await req({...card,pairNo:100,members:2,id:ids[1]},'b')).status,201);
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
 check('第一位姓名讀回',read.pairs.find(p=>p.id===ids[0]).nameOne,card.nameOne);
 check('第二位姓名讀回',read.pairs.find(p=>p.id===ids[0]).nameTwo,card.nameTwo);
 assert(!read.pairs.some(p=>p.id===ids[2]));checks.push('班級查詢隔離');
 assert(read.pairs.some(p=>p.id===ids[0]&&p.canEdit));checks.push('原提交者修訂權限讀回');
 assert(!JSON.stringify(read).includes('"owner"'));checks.push('讀取結果不暴露提交者識別');

 const deletion={action:'pair',classId:4,groupId:6,id:ids[0],version:2,confirmed:true};
 check('刪除需要確認',(await req({...deletion,confirmed:false},'a','DELETE')).status,400);
 check('未持有提交者憑證不能刪除',(await req(deletion,'guest','DELETE')).status,403);
 check('其他提交者不能刪除',(await req(deletion,'b','DELETE')).status,403);
 check('錯誤班級不能刪除',(await req({...deletion,classId:3},'a','DELETE')).status,403);
 check('錯誤組別不能刪除',(await req({...deletion,groupId:5},'a','DELETE')).status,403);
 check('跨站刪除遭拒',(await req(deletion,'a','DELETE','https://other.example')).status,403);
 check('舊版本不能刪除',(await req({...deletion,version:1},'a','DELETE')).status,409);
 check('被共同結論引用不能刪除',(await req(deletion,'a','DELETE')).status,409);
 const conclusionNow=read.conclusions.find(c=>c.groupId===6);
 check('調整共同結論引用',(await req({...final,reason:conclusionNow.reason,evidence:[ids[1]],version:conclusionNow.version})).status,200);
 const raceUpdate=await Promise.all([
   req(deletion,'a','DELETE'),
   req({...final,evidence:[ids[0]],version:conclusionNow.version+1})
 ]);
 assert((raceUpdate[0].status===200&&[400,409].includes(raceUpdate[1].status))||(raceUpdate[0].status===409&&raceUpdate[1].status===200));
 checks.push('同時刪除與修改引用不產生失效引用');
 if(raceUpdate[0].status!==200){
   const changed=await (await fetch(url+'?classId=4')).json();
   const current=changed.conclusions.find(c=>c.groupId===6);
   check('解除同時新增的引用',(await req({...final,evidence:[ids[1]],version:current.version})).status,200);
   check('解除引用後原提交者可刪除',(await req(deletion,'a','DELETE')).status,200);
 }else checks.push('原提交者成功刪除未引用卡片');
 check('重複刪除回報不存在',(await req(deletion,'a','DELETE')).status,404);
 check('已刪除卡片不能由舊修訂復活',(await req({...card,version:2})).status,409);
 const after=await (await fetch(url+'?classId=4')).json();
 assert(!after.pairs.some(c=>c.id===ids[0]));checks.push('刪除後重新讀取已移除');
 assert(after.pairs.some(c=>c.id===ids[1]));checks.push('其他同學卡片仍保留');
 assert.deepEqual(after.conclusions.find(c=>c.groupId===6).evidence,[ids[1]]);checks.push('共同結論與有效引用仍保留');
 const newConclusion={...final,classId:3,version:0,evidence:[ids[2]]};
 const otherDeletion={...deletion,classId:3,id:ids[2],version:1};
 const raceInsert=await Promise.all([req(otherDeletion,'b','DELETE'),req(newConclusion,'b')]);
 assert((raceInsert[0].status===200&&[400,409].includes(raceInsert[1].status))||(raceInsert[0].status===409&&raceInsert[1].status===201));
 const classThree=await (await fetch(url+'?classId=3')).json();
 assert(classThree.conclusions.every(c=>c.evidence.every(id=>classThree.pairs.some(p=>p.id===id))));
 checks.push('同時刪除與首次建立結論不產生失效引用');
 writeFileSync('verification.json',JSON.stringify({date:new Date().toISOString(),checks,status:'passed'},null,2));
 console.log(JSON.stringify({status:'passed',checks:checks.length,names:checks},null,2));
}finally{
 writeFileSync('.openai/test-cleanup.sql',"DELETE FROM conclusions WHERE id IN ('4-6','3-6') AND choice='測試共同选择';\nDELETE FROM pairs WHERE id IN ("+ids.map(x=>"'"+x+"'").join(',')+");\n");
}

