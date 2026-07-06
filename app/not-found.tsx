import Link from "next/link"
import { SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-10">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>Ничего не нашлось</EmptyTitle>
          <EmptyDescription>
            Возможно, партнёр больше недоступен или ссылка устарела.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
      <Button nativeButton={false} render={<Link href="/" />}>
        На главную
      </Button>
    </main>
  )
}
