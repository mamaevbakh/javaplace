"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { loginAction, registerAction } from "@/app/partner/actions"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

function errorText(error?: string): string {
  if (error === "exists") return "Такой email уже зарегистрирован."
  if (error === "weak") return "Пароль слишком короткий (минимум 8 символов)."
  return "Неверный email или пароль."
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const isRegister = mode === "register"

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "")
    const password = String(form.get("password") ?? "")
    const name = String(form.get("name") ?? "")
    setError(null)
    startTransition(async () => {
      const res = isRegister
        ? await registerAction(email, password, name)
        : await loginAction(email, password)
      if (res.ok) router.push("/partner")
      else setError(errorText(res.error))
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FieldGroup>
        {isRegister ? (
          <Field>
            <FieldLabel htmlFor="name">Название бизнеса</FieldLabel>
            <Input id="name" name="name" placeholder="Barber King" />
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Пароль</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
          {isRegister ? (
            <FieldDescription>Минимум 8 символов.</FieldDescription>
          ) : null}
        </Field>
      </FieldGroup>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Подождите…" : isRegister ? "Создать аккаунт" : "Войти"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isRegister ? (
          <>
            Уже есть аккаунт?{" "}
            <Link href="/partner/login" className="text-foreground underline">
              Войти
            </Link>
          </>
        ) : (
          <>
            Нет аккаунта?{" "}
            <Link href="/partner/register" className="text-foreground underline">
              Регистрация
            </Link>
          </>
        )}
      </p>
    </form>
  )
}
