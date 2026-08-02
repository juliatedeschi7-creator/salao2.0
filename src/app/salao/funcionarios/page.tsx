'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { Users, UserPlus, Trash2, Clock, X, Shield } from 'lucide-react'
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

  // Estados do Modal de Jornada / Horários do Funcionário
  const [modalJornadaAberto, setModalJornadaAberto] = useState(false)
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<any>(null)
  const [horarios, setHorarios] = useState({
    inicio: '09:00',
    fim: '18:00',
    dias: ['1', '2', '3', '4', '5', '6'] // Seg a Sáb
  })

  useEffect(() => {
    async function carregar() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.replace('/login'); return }

        const { data: prof } = await supabase
          .from('profiles').select('*').eq('id', session.user.id).single()

        if (!prof || prof.ativo === false) {
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
      .eq('salao_id', salaoId)
      .in('role', ['funcionario', 'dono_salao']) // Filtra estritamente equipe
    setFuncionarios(data || [])
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

      if (usuarioAlvo.salao_id && usuarioAlvo.salao_id === salao.id) {
        setErroVinculo('Este usuário já está vinculado a este salão.')
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

  function abrirJornada(func: any) {
    setFuncionarioSelecionado(func)
    // Se houver horários salvos no perfil ou customizados, pode carregar aqui
    setModalJornadaAberto(true)
  }

  async function salvarJornada(e: React.FormEvent) {
    e.preventDefault()
    if (!funcionarioSelecionado) return

    // Salva as configurações de jornada (pode armazenar num campo JSON ou tabela de expedientes)
    const { error } = await supabase
      .from('profiles')
      .update({ 
        metadata: { jornada: horarios } 
      })
      .eq('id', funcionarioSelecionado.id)

    if (error) {
      alert('Erro ao salvar jornada: ' + error.message)
      return
    }

    alert('Jornada de trabalho atualizada com sucesso!')
    setModalJornadaAberto(false)
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Equipe de Profissionais</h1>
            <p className="text-xs text-gray-500">Gerencie equipe, acessos e jornadas de trabalho</p>
          </div>
          <button onClick={() => { setModalAberto(true); setErroVinculo(''); setSucessoVinculo('') }}
            className="text-white px-4 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-sm active:scale-95 transition-all"
            style={{ backgroundColor: cor }}>
            <UserPlus size={18} /> Vincular E-mail
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

                <div className="flex items-center gap-2">
                  <button onClick={() => abrirJornada(func)}
                    className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold"
                    title="Configurar Jornada">
                    <Clock size={16} style={{ color: cor }} />
                    <span className="hidden sm:inline">Jornada</span>
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

      {/* Modal de Configuração de Jornada */}
      {modalJornadaAberto && funcionarioSelecionado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${cor}15`, color: cor }}>
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Jornada de Trabalho</h3>
                  <p className="text-xs text-gray-500">{funcionarioSelecionado.nome}</p>
                </div>
              </div>
              <button onClick={() => setModalJornadaAberto(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={salvarJornada} className="flex flex-col gap-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-900">Início do Expediente</label>
                  <input type="time" value={horarios.inicio} 
                    onChange={e => setHorarios({...horarios, inicio: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-sm outline-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-900">Fim do Expediente</label>
                  <input type="time" value={horarios.fim} 
                    onChange={e => setHorarios({...horarios, fim: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-sm outline-none" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalJornadaAberto(false)}
                  className="flex-1 border border-gray-200 text-gray-700 py-3.5 rounded-2xl text-sm font-semibold hover:bg-gray-50 transition">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 text-white py-3.5 rounded-2xl text-sm font-semibold active:scale-95 transition"
                  style={{ backgroundColor: cor }}>
                  Salvar Jornada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav items={navItems} corPrimaria={cor} />
    </div>
  )
}
