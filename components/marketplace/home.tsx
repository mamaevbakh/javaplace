"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarDays, Search, SearchX } from "lucide-react"

import type { Category, VendorListItem } from "@/db/queries"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { CategoryFilter } from "./category-filter"
import { VendorCard } from "./vendor-card"

export function Home({
  categories,
  vendors,
}: {
  categories: Category[]
  vendors: VendorListItem[]
}) {
  const [query, setQuery] = React.useState("")
  const [activeCategory, setActiveCategory] = React.useState("all")

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return vendors.filter((vendor) => {
      const matchesCategory =
        activeCategory === "all" || vendor.category?.slug === activeCategory
      const matchesQuery =
        q === "" ||
        vendor.name.toLowerCase().includes(q) ||
        (vendor.category?.name.toLowerCase().includes(q) ?? false)
      return matchesCategory && matchesQuery
    })
  }, [vendors, query, activeCategory])

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 px-4 pt-5 pb-10">
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold">Найдите услугу рядом</h1>
          <p className="text-sm text-muted-foreground">
            Барбершопы, салоны красоты, массаж, SPA и другое
          </p>
        </div>
        <Button
          variant="ghost"
          className="h-10 shrink-0"
          nativeButton={false}
          render={<Link href="/bookings" />}
        >
          <CalendarDays data-icon="inline-start" />
          Записи
        </Button>
      </header>

      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Поиск услуг и партнёров"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </InputGroup>

      <CategoryFilter
        categories={categories}
        active={activeCategory}
        onChange={setActiveCategory}
      />

      {filtered.length === 0 ? (
        <Empty className="mt-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>Ничего не найдено</EmptyTitle>
            <EmptyDescription>
              Попробуйте изменить запрос или выбрать другую категорию.
            </EmptyDescription>
          </EmptyHeader>
          {query || activeCategory !== "all" ? (
            <Button
              variant="outline"
              onClick={() => {
                setQuery("")
                setActiveCategory("all")
              }}
            >
              Сбросить фильтры
            </Button>
          ) : null}
        </Empty>
      ) : (
        <section className="flex flex-col gap-3">
          {filtered.map((vendor) => (
            <VendorCard key={vendor.id} vendor={vendor} />
          ))}
        </section>
      )}
    </main>
  )
}
