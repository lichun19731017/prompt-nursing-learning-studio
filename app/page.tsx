'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Users,
  LayoutDashboard,
  CheckCircle2,
  Copy,
  RefreshCw,
  Download,
  Plus,
  Send,
  Clock3,
  Pause,
  Play,
  RotateCcw,
  MessageSquare,
  Check,
  ExternalLink,
  FileText,
  PenLine,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { classroomCsv } from '@/lib/classroom-export';
import {
  stages,
  classLabel,
  parseClassId,
  memberNames,
  v1,
  referencePrompt,
  type Classroom,
  type PairCard,
  type Conclusion,
} from '@/lib/studio-types';

type Notice = { text: string; error?: boolean };
const emptyPair = {
  members: 2,
  nameOne: '',
  nameTwo: '',
  nameThree: '',
  change: '',
  difference: '',
  verification: '',
};
const emptyConclusion = {
  choice: '',
  evidence: [] as string[],
  reason: '',
  rewrite: '',
  uncertainty: '',
};
async function post(body: unknown, method: 'POST' | 'DELETE' = 'POST') {
  const r = await fetch('/api/studio', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await r.json()) as { error?: string };
  if (!r.ok) throw new Error(json.error || '送出失敗，請稍後再試。');
  return json;
}
function remember(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function restore<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(sessionStorage.getItem(key) || 'null');
    return v && typeof v === 'object' ? { ...fallback, ...v } : fallback;
  } catch {
    return fallback;
  }
}
function time(t: string) {
  return new Date(t).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Taipei',
  });
}
function CopyButton({
  text,
  label = '複製文字',
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false),
    [failed, setFailed] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setFailed(false);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setFailed(true);
          }
        }}
      >
        {copied ? <Check /> : <Copy />}
        {copied ? '已複製' : label}
      </Button>
      {failed && <small role="status">無法自動複製，請選取文字後複製。</small>}
    </>
  );
}
function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  max = 1500,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max?: number;
}) {
  return (
    <label className="form-field">
      <strong>{label}</strong>
      {hint && <span className="field-hint">{hint}</span>}
      <Textarea
        required
        maxLength={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
      />
      <small>
        {value.length} / {max}
      </small>
    </label>
  );
}
function Timer() {
  const [left, setLeft] = useState(18 * 60),
    [running, setRunning] = useState(false);
  const deadline = useRef(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const n = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(n);
      if (!n) setRunning(false);
    }, 250);
    return () => clearInterval(id);
  }, [running]);
  const elapsed = 18 * 60 - left,
    stage = elapsed < 540 ? 0 : elapsed < 720 ? 1 : elapsed < 960 ? 2 : 3;
  return (
    <div className="timer">
      <div>
        <Clock3 size={16} />
        <span>
          {Math.floor(left / 60)
            .toString()
            .padStart(2, '0')}
          :{(left % 60).toString().padStart(2, '0')}
        </span>
        <small>{left === 0 ? '活動時間到' : stages[stage].title}</small>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={running ? '暫停計時' : '開始計時'}
        onClick={() => {
          deadline.current = Date.now() + left * 1000;
          setRunning(!running);
        }}
        disabled={left === 0}
      >
        {running ? <Pause /> : <Play />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="重設18分鐘"
        onClick={() => {
          setRunning(false);
          setLeft(1080);
        }}
      >
        <RotateCcw />
      </Button>
    </div>
  );
}
function Practice({ draftKey }: { draftKey: string }) {
  const blank = {
    goal: '',
    context: '',
    output: '',
    boundary: '',
    gap: '',
    check: '',
  };
  const [draft, setDraft] = useState(blank);
  useEffect(() => setDraft(restore(draftKey, blank)), [draftKey]);
  const update = (k: keyof typeof blank, v: string) =>
    setDraft((p) => {
      const n = { ...p, [k]: v };
      remember(draftKey, n);
      return n;
    });
  const prompt = [
    '目標：' + draft.goal,
    '脈絡：' + draft.context,
    '輸出：' + draft.output,
    '邊界：' + draft.boundary,
  ].join('\n');
  return (
    <div className="practice-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">01 · 個人練習 · 9分鐘</p>
            <h2>先試一次，再找缺口</h2>
          </div>
          <BookOpen className="teal-icon" />
        </div>
        <p className="muted">
          將 V1 貼到你使用的 AI 工具，先直接執行。閱讀回答後，找出兩個具體缺口。
        </p>
        <div className="prompt-box">
          <strong>V1 Prompt</strong>
          <p>{v1}</p>
          <CopyButton text={v1} label="複製 V1" />
        </div>
        <Field
          label="我看到的兩個缺口"
          value={draft.gap}
          onChange={(v) => update('gap', v)}
          placeholder="例如：沒有指定回答對象；有些敘述沒有資料依據。"
        />
        <div className="inline-note">
          請使用老師提供的講義。這裡的例子示範檢查方式，不是南丁格爾的史實答案。
        </div>
        <div className="mini-checks">
          <span>對象與任務</span>
          <span>格式與長度</span>
          <span>來源與查證</span>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">V2 PROMPT</p>
            <h2>把缺少的條件補回來</h2>
          </div>
          <PenLine className="teal-icon" />
        </div>
        <div className="compact-fields">
          {[
            ['goal', '目標', '想讓 AI 完成什麼？'],
            ['context', '脈絡', '回答寫給誰？有哪些課堂資料？'],
            ['output', '輸出', '需要幾欄、幾列？每格多少字？'],
            ['boundary', '邊界', '來源限制是什麼？不確定處如何處理？'],
          ].map(([key, label, placeholder]) => (
            <Field
              key={key}
              label={label}
              value={draft[key as keyof typeof draft]}
              onChange={(v) => update(key as keyof typeof draft, v)}
              placeholder={placeholder}
              max={600}
            />
          ))}
        </div>
        <CopyButton text={prompt} label="複製我的 V2 Prompt" />
        <p className="field-hint" style={{ marginTop: 12 }}>
          執行 V2 後，至少追問一次，並回到講義查證。完整 AI
          回答請保留在自己的對話中。
        </p>
        <Field
          label="我的查證紀錄"
          value={draft.check}
          onChange={(v) => update('check', v)}
          placeholder="查了哪一句、對照哪一點？確認結果與仍不確定之處。"
        />
        <p className="draft-note">
          此區是本裝置的暫存筆記，不會上傳給同組。接下來請2–3
          人分享，再共同填寫比較卡。
        </p>
      </section>
    </div>
  );
}
function PairForm({
  classId,
  groupId,
  editing,
  onDone,
  onCancel,
  notify,
}: {
  classId: number;
  groupId: number;
  editing?: PairCard;
  onDone: () => void;
  onCancel: () => void;
  notify: (n: Notice) => void;
}) {
  const key =
    'pair-draft-' + classId + '-' + groupId + '-' + (editing?.id || 'new');
  const [draft, setDraft] = useState({ ...emptyPair, ...editing }),
    [busy, setBusy] = useState(false);
  const id = useRef(editing?.id || '');
  useEffect(() => {
    const saved = restore(key, { ...emptyPair, ...editing });
    setDraft({ ...saved, members: saved.members === 3 ? 3 : 2 });
    id.current = editing?.id || crypto.randomUUID();
  }, [key, editing]);
  const set = (k: string, v: unknown) =>
    setDraft((p) => {
      const next = { ...p, [k]: v };
      remember(key, next);
      return next;
    });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await post({
        ...draft,
        action: 'pair',
        classId,
        groupId,
        id: id.current,
        version: editing?.version || 0,
        members: draft.members === 3 ? 3 : 2,
        nameThree: draft.members === 3 ? draft.nameThree : '',
      });
      try {
        sessionStorage.removeItem(key);
      } catch {}
      notify({
        text:
          '比較卡已送到 ' +
          classLabel(classId) +
          '班・第' +
          groupId +
          '組。同組同學可以讀取了。',
      });
      onDone();
    } catch (e) {
      notify({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel form-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">02 · 同儕比較 · 3分鐘</p>
          <h2>{editing ? '修訂比較卡' : '一起留下最有用的發現'}</h2>
        </div>
        <span className="location-badge">
          {classLabel(classId)} 班・第{groupId}組
        </span>
      </div>
      <p className="muted">
        每人各自說明自己的版本，再由一人代表提交。每隊 2–3
        人，共同完成一張比較卡，填寫全體成員姓名。
      </p>
      <form onSubmit={submit}>
        <fieldset className="team-size-field">
          <legend>這一隊有幾位同學？</legend>
          <div className="team-size-options">
            {[2, 3].map((n) => (
              <label key={n}>
                <input
                  type="radio"
                  name="team-members"
                  value={n}
                  checked={draft.members === n}
                  onChange={() => set('members', n)}
                />
                {n} 人
              </label>
            ))}
          </div>
          <p className="field-hint">
            每隊 2–3
            人，由一位代表提交。請填寫全體成員姓名；隊伍編號由系統自動安排。
          </p>
        </fieldset>
        <div className="form-row">
          <label className="form-field">
            <strong>第一位同學姓名（必填）</strong>
            <Input
              required
              maxLength={80}
              autoComplete="off"
              value={draft.nameOne}
              onChange={(e) => set('nameOne', e.target.value)}
              placeholder="請輸入姓名"
            />
          </label>
          <label className="form-field">
            <strong>第二位同學姓名（必填）</strong>
            <Input
              required
              maxLength={80}
              autoComplete="off"
              value={draft.nameTwo}
              onChange={(e) => set('nameTwo', e.target.value)}
              placeholder="請輸入姓名"
            />
          </label>
        </div>
        {draft.members === 3 && (
          <label className="form-field">
            <strong>第三位同學姓名（必填）</strong>
            <Input
              required
              maxLength={80}
              autoComplete="off"
              value={draft.nameThree}
              onChange={(e) => set('nameThree', e.target.value)}
              placeholder="請輸入姓名"
            />
          </label>
        )}
        <p className="field-hint">
          姓名會隨比較卡顯示，供網站使用者與教師閱讀，並包含在教師匯出資料中。請勿填寫學號或病人資料。
        </p>
        <Field
          label="① 我們改了什麼？"
          hint="貼上最關鍵的一句 Prompt 修改。"
          value={draft.change}
          onChange={(v) => set('change', v)}
          placeholder="例如：我們加入「只能根據講義回答」。"
        />
        <Field
          label="② 回答有什麼差異？"
          hint="舉一個具體例子；沒有明顯改善，也請照實寫。"
          value={draft.difference}
          onChange={(v) => set('difference', v)}
          placeholder="修改前……；修改後……。這是否更符合任務？"
        />
        <Field
          label="③ 我們查證了什麼？"
          hint="寫出講義的對應內容，以及仍未確認之處。"
          value={draft.verification}
          onChange={(v) => set('verification', v)}
          placeholder="我們對照講義第……點，確認……；仍需查證……。"
        />
        <div className="form-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={busy}
          >
            返回比較卡
          </Button>
          <Button type="submit" disabled={busy}>
            <Send />
            {busy ? '正在送出…' : editing ? '儲存修訂' : '送出同儕比較卡'}
          </Button>
        </div>
        <p className="draft-note">
          送出後由原提交者在同一裝置修訂，避免他人覆蓋你們的紀錄。
        </p>
      </form>
    </section>
  );
}

function DeletePairButton({
  card,
  referenced,
  onDeleted,
}: {
  card: PairCard;
  referenced: boolean;
  onDeleted: (card: PairCard) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await post(
        {
          action: 'pair',
          id: card.id,
          classId: card.classId,
          groupId: card.groupId,
          version: card.version,
          confirmed: true,
        },
        'DELETE',
      );
      try {
        sessionStorage.removeItem(
          'pair-draft-' + card.classId + '-' + card.groupId + '-' + card.id,
        );
      } catch {}
      setOpen(false);
      onDeleted(card);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const hint = !card.canEdit
    ? '請使用原提交時的瀏覽器刪除。'
    : referenced
      ? '共同結論正在引用此卡，請由結論提交者先調整引用。'
      : '';
  return (
    <div className="delete-pair-control">
      <Button
        type="button"
        variant="destructive"
        disabled={!card.canEdit || referenced}
        aria-label={'刪除第' + card.pairNo + '隊比較卡'}
        aria-describedby={hint ? 'delete-hint-' + card.id : undefined}
        onClick={() => {
          setError('');
          setOpen(true);
        }}
      >
        <Trash2 />
        刪除
      </Button>
      {hint && (
        <small className="delete-hint" id={'delete-hint-' + card.id}>
          {hint}
        </small>
      )}
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除這張同儕比較卡？</AlertDialogTitle>
            <AlertDialogDescription>
              {classLabel(card.classId)} 班・第{card.groupId}組・第{card.pairNo}
              隊
              <br />
              {memberNames(card)}
              <br />
              確認後會從全組成果與教師總覽移除，無法復原。其他比較卡會保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="delete-error">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={remove}
            >
              {busy ? '正在刪除…' : '確認刪除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
function PairList({
  cards,
  readOnly,
  onEdit,
  onDeleted,
  evidence = [],
}: {
  cards: PairCard[];
  readOnly?: boolean;
  onEdit: (card: PairCard) => void;
  onDeleted: (card: PairCard) => void;
  evidence?: string[];
}) {
  if (!cards.length)
    return (
      <div className="empty-state">
        <MessageSquare />
        <h3>等待第一張比較卡</h3>
        <p>先2–3 人分享，再把你們的修改、差異與查證結果送到這裡。</p>
      </div>
    );
  return (
    <div className="comparison-grid">
      {cards.map((c) => (
        <article className="comparison-card" key={c.id} id={'card-' + c.id}>
          <header>
            <span className="pair-badge">第{c.pairNo}隊</span>
            <span>
              {c.members}人同行 · {time(c.updatedAt)}
            </span>
          </header>
          <p className="pair-names">{memberNames(c)}</p>
          <div>
            <small>我們改了什麼</small>
            <p>{c.change}</p>
          </div>
          <div>
            <small>回答有什麼差異</small>
            <p>{c.difference}</p>
          </div>
          <div className="verification">
            <small>查證與未確認</small>
            <p>{c.verification}</p>
          </div>
          <div className="card-actions">
            {c.canEdit && !readOnly && (
              <Button type="button" variant="ghost" onClick={() => onEdit(c)}>
                <PenLine />
                修訂這張卡
              </Button>
            )}
            <DeletePairButton
              card={c}
              referenced={evidence.includes(c.id)}
              onDeleted={onDeleted}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
function ConclusionView({
  value,
  cards,
  onEdit,
  readOnly,
}: {
  value: Conclusion;
  cards: PairCard[];
  onEdit: () => void;
  readOnly?: boolean;
}) {
  return (
    <section className="conclusion-display">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">OUR SHARED CONCLUSION</p>
          <h2>我們共同決定</h2>
        </div>
        <span className="done-badge">
          <CheckCircle2 size={16} />
          已提交
        </span>
      </div>
      <div className="conclusion-lead">
        <small>最值得保留的修改</small>
        <h3>{value.choice}</h3>
      </div>
      <p className="evidence-links">
        依據：
        {value.evidence.map((id) => {
          const c = cards.find((p) => p.id === id);
          return c ? (
            <a key={id} href={'#card-' + id}>
              第{c.pairNo}隊比較卡
            </a>
          ) : (
            <span key={id}>卡片未載入</span>
          );
        })}
      </p>
      <dl>
        <dt>我們選擇的理由</dt>
        <dd>{value.reason}</dd>
        <dt>討論後的共同改寫</dt>
        <dd className="rewrite">{value.rewrite}</dd>
        <dt>待查證或不同意見</dt>
        <dd>{value.uncertainty}</dd>
      </dl>
      <div className="form-actions">
        <small>
          第{value.version}版 · {time(value.updatedAt)}
        </small>
        {value.canEdit && !readOnly && (
          <Button variant="outline" onClick={onEdit}>
            <PenLine />
            與組員確認後修訂
          </Button>
        )}
      </div>
      {!value.canEdit && !readOnly && (
        <p className="draft-note">
          需要修訂時，請由原提交代表使用同一裝置開啟。
        </p>
      )}
    </section>
  );
}
function ConclusionForm({
  classId,
  groupId,
  cards,
  current,
  onDone,
  onCancel,
  notify,
}: {
  classId: number;
  groupId: number;
  cards: PairCard[];
  current?: Conclusion;
  onDone: () => void;
  onCancel: () => void;
  notify: (n: Notice) => void;
}) {
  const key = 'conclusion-draft-' + classId + '-' + groupId;
  const [draft, setDraft] = useState({ ...emptyConclusion, ...current }),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setDraft(restore(key, { ...emptyConclusion, ...current }));
    setConfirmed(false);
  }, [key, current?.version]);
  const set = (k: string, v: unknown) =>
    setDraft((p) => {
      const next = { ...p, [k]: v };
      remember(key, next);
      return next;
    });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await post({
        action: 'conclusion',
        ...draft,
        classId,
        groupId,
        version: current?.version || 0,
        confirmed,
      });
      try {
        sessionStorage.removeItem(key);
      } catch {}
      notify({ text: '小組共同結論已儲存。同儕原始比較卡也完整保留。' });
      onDone();
    } catch (e) {
      notify({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel form-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">03 · 小組整合 · 4分鐘</p>
          <h2>用比較卡支持你們的選擇</h2>
        </div>
        <span className="location-badge">
          {classLabel(classId)} 班・第{groupId}組
        </span>
      </div>
      <p className="muted">
        先閱讀本組所有比較卡，再由一位代表填寫。可保留不同意見，不必勉強一致。
      </p>
      <form onSubmit={submit}>
        <Field
          label="① 最值得保留的修改是什麼？"
          value={draft.choice}
          onChange={(v) => set('choice', v)}
          placeholder="我們最想保留的修改是……。"
        />
        <fieldset className="form-field">
          <legend>② 哪些比較卡支持這個選擇？</legend>
          <p className="field-hint">至少選一張。下方再說明具體理由。</p>
          <div className="evidence-options">
            {cards.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={draft.evidence.includes(c.id)}
                  onChange={(e) =>
                    set(
                      'evidence',
                      e.target.checked
                        ? [...draft.evidence, c.id]
                        : draft.evidence.filter((id) => id !== c.id),
                    )
                  }
                />
                <span>
                  <strong>第{c.pairNo}隊</strong> {c.change}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field
          label="選擇的理由與回答中的證據"
          value={draft.reason}
          onChange={(v) => set('reason', v)}
          placeholder="第……隊的回答顯示……，因此我們認為……。"
        />
        <Field
          label="③ 綜合討論後，我們會怎麼改寫？"
          value={draft.rewrite}
          onChange={(v) => set('rewrite', v)}
          placeholder="寫出全組共同修訂後的一句 Prompt。"
        />
        <Field
          label="④ 還需要查證什麼？有不同意見嗎？"
          value={draft.uncertainty}
          onChange={(v) => set('uncertainty', v)}
          placeholder="仍需查證……；有人認為……。若目前無不同意見，也請明確說明。"
        />
        <label className="confirmation">
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>我們已閱讀本組所有比較卡，並與組員確認這份共同結論。</span>
        </label>
        <div className="form-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={busy}
          >
            返回小組
          </Button>
          <Button
            type="submit"
            disabled={busy || !confirmed || !draft.evidence.length}
          >
            <Send />
            {busy ? '正在送出…' : '提交小組共同結論'}
          </Button>
        </div>
      </form>
    </section>
  );
}
export default function Home() {
  const [classId, setClassId] = useState(1),
    [groupId, setGroupId] = useState(0),
    [teacher, setTeacher] = useState(false);
  const [tab, setTab] = useState<'practice' | 'cards' | 'conclusion'>('cards'),
    [data, setData] = useState<Classroom | null>(null),
    [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null),
    [pairForm, setPairForm] = useState(false),
    [editing, setEditing] = useState<PairCard | undefined>(),
    [conclusionForm, setConclusionForm] = useState(false),
    [ready, setReady] = useState(false);
  const [reference, setReference] = useState(false);
  const requestNumber = useRef(0);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const c = parseClassId(q.get('class')),
      g = Number(q.get('group'));
    if (c >= 1 && c <= 4 && Number.isInteger(c)) setClassId(c);
    if (g >= 1 && g <= 6 && Number.isInteger(g)) setGroupId(g);
    setTeacher(q.get('view') === 'teacher');
    setReady(true);
  }, []);
  const refresh = useCallback(
    async (quiet = false) => {
      const number = ++requestNumber.current;
      if (!quiet) setLoading(true);
      try {
        const r = await fetch('/api/studio?classId=' + classId, {
          cache: 'no-store',
        });
        const d = (await r.json()) as Classroom & { error?: string };
        if (!r.ok) throw new Error(d.error);
        if (number !== requestNumber.current) return;
        setData(d);
      } catch (e) {
        if (number === requestNumber.current)
          setNotice({
            text: (e as Error).message || '無法更新班級資料。',
            error: true,
          });
      } finally {
        if (number === requestNumber.current) setLoading(false);
      }
    },
    [classId],
  );
  useEffect(() => {
    if (!ready) return;
    setData(null);
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(true);
    }, 8000);
    return () => {
      clearInterval(timer);
      requestNumber.current++;
    };
  }, [ready, refresh]);
  useEffect(() => {
    if (!ready) return;
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('class', classLabel(classId));
    if (groupId) url.searchParams.set('group', String(groupId));
    if (teacher) url.searchParams.set('view', 'teacher');
    history.replaceState(null, '', url);
  }, [classId, groupId, teacher, ready]);
  const changeClass = (n: number) => {
    setClassId(n);
    setGroupId(0);
    setNotice(null);
    setPairForm(false);
    setConclusionForm(false);
    setEditing(undefined);
  };
  const openGroup = (n: number) => {
    setGroupId(n);
    setPairForm(false);
    setConclusionForm(false);
    setEditing(undefined);
    setTab('cards');
    setNotice(null);
  };
  const cards = (data?.pairs || []).filter((c) => c.groupId === groupId);
  const final = data?.conclusions.find((c) => c.groupId === groupId);
  const done = () => {
    setPairForm(false);
    setEditing(undefined);
    setConclusionForm(false);
    void refresh();
  };
  const deletedPair = (card: PairCard) => {
    requestNumber.current++;
    setData((current) =>
      current
        ? {
            ...current,
            pairs: current.pairs.filter((p) => p.id !== card.id),
          }
        : current,
    );
    setNotice({
      text: '已刪除第' + card.pairNo + '隊比較卡，其他資料已保留。',
    });
    void refresh(true);
  };
  const showPair = (c?: PairCard) => {
    setEditing(c);
    setPairForm(true);
    setTab('cards');
    setConclusionForm(false);
  };
  const showConclusion = () => {
    setConclusionForm(true);
    setPairForm(false);
    setTab('conclusion');
  };
  async function share() {
    try {
      const url = new URL(location.href);
      url.search = '?class=' + classLabel(classId);
      await navigator.clipboard.writeText(url.toString());
      setNotice({
        text: classLabel(classId) + ' 班的入口連結已複製。學生進入後再選組別。',
      });
    } catch {
      setNotice({ text: '請直接複製網址列的班級連結。' });
    }
  }
  function download(format: 'json' | 'csv') {
    if (!data) return;
    let body = JSON.stringify(data, null, 2),
      mime = 'application/json';
    if (format === 'csv') {
      body = classroomCsv(data);
      mime = 'text/csv;charset=utf-8';
    }
    const url = URL.createObjectURL(new Blob([body], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Prompt共學_' + classLabel(classId) + '班.' + format;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: unknown) => {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: 'read_classroom_learning',
      title: '讀取班級共學成果',
      description: '讀取目前班級的同儕比較卡與小組結論；只讀，不會提交或修改。',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async () => {
        const r = await fetch('/api/studio?classId=' + classId);
        if (!r.ok) throw new Error('無法讀取班級資料');
        return r.json();
      },
    });
    register({
      name: 'open_learning_group',
      title: '開啟本班小組',
      description: '切換目前班級的小組畫面；不會提交學習成果。',
      inputSchema: {
        type: 'object',
        properties: { groupId: { type: 'integer', minimum: 1, maximum: 6 } },
        required: ['groupId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input: any) => {
        if (
          !Number.isInteger(input?.groupId) ||
          input.groupId < 1 ||
          input.groupId > 6
        )
          throw new Error('組別必須是1至6');
        openGroup(input.groupId);
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        return { classId, groupId: input.groupId, status: 'opened' };
      },
    });
    return () => lifecycle.abort();
  }, [classId]);
  return (
    <div className="studio-shell">
      <header className="topbar">
        <a className="wordmark" href="/">
          <span className="brand-mark">
            <BookOpen size={23} />
          </span>
          <span>
            Prompt <b>小組共學室</b>
            <small>護理系新生 · 任務設計與迭代</small>
          </span>
        </a>
        <Button
          variant={teacher ? 'default' : 'outline'}
          onClick={() => {
            setTeacher(!teacher);
            setGroupId(0);
            setPairForm(false);
            setConclusionForm(false);
            setReference(false);
          }}
        >
          <LayoutDashboard />
          {teacher ? '返回學生入口' : '教師總覽'}
        </Button>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <p className="eyebrow">YOUR CLASSROOM</p>
          <h2>{teacher ? '班級成果總覽' : '先找到你的班級'}</h2>
          <div className="class-list">
            {[1, 2, 3, 4].map((n) => (
              <Button
                key={n}
                variant={classId === n ? 'default' : 'ghost'}
                onClick={() => changeClass(n)}
                className="class-button"
                aria-pressed={classId === n}
              >
                <span>0{n}</span>
                {classLabel(n)} 班<ArrowRight size={16} />
              </Button>
            ))}
          </div>
          <div className="side-note">
            <CheckCircle2 size={20} />
            <p>
              留下修改的理由，
              <br />
              也留下尚未確認的事。
            </p>
          </div>
          <p className="privacy-note">
            使用班級與組別識別。
            <br />
            比較卡請填寫全體 2–3 位成員姓名。請勿填寫學號或病人資料。
          </p>
          {teacher && <Timer />}
        </aside>
        <main className="main-surface">
          <div className="section-top">
            <div>
              <p className="eyebrow">
                {classLabel(classId)} 班 ·{' '}
                {teacher
                  ? '教師成果總覽'
                  : groupId
                    ? '第' + groupId + '組'
                    : '六組一起學'}
              </p>
              <h1>
                {teacher
                  ? '看見每一組的學習。'
                  : groupId
                    ? '一起比較，形成自己的判斷。'
                    : '讓每一次修改，都有依據。'}
              </h1>
              <p className="subcopy">
                {teacher
                  ? '閱讀比較卡、查看共同結論，再挑選值得全班討論的發現。'
                  : '先完成自己的練習，再帶著發現加入小組。'}
              </p>
            </div>
            <span className="duration">
              18<span>分鐘共學</span>
            </span>
          </div>
          <div className="journey">
            {stages.map((s, i) => (
              <div key={s.title}>
                <span>0{i + 1}</span>
                <strong>{s.title}</strong>
                <small>{s.minutes} 分鐘</small>
              </div>
            ))}
          </div>
          <div className="workspace-tools">
            <div className="sync-state">
              <span className={data ? 'sync-dot' : 'sync-dot pending'} />
              {loading
                ? '正在讀取共學成果…'
                : data
                  ? '已同步 · ' + time(data.updatedAt)
                  : '尚未取得共用資料'}
            </div>
            <div>
              <Button
                variant="ghost"
                onClick={() => void refresh()}
                disabled={loading}
              >
                <RefreshCw className={loading ? 'spinning' : ''} />
                更新
              </Button>
              <Button variant="outline" onClick={share}>
                <Copy />
                複製班級入口
              </Button>
              {teacher && (
                <Button
                  variant="outline"
                  onClick={() => download('csv')}
                  disabled={!data}
                >
                  <Download />
                  匯出本班
                </Button>
              )}
            </div>
          </div>
          {notice && (
            <div
              className={'notice ' + (notice.error ? 'error' : 'success')}
              role={notice.error ? 'alert' : 'status'}
            >
              {notice.text}
              <Button
                variant="ghost"
                onClick={() => setNotice(null)}
                aria-label="關閉提示"
              >
                ×
              </Button>
            </div>
          )}
          {groupId === 0 ? (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">
                      {teacher
                        ? 'SIX GROUPS, SIX PERSPECTIVES'
                        : 'STEP INTO YOUR GROUP'}
                    </p>
                    <h2>{teacher ? '本班六組進度' : '選擇你的小組'}</h2>
                  </div>
                  <span className="count-badge">
                    {data ? data.conclusions.length : '—'} / 6 組已提交結論
                  </span>
                </div>
                <div className="group-grid">
                  {[1, 2, 3, 4, 5, 6].map((n) => {
                    const p = data?.pairs.filter((c) => c.groupId === n) || [],
                      c = data?.conclusions.find((c) => c.groupId === n);
                    return (
                      <Button
                        key={n}
                        variant="outline"
                        className={'group-choice ' + (c ? 'completed' : '')}
                        onClick={() => openGroup(n)}
                      >
                        <span className="group-number">0{n}</span>
                        <strong>第{n}組</strong>
                        <span className="group-status">
                          {data ? p.length + '張比較卡' : '資料讀取中'} ·{' '}
                          {c ? '結論已完成' : '等待共同結論'}
                        </span>
                        {teacher && c && (
                          <p className="group-preview">{c.choice}</p>
                        )}
                        <span>
                          {teacher ? '檢視這組成果' : '進入小組'}{' '}
                          <ArrowRight size={15} />
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </section>
              <div className="task-strip">
                <BookOpen />
                <div>
                  <strong>本次任務｜南丁格爾與現代護理</strong>
                  <p>
                    根據老師提供的講義，說明她的貢獻如何影響現代護理。講義由教師於課堂提供。
                  </p>
                </div>
              </div>
              {teacher && (
                <section className="panel teacher-guide">
                  <div className="panel-heading">
                    <h2>18分鐘帶領提醒</h2>
                    <Clock3 className="teal-icon" />
                  </div>
                  <ol>
                    {stages.map((s, i) => (
                      <li key={s.title}>
                        <strong>
                          {s.title} · {s.minutes}分鐘
                        </strong>
                        <p>{s.caption}</p>
                        {i === 1 && (
                          <p>
                            每隊 2–3 人，只提交一張卡；必須填寫全體成員姓名。
                          </p>
                        )}
                        {i === 2 && (
                          <p>
                            要求引用至少一張本組卡片。讓代表填寫，全組確認後送出。
                          </p>
                        )}
                        {i === 3 && (
                          <p>
                            挑選兩組不同發現，追問「你們的依據是什麼？」與「還有哪裡沒確認？」。
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                  <Button
                    variant="outline"
                    onClick={() => setReference(!reference)}
                  >
                    {reference ? '收起參考 V2' : '討論後再看參考 V2'}
                  </Button>
                  {reference && (
                    <div className="prompt-box">
                      <p>{referencePrompt}</p>
                      <CopyButton text={referencePrompt} />
                    </div>
                  )}
                  <p className="draft-note">
                    教師總覽可閱讀全班成果，也可刪除本瀏覽器提交且未被共同結論引用的比較卡；此入口不提供其他同學資料的管理權限。正式上課前請備妥講義，並確認學生可開啟班級連結。
                  </p>
                </section>
              )}
            </>
          ) : (
            <>
              <div className="group-toolbar">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setGroupId(0);
                    setPairForm(false);
                    setConclusionForm(false);
                  }}
                >
                  <ArrowLeft />
                  返回六組
                </Button>
                <nav aria-label="小組工作區">
                  {!teacher && (
                    <Button
                      variant={tab === 'practice' ? 'default' : 'ghost'}
                      onClick={() => {
                        setTab('practice');
                        setPairForm(false);
                        setConclusionForm(false);
                      }}
                    >
                      個人練習
                    </Button>
                  )}
                  <Button
                    variant={tab === 'cards' ? 'default' : 'ghost'}
                    onClick={() => {
                      setTab('cards');
                      setPairForm(false);
                      setConclusionForm(false);
                    }}
                  >
                    比較卡 {cards.length}
                  </Button>
                  <Button
                    variant={tab === 'conclusion' ? 'default' : 'ghost'}
                    onClick={() => {
                      setTab('conclusion');
                      setPairForm(false);
                      setConclusionForm(false);
                    }}
                  >
                    共同結論 {final ? '✓' : ''}
                  </Button>
                </nav>
              </div>
              {tab === 'practice' && !teacher ? (
                <Practice
                  key={classId + '-' + groupId}
                  draftKey={'practice-' + classId + '-' + groupId}
                />
              ) : pairForm && !teacher ? (
                <PairForm
                  key={editing?.id || 'new'}
                  classId={classId}
                  groupId={groupId}
                  editing={editing}
                  notify={setNotice}
                  onDone={done}
                  onCancel={() => setPairForm(false)}
                />
              ) : conclusionForm && !teacher ? (
                <ConclusionForm
                  key={classId + '-' + groupId + '-' + (final?.version || 0)}
                  classId={classId}
                  groupId={groupId}
                  cards={cards}
                  current={final}
                  notify={setNotice}
                  onDone={done}
                  onCancel={() => setConclusionForm(false)}
                />
              ) : tab === 'cards' ? (
                <>
                  <div className="content-heading">
                    <div>
                      <h2>第{groupId}組的同儕比較卡</h2>
                      <p className="muted">
                        閱讀每隊同學的修改、回答差異與查證發現。
                      </p>
                    </div>
                    {!teacher && (
                      <Button onClick={() => showPair()} disabled={!data}>
                        <Plus />
                        新增比較卡
                      </Button>
                    )}
                  </div>
                  {!data ? (
                    <div className="empty-state">
                      <RefreshCw />
                      <p>取得共用資料後，即可新增與閱讀比較卡。</p>
                    </div>
                  ) : (
                    <PairList
                      cards={cards}
                      readOnly={teacher}
                      onEdit={showPair}
                      onDeleted={deletedPair}
                      evidence={final?.evidence}
                    />
                  )}
                  <div className="next-step">
                    <Users />
                    <div>
                      <strong>所有同組比較卡都在這裡。</strong>
                      <p>請先閱讀，再一起決定最值得保留的修改。</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setTab('conclusion')}
                    >
                      前往共同結論
                      <ArrowRight />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {final ? (
                    <ConclusionView
                      value={final}
                      cards={cards}
                      onEdit={showConclusion}
                      readOnly={teacher}
                    />
                  ) : (
                    <div className="empty-state">
                      <Users />
                      <h3>把各自的發現，整合成共同結論</h3>
                      <p>
                        選擇值得保留的修改、引用本組比較卡、說明理由，再寫出共同修訂的一句
                        Prompt。
                      </p>
                      {!teacher && (
                        <Button
                          disabled={!cards.length || !data}
                          onClick={showConclusion}
                        >
                          <PenLine />
                          開始共同結論
                        </Button>
                      )}
                      {!cards.length && (
                        <small>
                          至少有一張比較卡後才能開始。請等待全組提交，再共同討論。
                        </small>
                      )}
                    </div>
                  )}
                  <div className="content-heading">
                    <h2>支持結論的原始比較卡</h2>
                    <span className="count-badge">{cards.length}張</span>
                  </div>
                  <PairList
                    cards={cards}
                    readOnly={teacher}
                    onEdit={showPair}
                    onDeleted={deletedPair}
                    evidence={final?.evidence}
                  />
                </>
              )}
            </>
          )}
        </main>
      </div>
      <footer>
        先理解，再比較，最後共同決定。
        <span>Prompt Learning Studio · 2–3 人具名參與，不蒐集學號</span>
      </footer>
    </div>
  );
}
