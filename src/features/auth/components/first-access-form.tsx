'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { mensagemDoErro } from '../lib/errors'
import { redefinirSenhaSchema, type RedefinirSenhaInput } from '../schemas/auth.schema'
import { authService } from '../services'
import { AuthField } from './auth-field'
import { AuthSubmit } from './auth-submit'
import { FormMessage } from './form-message'
import { IconLock } from './icons'

/**
 * Primeiro acesso da profissional — a tela que o link do convite abre
 * (`/primeiro-acesso?token=…`). Define a senha via
 * `POST /auth/profissional/primeiro-acesso`; o token é de uso único e expira.
 *
 * Não confundir com `/admin/primeiro-acesso`, que é outro fluxo: lá a pessoa já entrou
 * com uma senha provisória e a troca a partir da sessão, sem token.
 */
export function FirstAccessForm({ token }: { token?: string }) {
  const [concluido, setConcluido] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RedefinirSenhaInput>({
    resolver: zodResolver(redefinirSenhaSchema),
    defaultValues: { senha: '', confirmarSenha: '' },
  })

  async function onSubmit(values: RedefinirSenhaInput) {
    setErroGeral(null)
    if (!token) {
      setErroGeral('Link inválido. Peça um novo convite à equipe Entre Ser.')
      return
    }
    try {
      await authService.profissionalPrimeiroAcesso(token, values)
      setConcluido(true)
    } catch (e) {
      setErroGeral(mensagemDoErro(e))
    }
  }

  if (concluido) {
    return (
      <div className="space-y-4">
        <FormMessage tone="success">
          Senha criada. Agora é só entrar no painel com o seu e-mail e a nova senha.
        </FormMessage>
        <Link
          href="/admin/login"
          className="block text-center text-sm font-medium text-cream transition-colors hover:text-cream/80"
        >
          Ir para o painel
        </Link>
      </div>
    )
  }

  if (!token) {
    return (
      <FormMessage>
        Link inválido ou incompleto. Abra o link direto do e-mail de convite, ou peça um novo
        à equipe Entre Ser.
      </FormMessage>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {erroGeral && <FormMessage>{erroGeral}</FormMessage>}

      <p className="text-sm leading-relaxed text-cream/70">
        Bem-vinda! Crie uma senha para acessar o seu painel de atendimentos.
      </p>

      <AuthField
        label="Senha"
        type="password"
        autoComplete="new-password"
        placeholder="Mínimo 8 caracteres"
        icon={<IconLock />}
        error={errors.senha?.message}
        {...register('senha')}
      />

      <AuthField
        label="Confirmar senha"
        type="password"
        autoComplete="new-password"
        placeholder="Repita a senha"
        icon={<IconLock />}
        error={errors.confirmarSenha?.message}
        {...register('confirmarSenha')}
      />

      <AuthSubmit isLoading={isSubmitting}>Criar senha e continuar</AuthSubmit>
    </form>
  )
}
