import cn from 'clsx'
import type { ReactElement, ReactNode } from 'react'
import { useEffect, useRef } from 'react'

export function Collapse({
  children,
  className,
  isOpen,
  horizontal = false
}: {
  children: ReactNode
  className?: string
  isOpen: boolean
  horizontal?: boolean
}): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef(0)
  const initialOpen = useRef(isOpen)
  const initialRender = useRef(true)

  useEffect(() => {
    const container = containerRef.current
    const inner = innerRef.current
    const animation = animationRef.current
    if (animation) {
      clearTimeout(animation)
    }
    if (initialRender.current || !container || !inner) return

    container.classList.toggle('nx-duration-500', !isOpen)
    container.classList.toggle('nx-duration-300', isOpen)

    if (horizontal) {
      // save initial width to avoid word wrapping when container width will be changed
      inner.style.width = `${inner.clientWidth}px`
      container.style.width = `${inner.clientWidth}px`
    } else {
      container.style.height = `${inner.clientHeight}px`
    }

    if (isOpen) {
      animationRef.current = window.setTimeout(() => {
        // should be style property in kebab-case, not css class name
        container.style.removeProperty('height')
      }, 300)
    } else {
      setTimeout(() => {
        if (horizontal) {
          container.style.width = '0px'
        } else {
          container.style.height = '0px'
        }
      }, 0)
    }
  }, [horizontal, isOpen])

  useEffect(() => {
    initialRender.current = false
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn('nx-transform-gpu nx-overflow-hidden nx-transition-all nx-ease-in-out motion-reduce:nx-transition-none',
        isOpen ? 'md:nx-w-64' : 'md:nx-w-20',
        className
      )}
      style={initialOpen.current || horizontal ? undefined : { height: 0 }}
    >
      <div
        ref={innerRef}
        className={cn(
          'nx-transition-opacity nx-duration-500 nx-ease-in-out motion-reduce:nx-transition-none',
          isOpen ? 'nx-opacity-100 md:nx-w-64' : 'nx-opacity-0 md:nx-w-20',
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}
