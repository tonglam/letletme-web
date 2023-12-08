'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger
} from '@/components/ui/navigation-menu'
import DarkMode from './DarkMode'

const liveComponents: menuComponent[] = [
  {
    title: '实时球队',
    href: '/live/entry/1',
    description: '查看球队实时得分'
  },
  {
    title: '实时联赛',
    href: '/live/tournament/1',
    description: '查看联赛实时得分和排名'
  },
  {
    title: '实时比赛',
    href: '/live/match',
    description: '查看实时更新的比赛结果'
  },
  {
    title: '实时团战',
    href: '/live/groupTournament',
    description: '查看实时浙江团战数据'
  }
]

const summaryComponents: menuComponent[] = [
  {
    title: '比赛周',
    href: '/summary/overall/1',
    description: '查看比赛周总体数据'
  },
  {
    title: '球队',
    href: '/summary/entry/1',
    description: '查看球队统计数据'
  },
  {
    title: '联赛',
    href: '/summary/tournament/1',
    description: '查看联赛统计数据'
  }
]

const statComponents: menuComponent[] = [
  {
    title: '身价变化',
    href: '/stat/price/1',
    description: '查看每日价格涨跌'
  },
  {
    title: '阵容选择',
    href: '/stat/tournament/1/1',
    description: '查看联赛每轮阵容选择结果'
  },
  {
    title: '球员数据',
    href: '/stat/player/1',
    description: '查看球员数据'
  }
]

const myComponents: menuComponent[] = [
  {
    title: '我的球队',
    href: '/me/entry/1',
    description: '查看我的球队数据'
  },
  {
    title: '我的联赛',
    href: '/me/tournament/1',
    description: '查看我的联赛数据'
  }
]

export default function Navigation() {
  return (
    <nav className="bg-emerald-500 p-4 sticky top-0 drop-shadow-xl z-10">
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>实时</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
                {liveComponents.map(component => (
                  <ListItem
                    key={component.title}
                    title={component.title}
                    href={component.href}
                  >
                    {component.description}
                  </ListItem>
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger>统计</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
                {summaryComponents.map(component => (
                  <ListItem
                    key={component.title}
                    title={component.title}
                    href={component.href}
                  >
                    {component.description}
                  </ListItem>
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger>数据</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
                {statComponents.map(component => (
                  <ListItem
                    key={component.title}
                    title={component.title}
                    href={component.href}
                  >
                    {component.description}
                  </ListItem>
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger>我的</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
                {myComponents.map(component => (
                  <ListItem
                    key={component.title}
                    title={component.title}
                    href={component.href}
                  >
                    {component.description}
                  </ListItem>
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
        <DarkMode />
      </NavigationMenu>
    </nav>
  )
}

const ListItem = React.forwardRef<
  React.ElementRef<'a'>,
  React.ComponentPropsWithoutRef<'a'>
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  )
})
ListItem.displayName = 'ListItem'
