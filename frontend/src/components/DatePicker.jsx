import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { localeFor } from '../i18n/formatDate'

const weekdayLabelsFor = (locale) =>
  Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2023, 0, 1 + i)))

const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()

export default function DatePicker({ value, onChange }) {
  const { i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const locale = localeFor(i18n.language)
  const selected = useMemo(() => new Date(`${value}T00:00:00`), [value])

  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1))
  const ref = useRef(null)

  useEffect(() => { if (open) setViewDate(new Date(selected.getFullYear(), selected.getMonth(), 1)) }, [open, selected])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const weekdayLabels = useMemo(() => weekdayLabelsFor(locale), [locale])
  const label = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: 'numeric' }).format(selected),
    [locale, selected]
  )
  const navLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(viewDate),
    [locale, viewDate]
  )

  const cells = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const startOffset = new Date(year, month, 1).getDay()
    const total = daysInMonth(year, month)
    return [...Array(startOffset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]
  }, [viewDate])

  const today = new Date()
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft
  const NextIcon = isRtl ? ChevronLeft : ChevronRight

  const isSelected = (d) => d && viewDate.getFullYear() === selected.getFullYear() && viewDate.getMonth() === selected.getMonth() && d === selected.getDate()
  const isToday = (d) => d && viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth() && d === today.getDate()

  const shiftMonth = (delta) => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))

  const pick = (d) => {
    if (!d) return
    const yyyy = viewDate.getFullYear()
    const mm = String(viewDate.getMonth() + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    onChange(`${yyyy}-${mm}-${dd}`)
    setOpen(false)
  }

  return (
    <div className="date-picker" ref={ref}>
      <button type="button" className="input date-picker-trigger" onClick={() => setOpen((o) => !o)}>
        <CalendarDays size={14} color="var(--muted)" />
        <span className="date-picker-label">{label}</span>
        <ChevronDown size={14} color="var(--muted)" />
      </button>

      {open && (
        <div className="date-picker-panel day-picker-panel card">
          <div className="date-picker-nav">
            <button type="button" className="icon-btn" onClick={() => shiftMonth(-1)}>
              <PrevIcon size={14} />
            </button>
            <span>{navLabel}</span>
            <button type="button" className="icon-btn" onClick={() => shiftMonth(1)}>
              <NextIcon size={14} />
            </button>
          </div>
          <div className="day-picker-weekdays">
            {weekdayLabels.map((w, i) => <span key={i}>{w}</span>)}
          </div>
          <div className="day-picker-grid">
            {cells.map((d, i) => (
              <button
                key={i}
                type="button"
                disabled={!d}
                className={`day-picker-cell ${!d ? 'empty' : ''} ${isSelected(d) ? 'active' : ''} ${isToday(d) && !isSelected(d) ? 'is-today' : ''}`.trim()}
                onClick={() => pick(d)}
              >
                {d || ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
