
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
  ImagePlus,
  Upload,
  LoaderCircle,
} from 'lucide-react'

const BUCKET_DEPOIMENTOS = 'depoimentos'
const LIMITE_IMAGEM = 5 * 1024 * 1024

const TIPOS_IMAGEM = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

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

  const [editando, setEditando] = useState<any>(null)
  const [novoTexto, setNovoTexto] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [alterandoVisibilidade, setAlterandoVisibilidade] =
    useState<string | null>(null)

  // Formulário de depoimentos cadastrados pelo salão.
  const [textoDono, setTextoDono] = useState('')
  const [imagemDono, setImagemDono] = useState<File | null>(null)
  const [previaDono, setPreviaDono] = useState('')
  const [salvandoDono, setSalvandoDono] = useState(false)
  const [sucessoDono, setSucessoDono] = useState('')
  const [publicarDono, setPublicarDono] = useState(true)

  const [erro, setErro] = useState('')
  const [urlsImagens, setUrlsImagens] = useState<Record<string, string>>({})
  const [carregandoImagens, setCarregandoImagens] = useState(false)

  const p = profile as any

  const ehDonoOuAdmin =
    !!profile &&
    (
      ['dono_salao', 'socio', 'admin'].includes(profile.tipo) ||
      p?.acesso_total
    )

  // O envio de imagens exige ser o proprietário real do salão.
  const ehProprietario =
    !!profile &&
    !!salao &&
    salao.dono_id === profile.id

  const cor = salao?.cor_primaria || '#E91E8C'

  useEffect(() => {
    if (!loading && profile) {
      carregarDados()
    }
  }, [loading, profile])

  useEffect(() => {
    if (!imagemDono) {
      setPreviaDono('')
      return
    }

    const url = URL.createObjectURL(imagemDono)
    setPreviaDono(url)

    return () => URL.revokeObjectURL(url)
  }, [imagemDono])

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

  // Gera URLs temporárias para as imagens privadas.
  // O Storage ainda precisa autorizar o usuário pela política RLS.
  useEffect(() => {
    let cancelado = false

    async function carregarImagens() {
      const comImagem = depoimentos.filter(
        (d) => d.imagem_path
      )

      if (!comImagem.length) {
        setUrlsImagens({})
        return
      }

      setCarregandoImagens(true)

      const entradas = await Promise.all(
        comImagem.map(async (d) => {
          const { data, error } = await supabase.storage
            .from(BUCKET_DEPOIMENTOS)
            .createSignedUrl(d.imagem_path, 60 * 30)

          if (error || !data?.signedUrl) {
            console.error(
              'Não foi possível carregar a imagem do depoimento:',
              d.id,
              error
            )
            return [d.id, ''] as const
          }

          return [d.id, data.signedUrl] as const
        })
      )

      if (!cancelado) {
        setUrlsImagens(Object.fromEntries(entradas))
        setCarregandoImagens(false)
      }
    }

    carregarImagens()

    return () => {
      cancelado = true
    }
  }, [depoimentos])

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
      console.error(erroInsert)
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

  function selecionarImagem(arquivo: File | null) {
    setErro('')
    setSucessoDono('')

    if (!arquivo) {
      setImagemDono(null)
      return
    }

    if (!TIPOS_IMAGEM.includes(arquivo.type)) {
      setErro('Escolha uma imagem JPG, PNG ou WebP.')
      return
    }

    if (arquivo.size > LIMITE_IMAGEM) {
      setErro('A imagem deve ter no máximo 5 MB.')
      return
    }

    setImagemDono(arquivo)
  }

  async function enviarDepoimentoDono() {
    if (!ehProprietario || !salao || !profile) {
      setErro('Somente o proprietário do salão pode cadastrar este depoimento.')
      return
    }

    if (!textoDono.trim()) {
      setErro('Escreva um texto ou uma legenda para o depoimento.')
      return
    }

    setSalvandoDono(true)
    setErro('')
    setSucessoDono('')

    let depoimentoCriado: any = null
    let caminhoImagem = ''

    // Primeiro cria o registro para obter o ID do depoimento.
    const { data: novoDepoimento, error: erroInsert } = await supabase
      .from('depoimentos')
      .insert({
        salao_id: salao.id,
        cliente_id: null,
        servico_id: null,
        texto: textoDono.trim(),
        publico: publicarDono,
        imagem_path: null,
      })
      .select('id, salao_id, texto, publico, imagem_path, created_at')
      .single()

    if (erroInsert || !novoDepoimento) {
      console.error(erroInsert)
      setErro(
        'Não foi possível cadastrar o depoimento. Verifique as permissões da tabela.'
      )
      setSalvandoDono(false)
      return
    }

    depoimentoCriado = novoDepoimento

    if (imagemDono) {
      const extensao =
        imagemDono.type === 'image/png'
          ? 'png'
          : imagemDono.type === 'image/webp'
            ? 'webp'
            : 'jpg'

      const nomeArquivo = `${Date.now()}-${crypto.randomUUID()}.${extensao}`

      caminhoImagem =
        `${salao.id}/${depoimentoCriado.id}/${nomeArquivo}`

      const { error: erroUpload } = await supabase.storage
        .from(BUCKET_DEPOIMENTOS)
        .upload(caminhoImagem, imagemDono, {
          contentType: imagemDono.type,
          upsert: false,
        })

      if (erroUpload) {
        console.error(erroUpload)

        // Não deixa um registro incompleto quando o upload falha.
        const { error: erroLimpeza } = await supabase
          .from('depoimentos')
          .delete()
          .eq('id', depoimentoCriado.id)
          .eq('salao_id', salao.id)

        if (erroLimpeza) {
          console.error('Erro ao limpar depoimento incompleto:', erroLimpeza)
        }

        setErro(
          'O depoimento não foi concluído porque o envio da imagem falhou. Confira as políticas do Storage e tente novamente.'
        )
        setSalvandoDono(false)
        return
      }

      const { data: atualizado, error: erroAtualizacao } = await supabase
        .from('depoimentos')
        .update({ imagem_path: caminhoImagem })
        .eq('id', depoimentoCriado.id)
        .eq('salao_id', salao.id)
        .select('id')
        .maybeSingle()

      if (erroAtualizacao || !atualizado) {
        console.error(erroAtualizacao)

        // Tenta retirar o arquivo se não foi possível salvar seu caminho.
        const { error: erroRemoverArquivo } = await supabase.storage
          .from(BUCKET_DEPOIMENTOS)
          .remove([caminhoImagem])

        if (erroRemoverArquivo) {
          console.error('Erro ao remover arquivo órfão:', erroRemoverArquivo)
        }

        setErro(
          'A imagem foi enviada, mas não foi possível vinculá-la ao depoimento. Confira as permissões de atualização.'
        )
        setSalvandoDono(false)
        await carregarDados()
        return
      }
    }

    setTextoDono('')
    setImagemDono(null)
    setPreviaDono('')
    setPublicarDono(true)
    setSucessoDono('Depoimento cadastrado com sucesso!')
    setSalvandoDono(false)

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
      <div
        className="px-4 pt-10 pb-6 flex items-center gap-3 shadow-sm"
        style={{ backgroundColor: cor }}
      >
        <button onClick={() => router.back()} aria-label="Voltar">
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
            <h1 className="font-bold text-white text-lg">Avaliações</h1>
            {salao?.nome && (
              <p className="text-white/80 text-xs">{salao.nome}</p>
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

        {ehProprietario && (
          <div className="card flex flex-col gap-3">
            <p className="font-bold text-gray-900 flex items-center gap-2">
              <ImagePlus size={19} style={{ color: cor }} />
              Adicionar depoimento do salão
            </p>

            <p className="text-sm text-gray-500">
              Você pode registrar um depoimento recebido e anexar um print
              autorizado pela cliente. O texto ou legenda é obrigatório.
            </p>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Texto ou legenda
              </label>
              <textarea
                className="input-field resize-none"
                rows={4}
                placeholder="Escreva o depoimento ou uma legenda para o print..."
                value={textoDono}
                onChange={(e) => setTextoDono(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Print do depoimento (opcional)
              </label>

              <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-2xl p-4 cursor-pointer text-sm text-gray-600 hover:bg-gray-50">
                <Upload size={18} />
                {imagemDono ? 'Trocar imagem' : 'Selecionar imagem'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) =>
                    selecionarImagem(e.target.files?.[0] || null)
                  }
                />
              </label>

              <p className="text-xs text-gray-400 mt-1">
                JPG, PNG ou WebP, até 5 MB.
              </p>
            </div>

            {previaDono && (
              <div className="border rounded-xl p-2 flex flex-col gap-2">
                <img
                  src={previaDono}
                  alt="Prévia do print selecionado"
                  className="w-full max-h-96 object-contain rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setImagemDono(null)}
                  className="self-start inline-flex items-center gap-1 text-sm text-red-600"
                >
                  <X size={15} />
                  Remover imagem
                </button>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={publicarDono}
                onChange={(e) => setPublicarDono(e.target.checked)}
              />
              Deixar público após cadastrar
            </label>

            {sucessoDono && (
              <p className="text-sm text-green-700 bg-green-50 rounded-xl p-3">
                {sucessoDono}
              </p>
            )}

            <button
              onClick={enviarDepoimentoDono}
              disabled={salvandoDono || !textoDono.trim()}
              className="w-full text-white rounded-2xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: cor }}
            >
              {salvandoDono ? (
                <>
                  <LoaderCircle size={17} className="animate-spin" />
                  Salvando depoimento...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Cadastrar depoimento
                </>
              )}
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
            <p className="text-gray-400">Nenhuma avaliação ainda</p>
          </div>
        ) : (
          depoimentos.map((d) => {
            const ehMinhaAvaliacao =
              profile.tipo === 'cliente' &&
              !!cliente &&
              d.cliente_id === cliente.id

            const podeEditar = ehMinhaAvaliacao
            const podeAlterarVisibilidade = ehDonoOuAdmin
            const urlImagem = urlsImagens[d.id]

            return (
              <div key={d.id} className="card flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: cor }}
                  >
                    {d.clientes?.nome?.charAt(0)?.toUpperCase() ||
                      (d.cliente_id ? '?' : salao?.nome?.charAt(0) || 'S')}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">
                      {d.clientes?.nome ||
                        (d.cliente_id ? 'Cliente' : salao?.nome || 'Salão')}
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

                {d.imagem_path && (
                  <div className="flex flex-col gap-2">
                    {urlImagem ? (
                      <a
                        href={urlImagem}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                      >
                        <img
                          src={urlImagem}
                          alt="Imagem do depoimento"
                          loading="lazy"
                          className="w-full max-h-[480px] object-contain rounded-xl border border-gray-100 bg-gray-50"
                        />
                      </a>
                    ) : (
                      <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm text-gray-500">
                        {carregandoImagens
                          ? 'Carregando imagem...'
                          : 'Imagem indisponível. Confira as permissões do Storage.'}
                      </div>
                    )}
                  </div>
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


