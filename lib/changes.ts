import { StoreError } from './errors'
import { datesLosingItems } from './schedule'
import { applyChange } from './state'
import type { Trip, TripData } from './types'

// 改旅程名稱或日期。日期檢查放在這裡、對著最新資料做：
// 表單上的檢查只看得到自己畫面上的行程，別人可能剛在被排除的日子新增了一個
export function setTrip(trip: Trip) {
  return (data: TripData): TripData => {
    if (datesLosingItems(data.items, trip.start_date, trip.end_date).length > 0) {
      throw new StoreError('dates_in_use')
    }
    return applyChange(data, { table: 'trip', eventType: 'UPDATE', new: trip, old: null })
  }
}
