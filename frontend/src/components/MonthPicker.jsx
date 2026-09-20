import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { localeFor } from '../i18n/formatDate'

const monthNamesFor = (locale) =>
  Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2000, i, 1)))

export default function MonthPicker({ value, onChange }) {
  const { i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const locale = localeFor(i18n.language)
  const [year, month] = value.split('-').map(Number)

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(year)
  const ref = useRef(null)

  useEffect(() => { if (open) setViewYear(year) }, [open, year])

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

  const monthNames = useMemo(() => monthNamesFor(locale), [locale])
  const label = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1)),
    [locale, year, month]
  )

  const today = new Date()
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft
  const NextIcon = isRtl ? ChevronLeft : ChevronRight

  const selectMonth = (m) => {
    onChange(`${viewYear}-${String(m + 1).padStart(2, '0')}`)
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
        <div className="date-picker-panel card">
          <div className="date-picker-nav">
            <button type="button" className="icon-btn" onClick={() => setViewYear((y) => y - 1)}>
              <PrevIcon size={14} />
            </button>
            <span>{viewYear}</span>
            <button type="button" className="icon-btn" onClick={() => setViewYear((y) => y + 1)}>
              <NextIcon size={14} />
            </button>
          </div>
          <div className="month-picker-grid">
            {monthNames.map((name, i) => {
              const isActive = viewYear === year && i + 1 === month
              const isToday = viewYear === today.getFullYear() && i === today.getMonth()
              return (
                <button
                  key={name + i}
                  type="button"
                  className={`month-picker-cell ${isActive ? 'active' : ''} ${isToday && !isActive ? 'is-today' : ''}`.trim()}
                  onClick={() => selectMonth(i)}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
