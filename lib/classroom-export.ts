import { classLabel, type Classroom } from './studio-types';
export function classroomCsv(data: Classroom): string {
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (/^\s*[=+@\-]|^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows: unknown[][] = [
    [
      '班級',
      '組別',
      '類型',
      '隊伍編號',
      '人數',
      '第一位姓名',
      '第二位姓名',
      '第三位姓名',
      '修改／選擇',
      '差異／理由',
      '查證／待確認',
      '共同改寫',
      '引用比較卡',
      '更新時間',
    ],
    ...data.pairs.map((c) => [
      classLabel(c.classId),
      c.groupId,
      '同儕比較卡',
      c.pairNo,
      c.members,
      c.nameOne,
      c.nameTwo,
      c.members === 3 ? c.nameThree : '',
      c.change,
      c.difference,
      c.verification,
      '',
      '',
      c.updatedAt,
    ]),
    ...data.conclusions.map((c) => [
      classLabel(c.classId),
      c.groupId,
      '共同結論',
      '',
      '',
      '',
      '',
      '',
      c.choice,
      c.reason,
      c.uncertainty,
      c.rewrite,
      c.evidence
        .map((id) => '第' + data.pairs.find((p) => p.id === id)?.pairNo + '隊')
        .join('、'),
      c.updatedAt,
    ]),
  ];
  return '\ufeff' + rows.map((row) => row.map(cell).join(',')).join('\r\n');
}
