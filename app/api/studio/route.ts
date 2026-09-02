import { getDb } from '@/lib/db';
import type { PairCard, Conclusion } from '@/lib/studio-types';
export const dynamic = 'force-dynamic';
type Row = Record<string, any>;
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const headers = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};
function reply(data: unknown, status = 200, cookie?: string) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, ...(cookie ? { 'Set-Cookie': cookie } : {}) },
  });
}
function bounded(n: unknown, low: number, high: number, label: string) {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < low || n > high)
    throw new HttpError(400, label + '不正確。');
  return n;
}
function content(v: unknown, label: string, max = 1500) {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max)
    throw new HttpError(400, '請填寫' + label + '（最多' + max + '字）。');
  return v.trim();
}
function identifier(v: unknown) {
  if (typeof v !== 'string' || !/^[a-f0-9-]{36}$/.test(v))
    throw new HttpError(400, '提交識別不正確，請重新整理。');
  return v;
}
function session(request: Request) {
  const raw = request.headers
    .get('cookie')
    ?.match(/(?:^|;\s*)studio_session=([a-f0-9-]{36})(?:;|$)/)?.[1];
  return raw || null;
}
async function hash(v: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return Array.from(new Uint8Array(d), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
}
function pair(r: Row, owner: string): PairCard {
  return {
    id: r.id,
    classId: r.class_id,
    groupId: r.group_id,
    pairNo: r.pair_no,
    members: r.members,
    nameOne: r.name_one || '',
    nameTwo: r.name_two || '',
    change: r.change,
    difference: r.difference,
    verification: r.verification,
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    canEdit: r.owner === owner,
  };
}
function conclusion(r: Row, owner: string): Conclusion {
  return {
    id: r.id,
    classId: r.class_id,
    groupId: r.group_id,
    choice: r.choice,
    evidence: JSON.parse(r.evidence),
    reason: r.reason,
    rewrite: r.rewrite,
    uncertainty: r.uncertainty,
    version: r.version,
    updatedAt: r.updated_at,
    canEdit: r.owner === owner,
  };
}
function failure(e: unknown) {
  if (e instanceof HttpError) return reply({ error: e.message }, e.status);
  if (
    e instanceof Error &&
    /UNIQUE constraint failed: pairs.class_id/.test(e.message)
  )
    return reply(
      { error: '這個兩人編號已有人使用。請確認是同一對同學，或改用其他編號。' },
      409,
    );
  if (e instanceof Error && /UNIQUE constraint failed/.test(e.message))
    return reply({ error: '已有同學送出這份資料，請重新整理後確認。' }, 409);
  console.error(
    'Studio request failed',
    e instanceof Error ? e.message : 'unknown',
  );
  return reply(
    { error: '目前無法連線到共用資料。你的文字仍保留在畫面上，請稍後重試。' },
    503,
  );
}
export async function GET(request: Request) {
  try {
    const classId = bounded(
      Number(new URL(request.url).searchParams.get('classId')),
      1,
      4,
      '班級',
    );
    const s = session(request),
      owner = s ? await hash(s) : '';
    const db = getDb();
    const [p, c] = await Promise.all([
      db
        .prepare(
          'SELECT * FROM pairs WHERE class_id = ? ORDER BY group_id, pair_no',
        )
        .bind(classId)
        .all<Row>(),
      db
        .prepare(
          'SELECT * FROM conclusions WHERE class_id = ? ORDER BY group_id',
        )
        .bind(classId)
        .all<Row>(),
    ]);
    return reply({
      classId,
      pairs: p.results.map((r) => pair(r, owner)),
      conclusions: c.results.map((r) => conclusion(r, owner)),
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return failure(e);
  }
}
async function readBody(request: Request): Promise<Row> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, '請從本課程網頁送出資料。');
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new HttpError(415, '資料格式不正確。');
  const raw = await request.text();
  if (raw.length > 18000)
    throw new HttpError(413, '內容過長，請保留關鍵修改與依據。');
  let b: Row;
  try {
    b = JSON.parse(raw);
  } catch {
    throw new HttpError(400, '資料格式不正確。');
  }
  if (!b || typeof b !== 'object' || Array.isArray(b))
    throw new HttpError(400, '資料格式不正確。');
  return b;
}
export async function POST(request: Request) {
  try {
    const b = await readBody(request);
    const classId = bounded(b.classId, 1, 4, '班級'),
      groupId = bounded(b.groupId, 1, 6, '組別');
    const existingSession = session(request),
      s = existingSession || crypto.randomUUID(),
      owner = await hash(s);
    const cookie = existingSession
      ? undefined
      : 'studio_session=' +
        s +
        '; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800' +
        (new URL(request.url).protocol === 'https:' ? '; Secure' : '');
    const db = getDb(),
      now = new Date().toISOString();
    if (b.action === 'pair') {
      const id = identifier(b.id),
        pairNo = bounded(b.pairNo, 1, 100, '兩人編號'),
        members = bounded(b.members, 2, 2, '人數');
      const nameOne = content(b.nameOne, '第一位同學姓名', 80),
        nameTwo = content(b.nameTwo, '第二位同學姓名', 80);
      const change = content(b.change, '關鍵修改'),
        difference = content(b.difference, '回答差異'),
        verification = content(b.verification, '查證結果');
      const previous = await db
        .prepare('SELECT * FROM pairs WHERE id = ?')
        .bind(id)
        .first<Row>();
      if (previous) {
        if (
          previous.class_id !== classId ||
          previous.group_id !== groupId ||
          previous.owner !== owner
        )
          throw new HttpError(403, '只能由原提交者在同一裝置修改這張卡。');
        if (
          previous.change === change &&
          previous.difference === difference &&
          previous.verification === verification &&
          previous.pair_no === pairNo &&
          previous.members === members &&
          previous.name_one === nameOne &&
          previous.name_two === nameTwo
        )
          return reply(
            { ok: true, id, version: previous.version },
            200,
            cookie,
          );
        const v = bounded(b.version, 1, 10000, '版本');
        const result = await db
          .prepare(
            'UPDATE pairs SET pair_no=?, members=?, name_one=?, name_two=?, change=?, difference=?, verification=?, updated_at=?, version=version+1 WHERE id=? AND version=? AND owner=?',
          )
          .bind(
            pairNo,
            members,
            nameOne,
            nameTwo,
            change,
            difference,
            verification,
            now,
            id,
            v,
            owner,
          )
          .run();
        if (!result.meta.changes)
          throw new HttpError(409, '這張卡已有更新，請重新整理後再修改。');
        return reply({ ok: true, id, version: v + 1 }, 200, cookie);
      }
      if (b.version && b.version !== 0)
        throw new HttpError(409, '這張卡不存在，請重新整理。');
      await db
        .prepare(
          'INSERT INTO pairs (id,class_id,group_id,pair_no,members,name_one,name_two,change,difference,verification,owner,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?)',
        )
        .bind(
          id,
          classId,
          groupId,
          pairNo,
          members,
          nameOne,
          nameTwo,
          change,
          difference,
          verification,
          owner,
          now,
          now,
        )
        .run();
      return reply({ ok: true, id, version: 1 }, 201, cookie);
    }
    if (b.action === 'conclusion') {
      if (b.confirmed !== true)
        throw new HttpError(400, '請先與組員確認共同結論。');
      const choice = content(b.choice, '保留的修改'),
        reason = content(b.reason, '選擇理由'),
        rewrite = content(b.rewrite, '共同改寫'),
        uncertainty = content(b.uncertainty, '待查證或不同意見');
      if (
        !Array.isArray(b.evidence) ||
        b.evidence.length < 1 ||
        b.evidence.length > 50 ||
        b.evidence.some((x: unknown) => typeof x !== 'string')
      )
        throw new HttpError(400, '請選擇至少一張本組比較卡作為依據。');
      const ids = [...new Set<string>(b.evidence)];
      const groupCards = await db
        .prepare('SELECT id FROM pairs WHERE class_id=? AND group_id=?')
        .bind(classId, groupId)
        .all<{ id: string }>();
      if (ids.some((id) => !groupCards.results.some((r) => r.id === id)))
        throw new HttpError(400, '引用的比較卡必須來自本班本組。');
      const id = classId + '-' + groupId,
        old = await db
          .prepare('SELECT * FROM conclusions WHERE id=?')
          .bind(id)
          .first<Row>();
      const evidence = JSON.stringify(ids);
      // Validate references atomically with the write, including concurrent deletion.
      const validEvidence =
        'NOT EXISTS (SELECT 1 FROM json_each(?) AS requested WHERE NOT EXISTS (SELECT 1 FROM pairs WHERE id=requested.value AND class_id=? AND group_id=?))';

      if (old) {
        if (old.owner !== owner)
          throw new HttpError(
            403,
            '已有一位代表提交共同結論，請由原提交者在同一裝置修訂。',
          );
        if (
          old.choice === choice &&
          old.reason === reason &&
          old.rewrite === rewrite &&
          old.uncertainty === uncertainty &&
          old.evidence === evidence
        )
          return reply({ ok: true, id, version: old.version }, 200, cookie);
        const v = bounded(b.version, 1, 10000, '版本');
        const result = await db
          .prepare(
            'UPDATE conclusions SET choice=?,evidence=?,reason=?,rewrite=?,uncertainty=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND owner=?' +
              ' AND ' +
              validEvidence,
          )
          .bind(
            choice,
            evidence,
            reason,
            rewrite,
            uncertainty,
            now,
            id,
            v,
            owner,
            evidence,
            classId,
            groupId,
          )
          .run();
        if (!result.meta.changes)
          throw new HttpError(
            409,
            '共同結論或引用卡片已變更，請重新整理後再確認。',
          );
        return reply({ ok: true, id, version: v + 1 }, 200, cookie);
      }
      if (b.version && b.version !== 0)
        throw new HttpError(409, '共同結論狀態已變更，請重新整理。');
      const inserted = await db
        .prepare(
          'INSERT INTO conclusions (id,class_id,group_id,choice,evidence,reason,rewrite,uncertainty,owner,version,updated_at) SELECT ?,?,?,?,?,?,?,?,?,1,? WHERE ' +
            validEvidence,
        )
        .bind(
          id,
          classId,
          groupId,
          choice,
          evidence,
          reason,
          rewrite,
          uncertainty,
          owner,
          now,
          evidence,
          classId,
          groupId,
        )
        .run();
      if (!inserted.meta.changes)
        throw new HttpError(409, '引用的比較卡已變更，請重新整理後再確認。');
      return reply({ ok: true, id, version: 1 }, 201, cookie);
    }
    throw new HttpError(400, '不支援這項操作。');
  } catch (e) {
    return failure(e);
  }
}

export async function DELETE(request: Request) {
  try {
    const b = await readBody(request);
    if (b.action !== 'pair' || b.confirmed !== true)
      throw new HttpError(400, '請先確認要刪除這張比較卡。');
    const classId = bounded(b.classId, 1, 4, '班級'),
      groupId = bounded(b.groupId, 1, 6, '組別'),
      id = identifier(b.id),
      version = bounded(b.version, 1, 10000, '版本');
    const currentSession = session(request);
    if (!currentSession)
      throw new HttpError(403, '請使用原提交時的瀏覽器刪除這張卡。');
    const owner = await hash(currentSession);
    const db = getDb();
    const previous = await db
      .prepare('SELECT * FROM pairs WHERE id=?')
      .bind(id)
      .first<Row>();
    if (!previous)
      throw new HttpError(404, '這張卡已刪除或不存在，請重新整理。');
    if (
      previous.owner !== owner ||
      previous.class_id !== classId ||
      previous.group_id !== groupId
    )
      throw new HttpError(403, '只能由原提交者在同一瀏覽器刪除這張卡。');
    if (previous.version !== version)
      throw new HttpError(409, '這張卡已有更新，請重新整理確認內容後再刪除。');
    const result = await db
      .prepare(
        'DELETE FROM pairs WHERE id=? AND class_id=? AND group_id=? AND owner=? AND version=? AND NOT EXISTS (SELECT 1 FROM conclusions c, json_each(c.evidence) e WHERE c.class_id=pairs.class_id AND c.group_id=pairs.group_id AND e.value=pairs.id)',
      )
      .bind(id, classId, groupId, owner, version)
      .run();
    if (!result.meta.changes)
      throw new HttpError(
        409,
        '這張卡已被共同結論引用，或內容剛有變更。請重新整理；若仍被引用，請由結論提交者先調整引用，再刪除。',
      );
    return reply({ ok: true, id });
  } catch (e) {
    return failure(e);
  }
}
