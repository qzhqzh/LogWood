'use client'

import { useState, useRef, useEffect } from 'react'

interface Option {
  value: string
  label: string
}

interface CustomSelectProps {
  options?: Option[]
  groups?: { label: string; options: Option[] }[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function CustomSelect({ options = [], groups, value, onChange, placeholder = '请选择...' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const allOptions = groups 
    ? groups.flatMap(g => g.options) 
    : options

  const selectedOption = allOptions.find(o => o.value === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 cyber-input rounded-xl text-left flex items-center justify-between"
      >
        <span className={selectedOption ? 'text-[var(--color-text-strong)]' : 'text-muted'}>
          {selectedOption?.label || placeholder}
        </span>
        <svg
          className={`w-5 h-5 text-coding transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-2xl shadow-cyan-500/20">
          <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-transparent">
            {!groups && options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`w-full px-4 py-3 text-left transition-all duration-200 ${
                  option.value === value
                    ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-coding'
                    : 'text-muted hover:bg-cyan-500/10 hover:text-[var(--color-text-strong)]'
                }`}
              >
                {option.label}
              </button>
            ))}

            {groups?.map((group, groupIndex) => (
              <div key={groupIndex}>
                <div className="px-4 py-2 text-xs font-semibold text-coding uppercase tracking-wider bg-cyan-500/10 border-b border-[var(--color-divider)] sticky top-0">
                  {group.label}
                </div>
                {group.options.length === 0 ? (
                  <div className="px-4 py-3 text-muted text-sm">暂无工具</div>
                ) : (
                  group.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value)
                        setIsOpen(false)
                      }}
                      className={`w-full px-4 py-3 text-left transition-all duration-200 ${
                        option.value === value
                          ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-coding'
                          : 'text-muted hover:bg-cyan-500/10 hover:text-[var(--color-text-strong)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {option.value === value && (
                          <span className="text-coding">✓</span>
                        )}
                        <span className={option.value === value ? 'pl-0' : 'pl-5'}>
                          {option.label}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
