'use client'

import { Plus, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  adoptKeyFromUrl,
  loadKey,
  loadName,
  loadOnlyMine,
  parseKey,
  saveOnlyMine,
} from '@/lib/identity'
import { defaultDate, filterMine, listDates, localToday } from '@/lib/schedule'
import { setKey } from '@/lib/store'
import type { Item } from '@/lib/types'
import { useTrip } from '@/lib/useTrip'
import { DayForm } from './DayForm'
import { DayPanel } from './DayPanel'
import { DayStrip } from './DayStrip'
import { Header } from './Header'
import { ItemForm } from './ItemForm'
import { NameGate } from './NameGate'
import { RenameForm } from './RenameForm'
import { TripForm } from './TripForm'
import { TripMap } from './TripMap'
import { ghostClass, primaryClass } from './ui'

export type SheetState =
  | null
  | { type: 'item'; item: Item | null }
  | { type: 'trip' }
  | { type: 'day' }
  | { type: 'rename' }
  | { type: 'map' }

function LoadingSkeleton() {
  return (
    <main className="mx-auto max-w-md animate-pulse space-y-3 p-4" aria-busy="true" aria-label="載入中">
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
    return (
      <Notice
        title="請用群組裡的完整連結開啟"
        body="這個網址少了通行資訊。回到群組，點主揪貼的那個連結。"
      />
    )
  }
  if (boot.me === null) return <NameGate onDone={(name) => setBoot({ ...boot, me: name })} />
  return <TripView me={boot.me} onRename={(name) => setBoot({ ...boot, me: name })} />
}

function TripView({ me, onRename }: { me: string; onRename: (name: string) => void }) {
  const { state, connected, apply, retry, reload } = useTrip()
  const [selected, setSelected] = useState<string | null>(null)
  // TripView 只在瀏覽器端讀完裝置資料後才出現，所以可以直接讀
  const [onlyMine, setOnlyMine] = useState(() => loadOnlyMine())
  const [sheet, setSheet] = useState<SheetState>(null)

  if (state.status === 'loading') return <LoadingSkeleton />
  if (state.status === 'error') return <ErrorScreen onRetry={retry} />
  if (state.status === 'bad_key') {
    return <Notice title="連結失效" body="請跟主揪要新的連結。" />
  }
  if (state.status === 'bad_data') {
    return (
      <Notice
        title="行程資料檔格式壞了"
        body="請跟主揪說，他可以從 GitHub 的修改紀錄還原。"
      />
    )
  }

  const { data } = state
  const dates = listDates(data.trip.start_date, data.trip.end_date)
  const current =
    selected && dates.includes(selected) ? selected : defaultDate(dates, localToday(new Date()))

  return (
    <main className="mx-auto min-h-dvh max-w-md">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
        {!connected && (
          <div role="status" className="bg-zinc-900 px-4 py-2 text-center text-xs text-white">
            連線中斷，重新連線中…
          </div>
        )}
        <Header
          trip={data.trip}
          me={me}
          onEditTrip={() => setSheet({ type: 'trip' })}
          onOpenMap={() => setSheet({ type: 'map' })}
          onRename={() => setSheet({ type: 'rename' })}
        />
        <DayStrip dates={dates} days={data.days} current={current} onSelect={setSelected} />
      </header>

      <DayPanel
        data={data}
        date={current}
        me={me}
        onlyMine={onlyMine}
        onToggleMine={(value) => {
          setOnlyMine(value)
          saveOnlyMine(value)
        }}
        onEditDay={() => setSheet({ type: 'day' })}
        onEditItem={(item) => setSheet({ type: 'item', item })}
        onAdd={() => setSheet({ type: 'item', item: null })}
        apply={apply}
      />

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-md p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            className={primaryClass}
            onClick={() => setSheet({ type: 'item', item: null })}
          >
            <Plus size={20} />
            新增行程
          </button>
        </div>
      </div>

      {sheet?.type === 'item' && (
        <ItemForm
          key={sheet.item?.id ?? 'new'}
          item={sheet.item}
          defaultDay={current}
          dates={dates}
          me={me}
          apply={apply}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === 'trip' && (
        <TripForm
          trip={data.trip}
          items={data.items}
          apply={apply}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === 'day' && (
        <DayForm
          key={current}
          day={data.days.find((d) => d.date === current) ?? { date: current, city: '', note: '' }}
          apply={apply}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === 'map' && (
        <TripMap
          items={onlyMine ? filterMine(data.items, data.itemMembers, me) : data.items}
          days={data.days}
          onPickDay={(date) => {
            setSelected(date)
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === 'rename' && (
        <RenameForm
          me={me}
          onRenamed={async (name) => {
            onRename(name)
            await reload()
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </main>
  )
}
