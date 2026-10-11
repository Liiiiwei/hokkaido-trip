'use client'

import { ArrowRight, ClipboardPaste, KeyRound, LoaderCircle, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { adoptKeyFromUrl, keyFromText, loadKey, loadName, parseKey, saveKey } from '@/lib/identity'
import { clockOf, defaultDate, listDates, localToday } from '@/lib/schedule'
import { fetchDoor, unseal } from '@/lib/door'
import { StoreError } from '@/lib/errors'
import { registerShell } from '@/lib/shell'
import { fetchAll, setKey } from '@/lib/store'
import { useNow } from '@/lib/useNow'
import type { Item } from '@/lib/types'
import { useTrip } from '@/lib/useTrip'
import { useVersionWatch } from '@/lib/useVersionWatch'
import { DayForm } from './DayForm'
import { DayPanel } from './DayPanel'
import { DayStrip } from './DayStrip'
import { Header } from './Header'
import { ItemForm } from './ItemForm'
import { NameGate } from './NameGate'
import { RenameForm } from './RenameForm'
import { TripForm } from './TripForm'
import { TripMap } from './TripMap'
import { SheetHost, ghostClass, inputClass, primaryClass } from './ui'

export type SheetState =
  | null
  | { type: 'item'; item: Item | null }
  | { type: 'trip' }
  | { type: 'day' }
  | { type: 'rename' }
  | { type: 'map' }

function LoadingSkeleton() {
  return (
    <main
      className="mx-auto max-w-md animate-pulse space-y-3 p-4"
      aria-busy="true"
      aria-label="載入中"
    >
      <div className="h-12 rounded-xl bg-zinc-200" />
      <div className="h-20 rounded-xl bg-zinc-200" />
      <div className="h-24 rounded-xl bg-zinc-200" />
      <div className="h-24 rounded-xl bg-zinc-200" />
    </main>
  )
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p role="alert" className="text-base font-semibold">
        行程載入失敗
      </p>
      <p className="mt-1 text-sm text-zinc-600">請確認網路後再試一次。</p>
      <button type="button" onClick={onRetry} className={`${ghostClass} mt-4`}>
        <RefreshCw size={16} />
        重試
      </button>
    </main>
  )
}

// 沒有鑰匙、或鑰匙失效時的說明畫面
function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p role="alert" className="text-base font-semibold">
        {title}
      </p>
      <p className="mt-1 text-sm text-zinc-600">{body}</p>
    </main>
  )
}

// 確認這把鑰匙真的讀得到行程。資料檔壞了代表鑰匙是對的，照樣進去，裡面會有說明
async function tryKey(key: string): Promise<'ok' | 'invalid' | 'offline'> {
  setKey(key)
  try {
    await fetchAll()
  } catch (e) {
    const code = e instanceof StoreError ? e.code : 'network'
    if (code !== 'bad_data') return code === 'bad_key' ? 'invalid' : 'offline'
  }
  return 'ok'
}

// 存不進裝置（無痕模式）就放到網址上，重新整理後照樣進得來
function keepKey(key: string) {
  if (!saveKey(key)) window.location.hash = `#k=${key}`
  window.location.reload()
}

const PASS_PROBLEM = {
  wrong: '密語不對，再試一次。',
  unset: '這個網站沒有設定密語，請改貼連結。',
  unsupported: '這個瀏覽器解不開密語，請改貼連結。',
  invalid: '密語對了，但通行資料已經失效。請跟主揪說一聲。',
  offline: '連不上網路，請再試一次。',
}
const LINK_PROBLEM = {
  missing: '這段文字裡找不到通行資訊，請複製完整的連結再貼一次。',
  invalid: '這個連結進不去，可能沒複製完整或已經失效。請跟主揪要新的連結。',
  offline: '連不上網路，請再試一次。',
}

// 沒有鑰匙、或鑰匙失效時：輸入密語，或貼上完整連結。
// 兩種都要真的讀得到行程才存下來：打錯或貼到被截斷的連結時不會把壞的鑰匙存進去
function KeyGate({ title, body }: { title: string; body: string }) {
  const [pass, setPass] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<null | 'pass' | 'link'>(null)
  const [passProblem, setPassProblem] = useState<keyof typeof PASS_PROBLEM | null>(null)
  const [linkProblem, setLinkProblem] = useState<keyof typeof LINK_PROBLEM | null>(null)

  async function submitPass(event: React.FormEvent) {
    event.preventDefault()
    setLinkProblem(null)
    // 沒有加密功能的環境（例如用區網位址開的測試頁）
    if (!globalThis.crypto?.subtle) {
      setPassProblem('unsupported')
      return
    }
    setBusy('pass')
    const door = await fetchDoor()
    if (door === 'none' || door === 'offline') {
      setPassProblem(door === 'none' ? 'unset' : 'offline')
      setBusy(null)
      return
    }
    const key = await unseal(door, pass)
    if (!key) {
      setPassProblem('wrong')
      setBusy(null)
      return
    }
    const result = await tryKey(key)
    if (result !== 'ok') {
      setPassProblem(result)
      setBusy(null)
      return
    }
    keepKey(key)
  }

  async function submitLink(event: React.FormEvent) {
    event.preventDefault()
    setPassProblem(null)
    const key = keyFromText(text)
    if (!key) {
      setLinkProblem('missing')
      return
    }
    setBusy('link')
    const result = await tryKey(key)
    if (result !== 'ok') {
      setLinkProblem(result)
      setBusy(null)
      return
    }
    keepKey(key)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p role="alert" className="text-base font-semibold">
        {title}
      </p>
      <p className="mt-1 text-sm text-zinc-600">{body}</p>
      <form className="mt-6 w-full space-y-3 text-left" onSubmit={submitPass}>
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-sm text-zinc-600">
            <KeyRound size={14} />
            密語
          </span>
          <input
            className={inputClass}
            value={pass}
            onChange={(e) => {
              setPass(e.target.value)
              setPassProblem(null)
            }}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={passProblem !== null}
            aria-describedby={passProblem ? 'pass-hint' : undefined}
          />
        </label>
        <button type="submit" className={primaryClass} disabled={!pass.trim() || busy !== null}>
          {busy === 'pass' ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : (
            <ArrowRight size={18} />
          )}
          {busy === 'pass' ? '確認中…' : '進入'}
        </button>
        {passProblem && (
          <p id="pass-hint" role="alert" className="text-sm text-red-700">
            {PASS_PROBLEM[passProblem]}
          </p>
        )}
      </form>
      <form
        className="mt-8 w-full space-y-3 border-t border-ink/10 pt-6 text-left"
        onSubmit={submitLink}
      >
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-sm text-zinc-600">
            <ClipboardPaste size={14} />
            或把連結貼在這裡
          </span>
          <input
            className={inputClass}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setLinkProblem(null)
            }}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={linkProblem !== null}
            aria-describedby={linkProblem ? 'key-hint' : undefined}
          />
        </label>
        <button type="submit" className={ghostClass} disabled={!text.trim() || busy !== null}>
          {busy === 'link' ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : (
            <ArrowRight size={18} />
          )}
          {busy === 'link' ? '確認中…' : '用這個連結進入'}
        </button>
        {linkProblem && (
          <p id="key-hint" role="alert" className="text-sm text-red-700">
            {LINK_PROBLEM[linkProblem]}
          </p>
        )}
      </form>
    </main>
  )
}

type Boot = { ready: false } | { ready: true; hasKey: boolean; me: string | null }

export function TripApp() {
  const [boot, setBoot] = useState<Boot>({ ready: false })

  // 只能在瀏覽器讀網址與裝置資料，所以放在 effect 裡
  useEffect(() => {
    const key = adoptKeyFromUrl() ?? loadKey()
    if (key) setKey(key)
    // 只能在瀏覽器讀網址與裝置資料，伺服器預先產生的畫面沒有這些
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBoot({ ready: true, hasKey: !!key, me: loadName() })
    registerShell()

    // 頁面開著時又點了一次分享連結（例如主揪換了新鑰匙）：只有 # 後面變了，
    // 瀏覽器不會重新載入，所以自己收下新鑰匙再重新整理
    const onHashChange = () => {
      if (!parseKey(window.location.hash)) return
      adoptKeyFromUrl()
      window.location.reload()
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (!boot.ready) return <LoadingSkeleton />
  if (!boot.hasKey) {
    return <KeyGate title="輸入密語" body="跟主揪問密語。輸入一次，這台裝置之後就不用再輸入。" />
  }
  if (boot.me === null) return <NameGate onDone={(name) => setBoot({ ...boot, me: name })} />
  return <TripView me={boot.me} onRename={(name) => setBoot({ ...boot, me: name })} />
}

function TripView({ me, onRename }: { me: string; onRename: (name: string) => void }) {
  const { state, connected, apply, retry, reload, reorder } = useTrip()
  const now = useNow()
  const [selected, setSelected] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetState>(null)
  // 面板收起時先播完離開的動作再拿掉
  const [closing, setClosing] = useState(false)
  // 換日的方向：往後一天是 1，往前是 -1，時間軸照這個方向進來
  const [dir, setDir] = useState(0)
  useVersionWatch(sheet !== null)
  const openSheet = (next: SheetState) => {
    setClosing(false)
    setSheet(next)
  }
  const closeSheet = () => setClosing(true)

  if (state.status === 'loading') return <LoadingSkeleton />
  if (state.status === 'error') return <ErrorScreen onRetry={retry} />
  if (state.status === 'bad_key') {
    return <KeyGate title="通行資料失效" body="請再輸入一次密語，或跟主揪要新的連結。" />
  }
  if (state.status === 'bad_data') {
    return <Notice title="行程資料檔格式壞了" body="請跟主揪說，他可以從 GitHub 的修改紀錄還原。" />
  }

  const { data } = state
  const dates = listDates(data.trip.start_date, data.trip.end_date)
  const current =
    selected && dates.includes(selected) ? selected : defaultDate(dates, localToday(now))

  const selectDay = (date: string) => {
    setDir(Math.sign(dates.indexOf(date) - dates.indexOf(current)))
    setSelected(date)
    // 換一天從頭看起
    window.scrollTo({ top: 0 })
  }
  const neighbor = (dir: -1 | 1) => dates[dates.indexOf(current) + dir]

  // 拖曳調順序；記下原本的順序，存不成時還原用
  const reorderDay = (ids: string[]) =>
    reorder(
      ids,
      Object.fromEntries(ids.map((id) => [id, data.items.find((i) => i.id === id)?.order])),
    )

  return (
    <main className="mx-auto min-h-dvh max-w-md" style={{ '--day-dir': dir } as CSSProperties}>
      <header className="chrome sticky top-0 z-10 border-b border-ink/10 text-ink">
        {!connected && (
          <div
            role="status"
            className="bg-signal px-4 py-2 text-center text-xs font-semibold text-white"
          >
            連線中斷，重新連線中…
          </div>
        )}
        <Header
          trip={data.trip}
          me={me}
          onEditTrip={() => openSheet({ type: 'trip' })}
          onOpenMap={() => openSheet({ type: 'map' })}
          onRename={() => openSheet({ type: 'rename' })}
        />
        <DayStrip
          dates={dates}
          days={data.days}
          items={data.items}
          current={current}
          onSelect={selectDay}
        />
      </header>

      <DayPanel
        data={data}
        date={current}
        me={me}
        onEditDay={() => openSheet({ type: 'day' })}
        onEditItem={(item) => openSheet({ type: 'item', item })}
        onAdd={() => openSheet({ type: 'item', item: null })}
        apply={apply}
        clock={current === localToday(now) ? clockOf(now) : null}
        canStep={(dir) => neighbor(dir) !== undefined}
        onStep={(dir) => {
          const next = neighbor(dir)
          if (next) selectDay(next)
        }}
        reorder={reorderDay}
      />

      <div
        data-testid="bottom-bar"
        className="chrome fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200/80"
      >
        <div className="mx-auto max-w-md p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            className={primaryClass}
            onClick={() => openSheet({ type: 'item', item: null })}
          >
            <Plus size={20} />
            新增行程
          </button>
        </div>
      </div>

      <SheetHost
        closing={closing}
        onExited={() => {
          setSheet(null)
          setClosing(false)
        }}
      >
        {sheet?.type === 'item' && (
          <ItemForm
            key={sheet.item?.id ?? 'new'}
            item={sheet.item}
            defaultDay={current}
            dates={dates}
            me={me}
            apply={apply}
            onClose={closeSheet}
          />
        )}
        {sheet?.type === 'trip' && (
          <TripForm trip={data.trip} items={data.items} apply={apply} onClose={closeSheet} />
        )}
        {sheet?.type === 'day' && (
          <DayForm
            key={current}
            day={data.days.find((d) => d.date === current) ?? { date: current, city: '', note: '' }}
            apply={apply}
            onClose={closeSheet}
          />
        )}
        {sheet?.type === 'map' && (
          <TripMap
            items={data.items}
            days={data.days}
            onPickDay={(date) => {
              selectDay(date)
              closeSheet()
            }}
            onClose={closeSheet}
          />
        )}
        {sheet?.type === 'rename' && (
          <RenameForm
            me={me}
            onRenamed={async (name) => {
              onRename(name)
              await reload()
            }}
            onClose={closeSheet}
          />
        )}
      </SheetHost>
    </main>
  )
}
