import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const transpile=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
writeFileSync('outputs/verify-studio-types.mjs',transpile('lib/studio-types.ts'));
writeFileSync('outputs/verify-classroom-export.mjs',transpile('lib/classroom-export.ts').replace("'./studio-types'","'./verify-studio-types.mjs'"));
const {classLabel,parseClassId,memberNames}=await import('../outputs/verify-studio-types.mjs');
const {classroomCsv}=await import('../outputs/verify-classroom-export.mjs');
for(let n=1;n<=4;n++){const label='ABCD'[n-1];assert.equal(classLabel(n),label);assert.equal(parseClassId(label),n);assert.equal(parseClassId(label.toLowerCase()),n);assert.equal(parseClassId(String(n)),n)}
const card={id:'x',classId:4,groupId:1,pairNo:2,members:3,nameThree:'測試同學丙',nameOne:'測試同學甲',nameTwo:'測試同學乙',change:'依講義',difference:'有差異',verification:'待查證',updatedAt:'2026-09-02'};
const final={id:'4-1',classId:4,groupId:1,choice:'選擇',reason:'理由',rewrite:'改寫',uncertainty:'未確認',evidence:['x'],updatedAt:'2026-09-02'};
const csv=classroomCsv({classId:4,pairs:[card],conclusions:[final]});
assert(csv.includes('"D","1","同儕比較卡","2","3","測試同學甲","測試同學乙","測試同學丙"'));
assert(csv.includes('"D","1","共同結論","","","","","","選擇"'));
assert(csv.includes('"第一位姓名","第二位姓名","第三位姓名"'));
assert(classroomCsv({classId:4,pairs:[{...card,nameOne:'=SUM(A1:A2)'}],conclusions:[]}).includes("\"'=SUM(A1:A2)\""));
console.log('PASS: A–D labels, old/numeric and new/alphabetic links, both CSV names, conclusion column alignment and CSV escaping.');


assert.equal(memberNames(card),'測試同學甲、測試同學乙、測試同學丙');
assert.equal(memberNames({...card,members:2}),'測試同學甲、測試同學乙');
assert(!classroomCsv({classId:4,pairs:[{...card,members:2}],conclusions:[]}).includes('測試同學丙'));
assert.equal(csv.split('\r\n')[0].split(',').length,14);
assert.equal(csv.split('\r\n')[2].split(',').length,14);
console.log('PASS: 2/3 member names and 14-column CSV alignment.');
