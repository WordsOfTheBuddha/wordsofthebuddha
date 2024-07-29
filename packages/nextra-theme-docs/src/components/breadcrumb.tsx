import cn from 'clsx'
import { ArrowRightIcon } from 'nextra/icons'
import type { Item } from 'nextra/normalize-pages'
import type { ReactElement } from 'react'
import { Fragment, useEffect, useState } from 'react'
import { Anchor } from './anchor'

// Define a type for the Home link with withIndexPage property
type HomeItem = {
  title: string;
  route: string;
  withIndexPage?: boolean;
};

export function Breadcrumb({
  activePath
}: {
  activePath: Item[]
}): ReactElement | null {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Filter out elements with title "index"
  const filteredPath = activePath.filter(item => item.title !== 'index');

  // Add Home link at the beginning of the breadcrumb
  const homeItem: HomeItem = { title: 'Home', route: '/', withIndexPage: true };
  const breadcrumbPath: (Item | HomeItem)[] = [homeItem, ...filteredPath];

  return (
    <div className="nextra-breadcrumb nx-mt-1.5 nx-flex nx-items-center nx-gap-1 nx-overflow-hidden nx-text-sm nx-text-gray-500 dark:nx-text-gray-400 contrast-more:nx-text-current">
      {breadcrumbPath.map((item, index) => {
        const isActive = index === breadcrumbPath.length - 1;

        return (
          <Fragment key={item.route + item.title}>
            {index > 0 && <ArrowRightIcon className="nx-w-3.5 nx-shrink-0" />}
            <div
              className={cn(
                'nx-whitespace-nowrap nx-transition-colors',
                isActive
                  ? 'nx-font-medium nx-text-gray-700 contrast-more:nx-font-bold contrast-more:nx-text-current dark:nx-text-gray-100 contrast-more:dark:nx-text-current'
                  : [
                      'nx-min-w-[24px] nx-overflow-hidden nx-text-ellipsis',
                      'hover:nx-text-gray-900 dark:hover:nx-text-gray-100'
                    ]
              )}
              title={item.title}
            >
              {!isActive ? (
                <Anchor href={item.route}>
                  {item.title}
                </Anchor>
              ) : (
                item.title
              )}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
