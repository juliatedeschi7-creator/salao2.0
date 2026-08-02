'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { Users, UserPlus, Trash2, Clock, X, Settings, Shield, Check, Calendar, Lock } from 'lucide-react'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

export default function FuncionariosPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  const [profile, setProfile] = useState<any>(null)
  const [salao, setSalao] = useState<any>(null)
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  // Estados do Modal de Vínculo
  const [modalAberto, setModalAberto] = useState(false)
  const [emailBusca, setEmailBusca] = useState('')
  const [loadingVinculo, setLoadingVinculo] = useState(false)
  const [erroVinculo, setErroVinculo] = useState('')
  const [sucessoVinculo, setSucessoVinculo] = useState('')

  // Estados do Modal de Configuração Completo (Abas)
  const [modalConfigAberto, setModalConfigAberto] = useState(false)
  const [funcSel, setFuncSel] = useState<any>(null)
  const [abaAtiva, setAbaAtiva] = useState<'cargo' | 'paginas' | 'escala' | 'ponto'>('cargo')
  const [salvandoConfig, setSalvandoConfig] = useState(false)

  // Estados editáveis do funcionário selecionado
  const [cargoEdit, setCargoEdit] = useState('comum')
  const [nivelAcessoEdit, setNivelAcessoEdit] = useState('restrito')
  const [paginasEdit, setPaginasEdit] = useState<any>({
    dashboard: true,
    agenda_total: true,
    agenda_propria: false,
    clientes: true,
    servicos: true,
    pacotes: true,
    financeiro: false,
    avisos: true,
    produtos: false,
    funcionarios: false,
    configuracoes: false
  })
  const [escalaEdit, setEscalaEdit] = useState<any>({
    seg: { ativo: false, entrada: '09:00', saida: '18:00' },
    ter: { ativo: true, entrada: '08:00', saida: '18:00' },
    qua: { ativo: true, entrada: '08:00', saida: '18:00' },
    qui: { ativo: true, entrada: '08:00', saida: '18:00' },
    sex: { ativo: true, entrada: '08:00', saida: '18:00' },
    sab: { ativo: true, entrada: '08:00', saida: '18:00' },
    dom: { ativo: false, entrada: '09:00', saida: '18:00' }
  })
  const [pontoEdit, setPontoEdit] = useState(false)

  useEffect(() => {
    async function carregar() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.replace('/login'); return }

        const { data: prof } = await supabase
          .from('profiles').select('*').eq('id', session.user.id).single()

        if (!prof) {
          await supabase.auth.signOut()
          router.replace('/login')
          return
        }

        let salaoId = prof.salao_id
        if (!salaoId) {
          const { data: salDono } = await supabase
            .from('saloes').select('id').eq('dono_id', session.user.id).maybeSingle()
          if (salDono) salaoId = salDono.id
        }

        if (!salaoId) { router.replace('/criar-salao'); return }

        setProfile(prof)

        const { data: sal } = await supabase.from('saloes').select('*').eq('id', salaoId).single()
        setSalao(sal)

        await buscarFuncionarios(salaoId)
      } catch (e) {
        console.error('Erro:', e)
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [])

  async function buscarFuncionarios(salaoId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`salao_id.eq.${salaoId},escala_dias.not.is.null,permissoes_paginas.not.is.null`)
    
    const listaValida = (data || []).filter(p => p.excluido !== true && p.role !== 'cliente')
    setFuncionarios(listaValida)
  }

  async function vincularPorEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!emailBusca.trim()) { setErroVinculo('Digite um e-mail.'); return }
    setLoadingVinculo(true); setErroVinculo(''); setSucessoVinculo('')

    try {
      const { data: usuarioAlvo, error: errBusca } = await supabase
        .from('profiles')
        .select('id, nome, email, salao_id')
        .eq('email', emailBusca.trim().toLowerCase())
        .maybeSingle()

      if (errBusca || !usuarioAlvo) {
        setErroVinculo('Nenhum usuário encontrado com este e-mail. Peça para ele criar uma conta no app primeiro.')
        setLoadingVinculo(false)
        return
      }

      const { error: errUpdate } = await supabase
        .from('profiles')
        .update({
          salao_id: salao.id,
          role: 'funcionario',
          aprovado: true,
          ativo: true
        })
        .eq('id', usuarioAlvo.id)

      if (errUpdate) {
        setErroVinculo('Erro ao vincular: ' + errUpdate.message)
        setLoadingVinculo(false)
        return
      }

      setSucessoVinculo(`✅ ${usuarioAlvo.nome || usuarioAlvo.email} vinculado com sucesso!`)
      setEmailBusca('')
      await buscarFuncionarios(salao.id)
      
      setTimeout(() => {
        setModalAberto(false)
        setSucessoVinculo('')
      }, 1500)
    } catch (err: any) {
      setErroVinculo('Erro inesperado: ' + err.message)
    } finally {
      setLoadingVinculo(false)
    }
  }

  async function desvincularFuncionario(idFunc: string) {
    if (!confirm('Deseja realmente remover este funcionário do salão?')) return

    const { error } = await supabase
      .from('profiles')
      .update({ salao_id: null, role: 'cliente' })
      .eq('id', idFunc)

    if (error) {
      alert('Erro ao remover: ' + error.message)
      return
    }

    await buscarFuncionarios(salao.id)
  }

  function abrirConfiguracoes(func: any) {
    setFuncSel(func)
    setCargoEdit(func.cargo || func.role || 'comum')
    setNivelAcessoEdit(func.nivel_acesso || 'restrito')
    
    if (func.permissoes_paginas && typeof func.permissoes_paginas === 'object') {
      setPaginasEdit(func.permissoes_paginas)
    }
    if (func.escala_dias && typeof func.escala_dias === 'object') {
      setEscalaEdit(func.escala_dias)
    }
    setPontoEdit(func.controle_ponto || false)
    setAbaAtiva('cargo')
    setModalConfigAberto(true)
  }

  async function salvarAlteracoesConfig() {
    if (!funcSel) return
    setSalvandoConfig(true)

    const dadosAtualizados = {
      cargo: cargoEdit,
      nivel_acesso: nivelAcessoEdit,
      permissoes_paginas: paginasEdit,
      escala_dias: escalaEdit,
      controle_ponto: pontoEdit,
      atualizado_por: profile.id
    }

    const { error } = await supabase
      .from('profiles')
      .update(dadosAtualizados)
      .eq('id', funcSel.id)

    setSalvandoConfig(false)

    if (error) {
      alert('Erro ao salvar: ' + error.message)
      return
    }

    alert('Configurações salvas com sucesso!')
    setModalConfigAberto(false)
    await buscarFuncionarios(salao.id)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (carregando || !profile) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  const navItems = [
    { icon: Users, label: 'Início', href: '/salao' },
    { icon: Users, label: 'Funcionários', href: '/salao/funcionarios' },
  ]

  return (
    <div className="min-h-screen pb-24 bg-gray-50">
      <Header profile={profile} salaoNome={salao?.nome} corPrimaria={cor} />
      
      <div className="px-4 py-5 flex flex-col gap-4 max-w-xl mx-auto">
        {/* Topo ajustado para não quebrar o botão */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Equipe de Profissionais</h1>
            <p className="text-xs text-gray-500">Gerencie equipe, acessos e jornadas</p>
          </div>
          <button onClick={() => { setModalAberto(true); setErroVinculo(''); setSucessoVinculo('') }}
            className="text-white px-4 py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all shrink-0"
            style={{ backgroundColor: cor }}>
            <UserPlus size={16} /> Vincular E-mail
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {funcionarios.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl text-center border border-gray-100 shadow-sm flex flex-col items-center gap-3">
              <Users size={36} className="text-gray-300" />
              <p className="text-gray-500 text-sm">Nenhum profissional vinculado ainda.</p>
            </div>
          ) : (
            funcionarios.map(func => (
              <div key={func.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white uppercase shrink-0"
                    style={{ backgroundColor: cor }}>
                    {func.nome ? func.nome[0] : 'U'}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{func.nome || 'Sem Nome'}</h3>
                    <p className="text-xs text-gray-400">{func.email}</p>
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600">
                      {func.role === 'dono_salao' ? '👑 Dono(a)' : '✂️ Funcionário(a)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button onClick={() => abrirConfiguracoes(func)}
                    className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl transition flex items-center justify-center"
                    title="Gerenciar e Configurar">
                    <Settings size={18} style={{ color: cor }} />
                  </button>

                  {func.role !== 'dono_salao' && (
                    <button onClick={() => desvincularFuncionario(func.id)}
                      className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition" title="Remover do salão">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal para Vincular por E-mail */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${cor}15`, color: cor }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Vincular Profissional</h3>
                  <p className="text-xs text-gray-500">Insira o e-mail da conta do funcionário</p>
                </div>
              </div>
              <button onClick={() => setModalAberto(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={vincularPorEmail} className="flex flex-col gap-3 pt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-900">E-mail do usuário cadastrado</label>
                <input className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3.5 px-4 text-sm outline-none placeholder-gray-400"
                  type="email" placeholder="funcionario@exemplo.com"
                  value={emailBusca} onChange={e => setEmailBusca(e.target.value)} />
              </div>

              {erroVinculo && <div className="bg-red-50 border border-red-200 rounded-xl p-3"><p className="text-red-600 text-xs text-center">{erroVinculo}</p></div>}
              {sucessoVinculo && <div className="bg-green-50 border border-green-200 rounded-xl p-3"><p className="text-green-700 text-xs text-center font-medium">{sucessoVinculo}</p></div>}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalAberto(false)}
                  className="flex-1 border border-gray-200 text-gray-700 py-3.5 rounded-2xl text-sm font-semibold hover:bg-gray-50 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={loadingVinculo}
                  className="flex-1 text-white py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center active:scale-95 transition"
                  style={{ backgroundColor: cor }}>
                  {loadingVinculo ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Vincular'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Configuração Completo com Abas (Cargo, Páginas, Escala, Ponto) */}
      {modalConfigAberto && funcSel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${cor}15`, color: cor }}>
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Gerenciar Profissional</h3>
                  <p className="text-xs text-gray-500">{funcSel.nome}</p>
                </div>
              </div>
              <button onClick={() => setModalConfigAberto(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Abas de Navegação */}
            <div className="grid grid-cols-4 gap-1 bg-gray-50 p-1 rounded-2xl border border-gray-100 shrink-0">
              <button type="button" onClick={() => setAbaAtiva('cargo')}
                className={`py-2 text-xs font-semibold rounded-xl transition ${abaAtiva === 'cargo' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                Cargo
              </button>
              <button type="button" onClick={() => setAbaAtiva('paginas')}
                className={`py-2 text-xs font-semibold rounded-xl transition ${abaAtiva === 'paginas' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                Páginas
              </button>
              <button type="button" onClick={() => setAbaAtiva('escala')}
                className={`py-2 text-xs font-semibold rounded-xl transition ${abaAtiva === 'escala' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                Escala
              </button>
              <button type="button" onClick={() => setAbaAtiva('ponto')}
                className={`py-2 text-xs font-semibold rounded-xl transition ${abaAtiva === 'ponto' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                Ponto
              </button>
            </div>

            {/* Conteúdo das Abas */}
            <div className="flex-1 overflow-y-auto py-2 space-y-4">
              
              {/* ABA CARGO */}
              {abaAtiva === 'cargo' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-900 uppercase">Selecione o Cargo</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div onClick={() => { setCargoEdit('comum'); setNivelAcessoEdit('restrito'); }}
                        className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col gap-1 ${cargoEdit === 'comum' ? 'border-pink-600 bg-pink-50/30' : 'border-gray-200 bg-white'}`}>
                        <Users size={20} style={{ color: cargoEdit === 'comum' ? cor : '#9ca3af' }} />
                        <span className="text-xs font-bold text-gray-900">Funcionário Comum</span>
                        <span className="text-[10px] text-gray-500">Acesso restrito às permissões definidas.</span>
                      </div>
                      <div onClick={() => { setCargoEdit('socio'); setNivelAcessoEdit('total'); }}
                        className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col gap-1 ${cargoEdit === 'socio' ? 'border-pink-600 bg-pink-50/30' : 'border-gray-200 bg-white'}`}>
                        <Shield size={20} style={{ color: cargoEdit === 'socio' ? cor : '#9ca3af' }} />
                        <span className="text-xs font-bold text-gray-900">Sócio / Dono</span>
                        <span className="text-[10px] text-gray-500">Acesso total automático a todas as páginas.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA PÁGINAS */}
              {abaAtiva === 'paginas' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">Selecione quais páginas este funcionário pode visualizar:</p>
                  <div className="space-y-2">
                    {Object.keys(paginasEdit).map(pag => (
                      <label key={pag} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition">
                        <span className="text-xs font-medium text-gray-800 capitalize">{pag.replace('_', ' ')}</span>
                        <input type="checkbox" checked={paginasEdit[pag]}
                          onChange={e => setPaginasEdit({...paginasEdit, [pag]: e.target.checked})}
                          className="w-4 h-4 rounded accent-pink-600" />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* ABA ESCALA */}
              {abaAtiva === 'escala' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">Defina os dias e horários de atendimento da escala:</p>
                  <div className="space-y-2">
                    {Object.keys(escalaEdit).map(dia => (
                      <div key={dia} className="p-3 bg-gray-50 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-900 uppercase">{dia}</span>
                          <input type="checkbox" checked={escalaEdit[dia].ativo}
                            onChange={e => setEscalaEdit({
                              ...escalaEdit, 
                              [dia]: { ...escalaEdit[dia], ativo: e.target.checked }
                            })}
                            className="w-4 h-4 rounded accent-pink-600" />
                        </div>
                        {escalaEdit[dia].ativo && (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-500">Entrada:</span>
                              <input type="time" value={escalaEdit[dia].entrada}
                                onChange={e => setEscalaEdit({
                                  ...escalaEdit,
                                  [dia]: { ...escalaEdit[dia], entrada: e.target.value }
                                })}
                                className="bg-white border border-gray-200 rounded-xl px-2 py-1 text-xs outline-none w-full" />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-500">Saída:</span>
                              <input type="time" value={escalaEdit[dia].saida}
                                onChange={e => setEscalaEdit({
                                  ...escalaEdit,
                                  [dia]: { ...escalaEdit[dia], saida: e.target.value }
                                })}
                                className="bg-white border border-gray-200 rounded-xl px-2 py-1 text-xs outline-none w-full" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ABA PONTO */}
              {abaAtiva === 'ponto' && (
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">Controle de Ponto Eletrônico</h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">Exigir batimento de ponto ao iniciar/encerrar expediente</p>
                    </div>
                    <input type="checkbox" checked={pontoEdit}
                      onChange={e => setPontoEdit(e.target.checked)}
                      className="w-5 h-5 rounded accent-pink-600" />
                  </div>
                </div>
              )}

            </div>

            {/* Rodapé do Modal */}
            <div className="flex gap-2 pt-3 border-t border-gray-100 shrink-0">
              <button type="button" onClick={() => setModalConfigAberto(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-2xl text-xs font-semibold hover:bg-gray-50 transition">
                Cancelar
              </button>
              <button type="button" onClick={salvarAlteracoesConfig} disabled={salvandoConfig}
                className="flex-1 text-white py-3 rounded-2xl text-xs font-semibold active:scale-95 transition shadow-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: cor }}>
                {salvandoConfig ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav items={navItems} corPrimaria={cor} />
    </div>
  )
}
