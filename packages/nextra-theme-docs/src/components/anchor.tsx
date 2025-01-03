// eslint-disable-next-line no-restricted-imports -- only in this file we determine either we include <a /> as child of <NextLink /> based of `newNextLinkBehavior` value
import NextLink from 'next/link'
import next from 'next/package.json'
import type { ComponentProps, ReactElement } from 'react'
import { forwardRef } from 'react'
import { useConfig } from '../contexts'

export type AnchorProps = Omit<ComponentProps<'a'>, 'ref'> & {
  newWindow?: boolean
}

const nextVersion = Number(next.version.split('.')[0])

export const Anchor = forwardRef<HTMLAnchorElement, AnchorProps>(function (
  { href = '', children, newWindow, ...props },
  // ref is used in <NavbarMenu />
  forwardedRef
): ReactElement {
  const config = useConfig()

  if (newWindow) {
    return (
      <a
        ref={forwardedRef}
        href={href}
        target="_blank"
        rel="noreferrer"
        {...props}
        style={{ textDecoration: 'none' }} // Add this line to remove underline on hover
      >
        {children}
        <span className="nx-sr-only nx-select-none"> (opens in a new tab)</span>
      </a>
    )
  }

  if (!href) {
    return (
      <a ref={forwardedRef} {...props} style={{ textDecoration: 'none' }}>
        {children}
      </a>
    )
  }

  if (nextVersion > 12 || config.newNextLinkBehavior) {
    return (
      <NextLink ref={forwardedRef} href={href} {...props} style={{ textDecoration: 'none' }} passHref>
          {children}
      </NextLink>
    )
  }

  return (
    <NextLink href={href} passHref>
      <a ref={forwardedRef} {...props} style={{ textDecoration: 'none' }}>
        {children}
      </a>
    </NextLink>
  )
})

Anchor.displayName = 'Anchor'