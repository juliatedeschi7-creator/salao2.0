
'use client'

// @ts-nocheck
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { notificar } from '@/lib/notificar'
import {
  ArrowLeft,
  Star,
  Send,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  X,
} from 'lucide-react'

export default function ClienteAvaliacoesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [servicos, setServicos] = useState<any[]>([])
  const [depoimentos, setDepoimentos] = useState<any[]>([])

  const [servicoId, setServicoId] = useState('')
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')

  const [editando, setEditando] = useState<any>(null)
  const [novoTexto, setNovoTexto] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [alterandoVisibilidade, setAlterandoVisibilidade] =
    useState<string | null>(null)

  const p = profile as any

  const ehDonoOuAdmin =
    !!profile &&
    (
      ['dono_salao', 'socio', 'admin'].includes(profile.tipo) ||
      p?.acesso_total
    )

  const cor = salao?.cor_primaria || '#E91E8C'

  useEffect(() => {
    if (!loading && profile) {
      carregarDados()
    }
  }, [loading, profile])

  async function carregarDados() {
    if (!profile) return

    setErro('')

    if (profile.tipo === 'cliente') {
      const { data: cli, error: erroCliente } = await supabase
        .from('clientes')
        .select('*, saloes(*)')
        .eq('profile_id', profile.id)
        .maybeSingle()

      if (erroCliente) {
        setErro('Não foi possível carregar os dados da cliente.')
        return
      }

      setCliente(cli)
      setSalao(cli?.saloes || null)

      if (!cli?.saloes?.id) {
        setServicos([])
        setDepoimentos([])
        return
      }

      const { data: srvs } = await supabase
        .from('servicos')
        .select('id, nome')
        .eq('salao_id', cli.saloes.id)
        .eq('ativo', true)

      setServicos(srvs || [])

      // A cliente vê somente avaliações públicas
      // e as avaliações que ela própria escreveu.
      const { data: deps, error: erroDepoimentos } = await supabase
        .from('depoimentos')
        .select('*, clientes(nome), servicos(nome)')
        .eq('salao_id', cli.saloes.id)
        .order('created_at', { ascending: false })

      if (erroDepoimentos) {
        setErro('Não foi possível carregar as avaliações.')
        return
      }

      setDepoimentos(
        (deps || []).filter(
          (d: any) =>
            d.publico === true || d.cliente_id === cli.id
        )
      )

      return
    }

    if (ehDonoOuAdmin && profile.salao_id) {
      const { data: sal, error: erroSalao } = await supabase
        .from('saloes')
        .select('*')
        .eq('id', profile.salao_id)
        .maybeSingle()

      if (erroSalao || !sal) {
        setErro('Não foi possível carregar os dados do salão.')
        return
      }

      setSalao(sal)

      const { data: srvs } = await supabase
        .from('servicos')
        .select('id, nome')
        .eq('salao_id', profile.salao_id)
        .eq('ativo', true)

      setServicos(srvs || [])

      // O proprietário pode visualizar avaliações públicas e ocultas,
      // desde que as permissões do banco autorizem essa consulta.
      const { data: deps, error: erroDepoimentos } = await supabase
        .from('depoimentos')
        .select('*, clientes(nome), servicos(nome)')
        .eq('salao_id', profile.salao_id)
        .order('created_at', { ascending: false })

      if (erroDepoimentos) {
        setErro('Não foi possível carregar as avaliações do salão.')
        return
      }

      setDepoimentos(deps || [])
    }
  }

  async function enviarAvaliacao() {
    if (!texto.trim() || !salao || !cliente || !profile) return

    setSalvando(true)
    setErro('')
    setSucesso(false)

    const { error: erroInsert } = await supabase
      .from('depoimentos')
      .insert({
        salao_id: salao.id,
        cliente_id: cliente.id,
        servico_id: servicoId || null,
        texto: texto.trim(),
        publico: true,
      })

    if (erroInsert) {
      setErro('Não foi possível enviar sua avaliação. Tente novamente.')
      setSalvando(false)
      return
    }

    setTexto('')
    setServicoId('')
    setSalvando(false)
    setSucesso(true)

    await carregarDados()
  }

  function iniciarEdicao(depoimento: any) {
    setEditando(depoimento)
    setNovoTexto(depoimento.texto || '')
    setErro('')
  }

  async function salvarEdicao() {
    if (!editando || !novoTexto.trim() || !cliente || !profile) return

    setSalvandoEdicao(true)
    setErro('')

    const { data: atualizado, error: erroUpdate } = await supabase
      .from('depoimentos')
      .update({ texto: novoTexto.trim() })
      .eq('id', editando.id)
      .eq('cliente_id', cliente.id)
      .select('id, salao_id, cliente_id, texto, updated_at')
      .maybeSingle()

    if (erroUpdate || !atualizado) {
      setErro(
        'Não foi possível atualizar a avaliação. Verifique suas permissões e tente novamente.'
      )
      setSalvandoEdicao(false)
      return
    }

    // Localiza o proprietário para avisá-lo sobre a edição.
    const { data: sal } = await supabase
      .from('saloes')
      .select('id, dono_id, nome')
      .eq('id', atualizado.salao_id)
      .maybeSingle()

    if (sal?.dono_id) {
      try {
        await notificar({
          salaoId: sal.id,
          remetenteId: profile.id,
          destinatarioId: sal.dono_id,
          titulo: 'Avaliação atualizada',
          mensagem: 'Uma cliente editou uma avaliação do seu salão.',
          tipo: 'avaliacao_editada',
          url: '/cliente/avaliacoes',
        })
      } catch (e) {
        console.error('Erro ao notificar o proprietário:', e)
      }
    }

    setEditando(null)
    setNovoTexto('')
    setSalvandoEdicao(false)

    await carregarDados()
  }

  async function excluirAvaliacao(depoimento: any) {
    if (!cliente) return

    const confirmar = window.confirm(
      'Tem certeza de que deseja excluir esta avaliação? Essa ação não pode ser desfeita.'
    )

    if (!confirmar) return

    setErro('')

    const { data: removido, error: erroDelete } = await supabase
      .from('depoimentos')
      .delete()
      .eq('id', depoimento.id)
      .eq('cliente_id', cliente.id)
      .select('id')
      .maybeSingle()

    if (erroDelete || !removido) {
      setErro('Não foi possível excluir a avaliação.')
      return
    }

    if (editando?.id === depoimento.id) {
      setEditando(null)
      setNovoTexto('')
    }

    await carregarDados()
  }

  async function alterarVisibilidade(depoimento: any) {
    if (!salao || !profile) return

    const novoEstado = depoimento.publico !== true
    setAlterandoVisibilidade(depoimento.id)
    setErro('')

    const { data: atualizado, error: erroUpdate } = await supabase
      .from('depoimentos')
      .update({ publico: novoEstado })
      .eq('id', depoimento.id)
      .eq('salao_id', salao.id)
      .select('id, publico')
      .maybeSingle()

    if (erroUpdate || !atualizado) {
      setErro(
        'Não foi possível alterar a visibilidade. Verifique as permissões do salão.'
      )
      setAlterandoVisibilidade(null)
      return
    }

    setDepoimentos((anteriores) =>
      anteriores.map((d) =>
        d.id === atualizado.id
          ? { ...d, publico: atualizado.publico }
          : d
      )
    )

    setAlterandoVisibilidade(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Carregando avaliações...</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="card text-center">
          <p className="text-gray-700 mb-4">
            Entre na sua conta para acessar as avaliações.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="btn-primary"
          >
            Entrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Cabeçalho: mantém a logo, sem função para alterá-la */}
      <div
        className="px-4 pt-10 pb-6 flex items-center gap-3 shadow-sm"
        style={{ backgroundColor: cor }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Voltar"
        >
          <ArrowLeft size={22} className="text-white" />
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-10 h-10 rounded-full bg-white/20 border border-white/40 overflow-hidden flex items-center justify-center shrink-0">
            {salao?.logo_url ? (
              <img
                src={salao.logo_url}
                alt="Logo do salão"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white font-bold text-sm">
                {salao?.nome?.charAt(0) || 'S'}
              </span>
            )}
          </div>

          <div>
            <h1 className="font-bold text-white text-lg">
              Avaliações
            </h1>
            {salao?.nome && (
              <p className="text-white/80 text-xs">
                {salao.nome}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {erro && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"
          >
            <p className="text-red-700 text-sm">{erro}</p>
          </div>
        )}

        {profile.tipo === 'cliente' && (
          <div className="card flex flex-col gap-3">
            <p className="font-bold text-gray-900 flex items-center gap-2">
              <Star size={18} style={{ color: cor }} />
              Deixar avaliação
            </p>

            {sucesso && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <p className="text-green-600 text-sm text-center">
                  Avaliação enviada!
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Serviço (opcional)
              </label>
              <select
                className="input-field"
                value={servicoId}
                onChange={(e) => setServicoId(e.target.value)}
              >
                <option value="">Avaliação geral do salão</option>
                {servicos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Seu comentário
              </label>
              <textarea
                className="input-field resize-none"
                rows={4}
                placeholder="Conte sua experiência..."
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
            </div>

            <button
              onClick={enviarAvaliacao}
              disabled={!texto.trim() || salvando || !cliente || !salao}
              className="w-full text-white rounded-2xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: cor }}
            >
              <Send size={16} />
              {salvando ? 'Enviando...' : 'Enviar avaliação'}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-gray-900">
            Avaliações do salão ({depoimentos.length})
          </p>
        </div>

        {ehDonoOuAdmin && (
          <p className="text-xs text-gray-500">
            Você pode controlar quais avaliações ficam visíveis para as clientes.
          </p>
        )}

        {depoimentos.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-400">
              Nenhuma avaliação ainda
            </p>
          </div>
        ) : (
          depoimentos.map((d) => {
            const ehMinhaAvaliacao =
              profile.tipo === 'cliente' &&
              !!cliente &&
              d.cliente_id === cliente.id

            const podeEditar = ehMinhaAvaliacao
            const podeAlterarVisibilidade = ehDonoOuAdmin

            return (
              <div
                key={d.id}
                className="card flex flex-col gap-3"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: cor }}
                  >
                    {d.clientes?.nome?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">
                      {d.clientes?.nome || 'Cliente'}
                    </p>

                    {d.servicos?.nome && (
                      <p className="text-xs text-gray-400">
                        {d.servicos.nome}
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 shrink-0">
                    {d.created_at
                      ? new Date(d.created_at).toLocaleDateString('pt-BR')
                      : ''}
                  </p>
                </div>

                {d.publico !== true && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-amber-800 text-xs">
                      Esta avaliação está oculta para as clientes.
                    </p>
                  </div>
                )}

                {editando?.id === d.id ? (
                  <div className="flex flex-col gap-3">
                    <textarea
                      className="input-field resize-none"
                      rows={4}
                      value={novoTexto}
                      onChange={(e) => setNovoTexto(e.target.value)}
                      placeholder="Edite sua avaliação"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={salvarEdicao}
                        disabled={!novoTexto.trim() || salvandoEdicao}
                        className="flex-1 text-white rounded-xl py-2 font-semibold disabled:opacity-50"
                        style={{ backgroundColor: cor }}
                      >
                        {salvandoEdicao ? 'Salvando...' : 'Salvar'}
                      </button>

                      <button
                        onClick={() => {
                          setEditando(null)
                          setNovoTexto('')
                        }}
                        className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {d.texto}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {podeEditar && editando?.id !== d.id && (
                    <>
                      <button
                        onClick={() => iniciarEdicao(d)}
                        className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-gray-200 text-gray-700"
                      >
                        <Pencil size={15} />
                        Editar
                      </button>

                      <button
                        onClick={() => excluirAvaliacao(d)}
                        className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-red-200 text-red-600"
                      >
                        <Trash2 size={15} />
                        Excluir
                      </button>
                    </>
                  )}

                  {podeAlterarVisibilidade && (
                    <button
                      onClick={() => alterarVisibilidade(d)}
                      disabled={alterandoVisibilidade === d.id}
                      className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-gray-200 text-gray-700 disabled:opacity-50"
                    >
                      {d.publico === true ? (
                        <>
                          <EyeOff size={15} />
                          {alterandoVisibilidade === d.id
                            ? 'Alterando...'
                            : 'Ocultar'}
                        </>
                      ) : (
                        <>
                          <Eye size={15} />
                          {alterandoVisibilidade === d.id
                            ? 'Alterando...'
                            : 'Tornar pública'}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
