
'use client'

import { useState, Suspense, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { notificar } from '@/lib/notificar'

function normalizarNome(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function nomesCorrespondem(nomeA: string, nomeB: string): boolean {
  const palavrasA = new Set(
    normalizarNome(nomeA).split(' ').filter(Boolean)
  )
  const palavrasB = normalizarNome(nomeB).split(' ').filter(Boolean)

  let coincidencias = 0

  for (const palavra of palavrasB) {
    if (palavrasA.has(palavra)) coincidencias++
  }

  return coincidencias >= 2
}

function formatarTelefone(valor: string) {
  const numeros = valor.replace(/\D/g, '').slice(0, 11)

  if (numeros.length <= 2) {
    return numeros.length ? `(${numeros}` : ''
  }

  if (numeros.length <= 6) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`
  }

  if (numeros.length <= 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`
  }

  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`
}

function telefoneValido(valor: string) {
  const numeros = valor.replace(/\D/g, '')
  return numeros.length === 10 || numeros.length === 11
}

function CadastroForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const salaoSlug = searchParams.get('salao')
  const tipo = searchParams.get('tipo')

  const [salaoInfo, setSalaoInfo] = useState<any>(null)
  const [carregandoSalao, setCarregandoSalao] = useState(true)
  const [convite, setConvite] = useState<any>(null)

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')

  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const isCliente = !!salaoSlug
  const isFuncionario = !!token
  const isNovoSalao = tipo === 'salao'

  useEffect(() => {
    let cancelado = false

    async function buscarDados() {
      try {
        if (salaoSlug) {
          const { data, error } = await supabase
            .from('saloes')
            .select(
              'nome, cor_primaria, cor_secundaria, aprovacao_automatica_clientes'
            )
            .eq('slug', salaoSlug)
            .maybeSingle()

          if (error) {
            console.error('Erro ao buscar salão:', error)
          }

          if (!cancelado && data) {
            setSalaoInfo(data)
          }

          if (!cancelado && !data) {
            setErro('Salão não encontrado. Confira o link recebido.')
          }
        }

        if (token) {
          const { data: conv, error: convErr } = await supabase
            .from('convites')
            .select(
              '*, saloes(nome, cor_primaria, cor_secundaria, aprovacao_automatica_clientes)'
            )
            .eq('token', token)
            .eq('usado', false)
            .maybeSingle()

          if (convErr) {
            console.error('Erro ao consultar convite:', convErr)
          }

          if (cancelado) return

          if (conv) {
            setConvite(conv)

            if (conv.saloes) {
              setSalaoInfo(conv.saloes)
            }
          } else {
            setErro(
              'Este link de convite é inválido, expirou ou já foi utilizado.'
            )
          }
        }
      } catch (e) {
        console.error('Erro ao carregar dados do cadastro:', e)

        if (!cancelado) {
          setErro('Não foi possível carregar os dados. Tente novamente.')
        }
      } finally {
        if (!cancelado) {
          setCarregandoSalao(false)
        }
      }
    }

    buscarDados()

    return () => {
      cancelado = true
    }
  }, [salaoSlug, token])

  async function handleCadastro() {
    if (loading) return

    setErro('')

    const nomeLimpo = nome.trim()
    const emailLimpo = email.trim().toLowerCase()
    const telefoneLimpo = telefone.replace(/\D/g, '')

    if (!nomeLimpo || !emailLimpo || !senha) {
      setErro('Preencha todos os campos obrigatórios.')
      return
    }

    if (isCliente && !telefoneValido(telefoneLimpo)) {
      setErro(
        'Informe um celular ou telefone válido com DDD. Digite 10 ou 11 números.'
      )
      return
    }

    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (isCliente && !dataNascimento) {
      setErro('Informe sua data de nascimento.')
      return
    }

    if (isFuncionario && !convite) {
      setErro(
        'Não é possível concluir o cadastro: convite inválido ou expirado.'
      )
      return
    }

    setLoading(true)

    const roleInicial = isCliente
      ? 'cliente'
      : isFuncionario
        ? convite?.role || 'funcionario'
        : 'dono_salao'

    const salaoIdConvite = convite?.salao_id || null
    const acessoTotalConvite = convite?.acesso_total || false

    try {
      const { data, error } = await supabase.auth.signUp({
        email: emailLimpo,
        password: senha,
        options: {
          data: {
            nome: nomeLimpo,
            role: roleInicial,
            salao_id: salaoIdConvite,
            acesso_total: acessoTotalConvite
          }
        }
      })

      if (error) {
        setErro(
          error.message.toLowerCase().includes('already')
            ? 'Este e-mail já está cadastrado. Entre na sua conta.'
            : 'Não foi possível criar a conta: ' + error.message
        )
        return
      }

      if (!data.user) {
        setErro('Não foi possível criar o usuário. Tente novamente.')
        return
      }

      // ─────────────────────────────────────────────
      // FLUXO DE FUNCIONÁRIO / CO-GESTORA
      // ─────────────────────────────────────────────

      if (isFuncionario && convite) {
        const { error: profErr } = await supabase
          .from('profiles')
          .upsert(
            {
              id: data.user.id,
              email: emailLimpo,
              nome: nomeLimpo,
              role: convite.role || 'funcionario',
              salao_id: convite.salao_id,
              acesso_total: convite.acesso_total || false,
              aprovado: false,
              ativo: true
            },
            { onConflict: 'id' }
          )

        if (profErr) {
          console.error('Erro ao salvar perfil do funcionário:', profErr)
          setErro(
            'A conta foi criada, mas não foi possível salvar o perfil da equipe. Entre em contato com o salão.'
          )
          return
        }

        const { error: conviteErr } = await supabase
          .from('convites')
          .update({ usado: true })
          .eq('id', convite.id)

        if (conviteErr) {
          console.error('Erro ao marcar convite como usado:', conviteErr)
        }

        const { data: dono } = await supabase
          .from('profiles')
          .select('id')
          .eq('salao_id', convite.salao_id)
          .eq('role', 'dono_salao')
          .maybeSingle()

        if (dono) {
          const cargoNome = convite.acesso_total
            ? 'co-gestora'
            : 'funcionário(a)'

          await notificar({
            salaoId: convite.salao_id,
            destinatarioId: dono.id,
            titulo: `Nova ${cargoNome} aguardando aprovação`,
            mensagem: `${nomeLimpo} se cadastrou como ${cargoNome} e aguarda sua aprovação.`,
            tipo: 'sistema',
            url: '/salao/equipe'
          })
        }

        window.location.href = '/aguardando'
        return
      }

      // ─────────────────────────────────────────────
      // FLUXO DE CLIENTE
      // ─────────────────────────────────────────────

      if (isCliente && salaoSlug) {
        const { data: salao, error: salaoErr } = await supabase
          .from('saloes')
          .select('id, aprovacao_automatica_clientes')
          .eq('slug', salaoSlug)
          .single()

        if (salaoErr || !salao) {
          console.error('Erro ao localizar salão:', salaoErr)
          setErro('Salão não encontrado. Confira o link e tente novamente.')
          return
        }

        const aprovadoAuto =
          salao.aprovacao_automatica_clientes === true

        const { data: clienteExistente, error: clienteBuscaErr } =
          await supabase
            .from('clientes')
            .select('id')
            .eq('salao_id', salao.id)
            .eq('email', emailLimpo)
            .maybeSingle()

        if (clienteBuscaErr) {
          console.error(
            'Erro ao consultar cliente existente:',
            clienteBuscaErr
          )
          setErro(
            'Não foi possível verificar seu cadastro anterior. Tente novamente.'
          )
          return
        }

        const { error: profErr } = await supabase
          .from('profiles')
          .upsert(
            {
              id: data.user.id,
              email: emailLimpo,
              nome: nomeLimpo,
              role: 'cliente',
              salao_id: salao.id,
              aprovado: aprovadoAuto,
              ativo: true
            },
            { onConflict: 'id' }
          )

        if (profErr) {
          console.error('Erro ao salvar perfil da cliente:', profErr)
          setErro(
            'Sua conta foi criada, mas não foi possível salvar seu perfil. Entre em contato com o salão.'
          )
          return
        }

        let houveSugestaoMesclagem = false

        if (clienteExistente) {
          // Atualiza o registro que já existe para evitar criar
          // um segundo cadastro para a mesma cliente.
          const { error: atualizarClienteErr } = await supabase
            .from('clientes')
            .update({
              profile_id: data.user.id,
              telefone: telefoneLimpo,
              data_nascimento: dataNascimento || null
            })
            .eq('id', clienteExistente.id)
            .eq('salao_id', salao.id)

          if (atualizarClienteErr) {
            console.error(
              'Erro ao atualizar cadastro da cliente:',
              atualizarClienteErr
            )
            setErro(
              'Sua conta foi criada, mas não foi possível atualizar seu cadastro no salão. Entre em contato com o salão.'
            )
            return
          }
        } else {
          const { data: novoCliente, error: inserirClienteErr } =
            await supabase
              .from('clientes')
              .insert({
                salao_id: salao.id,
                profile_id: data.user.id,
                nome: nomeLimpo,
                email: emailLimpo,
                telefone: telefoneLimpo,
                data_nascimento: dataNascimento || null
              })
              .select('id')
              .single()

          if (inserirClienteErr || !novoCliente) {
            console.error(
              'Erro ao criar cadastro da cliente:',
              inserirClienteErr
            )
            setErro(
              'Sua conta foi criada, mas não foi possível salvar seus dados no salão. Entre em contato com o salão.'
            )
            return
          }

          const { data: pendentes, error: pendentesErr } =
            await supabase
              .from('clientes')
              .select('id, nome')
              .eq('salao_id', salao.id)
              .eq('cadastro_pendente', true)
              .neq('id', novoCliente.id)

          if (pendentesErr) {
            console.error(
              'Erro ao consultar cadastros pendentes:',
              pendentesErr
            )
          }

          const possivelDuplicata = (pendentes || []).find(
            (p: any) => nomesCorrespondem(p.nome || '', nomeLimpo)
          )

          if (possivelDuplicata) {
            const { error: mesclagemErr } = await supabase
              .from('sugestoes_mesclagem')
              .insert({
                salao_id: salao.id,
                cliente_pendente_id: possivelDuplicata.id,
                cliente_novo_id: novoCliente.id,
                status: 'pendente'
              })

            if (mesclagemErr) {
              console.error(
                'Erro ao registrar sugestão de mesclagem:',
                mesclagemErr
              )
            } else {
              houveSugestaoMesclagem = true
            }
          }
        }

        const { data: dono } = await supabase
          .from('profiles')
          .select('id')
          .eq('salao_id', salao.id)
          .eq('role', 'dono_salao')
          .maybeSingle()

        if (dono) {
          await notificar({
            salaoId: salao.id,
            destinatarioId: dono.id,
            titulo: aprovadoAuto
              ? 'Nova cliente cadastrada! 🎉'
              : 'Nova cliente aguardando aprovação',
            mensagem: aprovadoAuto
              ? `${nomeLimpo} se cadastrou no seu salão.`
              : `${nomeLimpo} se cadastrou e aguarda sua aprovação.`,
            tipo: 'sistema',
            url: '/salao/clientes'
          })

          if (houveSugestaoMesclagem) {
            await notificar({
              salaoId: salao.id,
              destinatarioId: dono.id,
              titulo: 'Possível contato duplicado',
              mensagem: `"${nomeLimpo}" pode já existir como contato cadastrado manualmente. Toque para revisar e mesclar.`,
              tipo: 'mesclagem',
              url: '/salao/clientes'
            })
          }
        }

        window.location.href = aprovadoAuto ? '/cliente' : '/aguardando'
        return
      }

      // ─────────────────────────────────────────────
      // FLUXO DE CRIAR NOVO SALÃO / OUTROS
      // ─────────────────────────────────────────────

      const { error: profErr } = await supabase
        .from('profiles')
        .upsert(
          {
            id: data.user.id,
            email: emailLimpo,
            nome: nomeLimpo,
            role: roleInicial,
            aprovado: false,
            ativo: true
          },
          { onConflict: 'id' }
        )

      if (profErr) {
        console.error('Erro ao salvar perfil:', profErr)
        setErro(
          'A conta foi criada, mas não foi possível salvar o perfil. Entre em contato com o suporte.'
        )
        return
      }

      window.location.href = isNovoSalao ? '/aguardando' : '/login'
    } catch (e: any) {
      console.error('Erro no cadastro:', e)
      setErro('Erro: ' + (e?.message || 'Tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  const cor =
    (isCliente || isFuncionario) && salaoInfo?.cor_primaria
      ? salaoInfo.cor_primaria
      : '#111827'

  const corSec =
    (isCliente || isFuncionario) && salaoInfo?.cor_secundaria
      ? salaoInfo.cor_secundaria
      : '#f3f4f6'

  const partes = salaoInfo?.nome?.split(' - ')
  const nomePrincipal = partes?.[0]
  const nomeSecundario = partes?.[1]

  if (carregandoSalao) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      {(isCliente || isFuncionario) && (
        <link
          href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&display=swap"
          rel="stylesheet"
        />
      )}

      <div
        className="min-h-screen flex flex-col items-center px-6 py-6"
        style={{
          background:
            isCliente || isFuncionario
              ? `linear-gradient(to bottom, ${corSec} 0%, #ffffff 300px)`
              : '#ffffff'
        }}
      >
        <div className="w-full max-w-sm flex flex-col items-center mb-4 mt-4">
          {isCliente ? (
            <div className="text-center">
              <div
                className="w-24 h-24 mb-1 mx-auto"
                style={{
                  backgroundColor: cor,
                  WebkitMaskImage: 'url(/logo.png)',
                  maskImage: 'url(/logo.png)',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center'
                }}
              />

              <h1
                style={{
                  fontFamily: "'Dancing Script', cursive",
                  fontSize: '2.2rem',
                  fontWeight: 700,
                  color: cor,
                  lineHeight: 1.1,
                  marginTop: 0
                }}
              >
                {nomePrincipal}
              </h1>

              {nomeSecundario && (
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {nomeSecundario}
                </p>
              )}

              <p className="text-gray-500 text-sm mt-2 text-center leading-relaxed">
                Crie sua conta para acessar nosso catálogo, agendar serviços
                e acompanhar seus pacotes.
              </p>
            </div>
          ) : isFuncionario ? (
            <div className="text-center">
              <div
                className="w-20 h-20 mb-1 mx-auto"
                style={{
                  backgroundColor: cor,
                  WebkitMaskImage: 'url(/logo.png)',
                  maskImage: 'url(/logo.png)',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center'
                }}
              />

              <h1
                style={{
                  fontFamily: "'Dancing Script', cursive",
                  fontSize: '2rem',
                  fontWeight: 700,
                  color: cor,
                  lineHeight: 1.1
                }}
              >
                {nomePrincipal || 'Convite Especial'}
              </h1>

              {nomeSecundario && (
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {nomeSecundario}
                </p>
              )}

              <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                {convite?.acesso_total
                  ? 'Crie sua conta como co-gestora do salão.'
                  : 'Crie sua conta para colaborar na equipe do salão.'}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div
                className="w-20 h-20 mb-3 mx-auto"
                style={{
                  backgroundColor: '#111827',
                  WebkitMaskImage: 'url(/logo.png)',
                  maskImage: 'url(/logo.png)',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center'
                }}
              />

              <h1 className="text-2xl font-bold text-black leading-tight">
                Crie uma conta para começar a ter controle do seu salão na
                palma da mão
              </h1>

              <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                Visualize agenda, catálogo de serviços, envie lembretes e
                controle pacotes.
              </p>
            </div>
          )}
        </div>

        <div className="w-full max-w-sm flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-900">
              Nome completo
            </label>

            <input
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3.5 px-4 text-base outline-none placeholder-gray-400"
              placeholder="Seu nome completo"
              value={nome}
              onChange={e => setNome(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-900">
              E-mail
            </label>

            <input
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3.5 px-4 text-base outline-none placeholder-gray-400"
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />
          </div>

          {isCliente && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-900">
                  Celular / telefone de contato *
                </label>

                <input
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3.5 px-4 text-base outline-none placeholder-gray-400"
                  type="tel"
                  placeholder="(16) 99999-9999"
                  value={telefone}
                  onChange={e => setTelefone(formatarTelefone(e.target.value))}
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={16}
                  required
                />

                <p className="text-xs text-gray-500">
                  Informe o DDD e um número válido para que o salão possa
                  entrar em contato quando necessário.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-900">
                  Data de nascimento
                </label>

                <input
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3.5 px-4 text-base outline-none"
                  type="date"
                  value={dataNascimento}
                  onChange={e => setDataNascimento(e.target.value)}
                  style={{ colorScheme: 'light' }}
                  autoComplete="bday"
                  required
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-900">
              Senha
            </label>

            <div className="relative">
              <input
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3.5 px-4 pr-12 text-base outline-none placeholder-gray-400"
                type={mostrarSenha ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                autoComplete="new-password"
              />

              <button
                type="button"
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                onClick={() => setMostrarSenha(!mostrarSenha)}
              >
                {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {erro && (
            <div
              className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"
              role="alert"
            >
              <p className="text-red-600 text-sm text-center">{erro}</p>
            </div>
          )}

          <button
            type="button"
            className="w-full text-white rounded-2xl py-4 font-semibold text-base flex items-center justify-center active:scale-95 transition-all disabled:opacity-60"
            style={{ backgroundColor: cor }}
            onClick={handleCadastro}
            disabled={loading || (isFuncionario && !convite)}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Criar conta'
            )}
          </button>

          <p className="text-center text-gray-900 text-sm pb-4">
            Já tem conta?{' '}
            <a
              href={isCliente ? '/login?salao=' + salaoSlug : '/login'}
              className="font-bold"
              style={{ color: cor }}
            >
              Entrar
            </a>
          </p>
        </div>
      </div>
    </>
  )
}

export default function CadastroPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CadastroForm />
    </Suspense>
  )
}
