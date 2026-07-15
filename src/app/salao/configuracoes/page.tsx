'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, Link, Copy, Check, LogOut, Palette, Smartphone, Clock, ChevronRight, UserCheck, Edit3, Save, X } from 'lucide-react'
import { registrarPush, verificarPushAtivo } from '@/lib/push-client'

const CORES = [
  { primaria: '#E91E8C', secundaria: '#FCE4F3', nome: 'Rosa' },
  { primaria: '#9C27B0', secundaria: '#F3E5F5', nome: 'Roxo' },
  { primaria: '#E91E63', secundaria: '#FCE4EC', nome: 'Pink' },
  { primaria: '#FF5722', secundaria: '#FBE9E7', nome: 'Laranja' },
  { primaria: '#009688', secundaria: '#E0F2F1', nome: 'Verde' },
  { primaria: '#1976D2', secundaria: '#E3F2FD', nome: 'Azul' },
  { primaria: '#5D4037', secundaria: '#EFEBE9', nome: 'Marrom' },
  { primaria: '#455A64', secundaria: '#ECEFF1', nome: 'Grafite' },
]

const MODULOS = [
  { key: 'agendamentos', label: 'Agendamentos', desc: 'Cliente pode ver e criar agendamentos' },
  { key: 'pacotes', label: 'Pacotes', desc: 'Cliente pode ver seus pacotes contratados' },
  { key: 'anamnese', label: 'Questionários', desc: 'Cliente pode preencher questionários de saúde' },
  { key: 'avaliacoes', label: 'Avaliações', desc: 'Cliente pode deixar avaliações' },
  { key: 'combos', label: 'Combos', desc: 'Cliente pode ver combos promocionais' },
]

export default function ConfiguracoesPage() {
  const [avisoServicos, setAvisoServicos] = useState('')
  const [salvandoAviso, setSalvandoAviso] = useState(false)
  const { profile, loading, logout } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [salvandoCor, setSalvandoCor] = useState(false)
  const [corSelecionada, setCorSelecionada] = useState('')
  const [aprovacaoAutomatica, setAprovacaoAutomatica] = useState(false)
  const [salvandoAprovacao, setSalvandoAprovacao] = useState(false)
  const [modulos, setModulos] = useState<Record<string, boolean>>({
    agendamentos: true, pacotes: true, anamnese: true, avaliacoes: true, combos: true,
  })
  const [salvandoModulos, setSalvandoModulos] = useState(false)
  const [modulosSalvos, setModulosSalvos] = useState(false)

  // Edição de informações
  const [editandoInfo, setEditandoInfo] = useState(false)
  const [formInfo, setFormInfo] = useState({ nome: '', telefone: '', instagram: '', cidade: '', descricao: '' })
  const [salvandoInfo, setSalvandoInfo] = useState(false)
  const [infoSalva, setInfoSalva] = useState(false)

  // Push
  const [pushAtivo, setPushAtivo] = useState(false)
  const [ativandoPush, setAtivandoPush] = useState(false)
  const [testandoPush, setTestandoPush] = useState(false)
  const [resultadoPush, setResultadoPush] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    setAvisoServicos(sal?.aviso_servicos || '')
    setCorSelecionada(sal?.cor_primaria || '#E91E8C')
    setAprovacaoAutomatica(sal?.aprovacao_automatica_clientes === true)
    if (sal?.modulos_cliente) setModulos(prev => ({ ...prev, ...sal.modulos_cliente }))
    setFormInfo({
      nome: sal?.nome || '', telefone: sal?.telefone || '',
      instagram: sal?.instagram || '', cidade: sal?.cidade || '', descricao: sal?.descricao || '',
    })
    const ativo = await verificarPushAtivo()
    setPushAtivo(ativo)
  }

  async function salvarAviso() {
    setSalvandoAviso(true)
    await supabase.from('saloes').update({ aviso_servicos: avisoServicos }).eq('id', profile!.salao_id!)
    setSalvandoAviso(false)
  }

  const [erroInfo, setErroInfo] = useState('')

  async function salvarInfo() {
    if (!formInfo.nome.trim()) { setErroInfo('O nome do salão é obrigatório.'); return }
    setSalvandoInfo(true)
    setErroInfo('')

    const { error } = await supabase
      .from('saloes')
      .update({
        nome: formInfo.nome.trim(),
        telefone: formInfo.telefone.trim(),
        instagram: formInfo.instagram.trim(),
        cidade: formInfo.cidade.trim(),
        descricao: formInfo.descricao.trim(),
      })
      .eq('id', profile!.salao_id!)

    if (error) {
      setErroInfo('Erro: ' + error.message)
    } else {
      setEditandoInfo(false)
      setInfoSalva(true)
      carregarDados()
      setTimeout(() => setInfoSalva(false), 3000)
    }
    setSalvandoInfo(false)
  }

  async function salvarModulos() {
    setSalvandoModulos(true)
    await supabase.from('saloes').update({ modulos_cliente: modulos }).eq('id', profile!.salao_id!)
    setSalvandoModulos(false)
    setModulosSalvos(true)
    setTimeout(() => setModulosSalvos(false), 2500)
  }

  async function toggleAprovacaoAutomatica() {
    const novoValor = !aprovacaoAutomatica
    setSalvandoAprovacao(true)
    const { error } = await supabase.from('saloes').update({ aprovacao_automatica_clientes: novoValor }).eq('id', profile!.salao_id!)
    if (!error) setAprovacaoAutomatica(novoValor)
    setSalvandoAprovacao(false)
  }

async function ativarPush() {
    setAtivandoPush(true)
    const resultado = await registrarPush(profile!.id, profile!.salao_id || undefined)
    const ok = resultado.ok
    setPushAtivo(ok)
    setAtivandoPush(false)
    setResultadoPush(ok
      ? { ok: true, msg: 'Push ativado! Agora clique em testar.' }
      : { ok: false, msg: resultado.motivo || 'Não foi possível ativar. Verifique se o navegador permite notificações.' })
    setTimeout(() => setResultadoPush(null), 4000)
}

async function testarPush() {
  setTestandoPush(true)
  setResultadoPush(null)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
const res = await fetch('/api/push/test/', { // 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: profile!.id }),
      signal: controller.signal
    })
    clearTimeout(timeout)
    
    const json = await res.json()
    setResultadoPush({
      ok: json.ok,
      msg: json.ok
        ? '✓ Push enviado! Aguarde a notificação chegar.'
        : '✗ Erro: ' + (json.erro || JSON.stringify(json))
    })
  } catch (err: any) {
    if (err.name === 'AbortError') {
      setResultadoPush({ ok: false, msg: 'Timeout — servidor demorou demais. Tente novamente.' })
    } else {
      setResultadoPush({ ok: false, msg: 'Erro de conexão: ' + err.message })
    }
  }
  setTestandoPush(false)
}

  function copiarTexto(texto: string, id: string) {
    navigator.clipboard.writeText(texto)
    setCopiado(id)
    setTimeout(() => setCopiado(null), 2000)
  }

  async function salvarCor() {
    const paleta = CORES.find(c => c.primaria === corSelecionada)
    if (!paleta) return
    setSalvandoCor(true)
    await supabase.from('saloes').update({ cor_primaria: paleta.primaria, cor_secundaria: paleta.secundaria }).eq('id', profile!.salao_id!)
    setSalvandoCor(false)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const origem = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg">Configurações</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">

        {/* Informações do Salão */}
        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-gray-900">Informações do Salão</p>
            {!editandoInfo ? (
              <button onClick={() => setEditandoInfo(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-medium"
                style={{ backgroundColor: cor }}>
                <Edit3 size={13} />Editar
              </button>
            ) : (
              <button onClick={() => { setEditandoInfo(false); setFormInfo({ nome: salao?.nome || '', telefone: salao?.telefone || '', instagram: salao?.instagram || '', cidade: salao?.cidade || '', descricao: salao?.descricao || '' }) }}
                className="flex items-center gap-1 text-gray-400 text-sm">
                <X size={16} />Cancelar
              </button>
            )}
          </div>

          {infoSalva && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2">
              <p className="text-green-600 text-sm text-center">✓ Informações salvas!</p>
            </div>
          )}

          {!editandoInfo ? (
            <div className="flex flex-col gap-2">
              {[
                { label: 'Nome', value: salao?.nome },
                { label: 'Cidade', value: salao?.cidade },
                { label: 'Telefone', value: salao?.telefone },
                { label: 'Instagram', value: salao?.instagram },
                { label: 'Descrição', value: salao?.descricao },
              ].map(({ label, value }) => value ? (
                <div key={label} className="flex justify-between text-sm gap-2">
                  <span className="text-gray-400 shrink-0">{label}</span>
                  <span className="font-medium text-gray-900 text-right">{value}</span>
                </div>
              ) : null)}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Nome do salão</label>
                <p className="text-xs text-gray-400 mb-1">Use <span className="font-bold">-</span> para separar o subtítulo. Ex: Maria Magnólia - Espaço de beleza</p>
                <input className="input-field" value={formInfo.nome}
                  onChange={e => setFormInfo(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Maria Magnólia - Espaço de beleza" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Telefone / WhatsApp</label>
                <input className="input-field" value={formInfo.telefone}
                  onChange={e => setFormInfo(p => ({ ...p, telefone: e.target.value }))}
                  placeholder="Ex: 11999999999" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Instagram</label>
                <input className="input-field" value={formInfo.instagram}
                  onChange={e => setFormInfo(p => ({ ...p, instagram: e.target.value }))}
                  placeholder="Ex: @mariamagnolia" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Cidade</label>
                <input className="input-field" value={formInfo.cidade}
                  onChange={e => setFormInfo(p => ({ ...p, cidade: e.target.value }))}
                  placeholder="Ex: São Paulo - SP" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Descrição curta</label>
                <textarea className="input-field resize-none" rows={2} value={formInfo.descricao}
                  onChange={e => setFormInfo(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Ex: Especialistas em unhas e cabelos desde 2018" />
              </div>
              {erroInfo && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <p className="text-red-600 text-xs">{erroInfo}</p>
                </div>
              )}
              <button onClick={salvarInfo} disabled={salvandoInfo}
                className="w-full py-3 rounded-2xl text-white font-medium flex items-center justify-center gap-2"
                style={{ backgroundColor: cor }}>
                <Save size={16} />{salvandoInfo ? 'Salvando...' : 'Salvar informações'}
              </button>
            </div>
          )}
        </div>

        {/* Horários */}
        <button onClick={() => router.push('/salao/horarios')}
          className="card flex items-center gap-4 active:scale-95 transition-all text-left">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${cor}18` }}>
            <Clock size={20} style={{ color: cor }} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-sm">Horários de Funcionamento</p>
            <p className="text-xs text-gray-400 mt-0.5">Defina os dias e horários de atendimento</p>
          </div>
          <ChevronRight size={18} className="text-gray-300 shrink-0" />
        </button>

        {/* Paleta de Cores */}
        <div className="card flex flex-col gap-3">
          <p className="font-bold text-gray-900 flex items-center gap-2"><Palette size={18} />Paleta de Cores</p>
          <div className="grid grid-cols-4 gap-3">
            {CORES.map(c => (
              <button key={c.primaria} onClick={() => setCorSelecionada(c.primaria)} className="flex flex-col items-center gap-1">
                <div className={'w-12 h-12 rounded-full border-4 transition-all ' + (corSelecionada === c.primaria ? 'border-gray-900 scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c.primaria }} />
                <span className="text-xs text-gray-500">{c.nome}</span>
              </button>
            ))}
          </div>
          {corSelecionada !== salao?.cor_primaria && (
            <button onClick={salvarCor} disabled={salvandoCor}
              className="w-full py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: corSelecionada }}>
              {salvandoCor ? 'Salvando...' : 'Salvar nova cor'}
            </button>
          )}
        </div>

        {/* Aparência para clientes */}
        <div className="card flex flex-col gap-4">
          <div>
            <p className="font-bold text-gray-900 flex items-center gap-2"><Smartphone size={18} />Aparência para Clientes</p>
            <p className="text-xs text-gray-400 mt-1">Escolha o que aparece na área da cliente no app</p>
          </div>
          {MODULOS.map(m => (
            <div key={m.key} className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-gray-800">{m.label}</p>
                <p className="text-xs text-gray-400">{m.desc}</p>
              </div>
              <button onClick={() => setModulos(prev => ({ ...prev, [m.key]: !prev[m.key] }))}
                className="relative w-12 h-6 rounded-full transition-colors"
                style={{ backgroundColor: modulos[m.key] ? cor : '#d1d5db' }}>
                <div className={'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ' + (modulos[m.key] ? 'left-6' : 'left-0.5')} />
              </button>
            </div>
          ))}
          <button onClick={salvarModulos} disabled={salvandoModulos}
            className="w-full py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>
            {modulosSalvos ? '✓ Salvo!' : salvandoModulos ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>

        {/* Aprovação de clientes */}
        <div className="card flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-gray-700" />
            <p className="font-bold text-gray-900">Aprovação de Clientes</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-gray-800">Aprovar automaticamente</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {aprovacaoAutomatica ? 'Clientes entram direto ao se cadastrar.' : 'Você aprova manualmente cada nova cliente.'}
              </p>
            </div>
            <button onClick={toggleAprovacaoAutomatica} disabled={salvandoAprovacao}
              className={`relative w-14 h-7 rounded-full transition-all duration-300 shrink-0 ${salvandoAprovacao ? 'opacity-60' : ''}`}
              style={{ backgroundColor: aprovacaoAutomatica ? cor : '#d1d5db' }}>
              <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-300 ${aprovacaoAutomatica ? 'left-7' : 'left-0.5'}`} />
            </button>
          </div>
          {!aprovacaoAutomatica && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2.5">
              <p className="text-xs text-yellow-700">⚠️ Clientes pendentes aparecem na página de Clientes para você aprovar.</p>
            </div>
          )}
        </div>

        {/* Aviso serviços */}
        <div className="card flex flex-col gap-3">
          <p className="font-bold text-gray-900">Aviso na página de Serviços</p>
          <p className="text-xs text-gray-400">Aparece para as clientes na página de serviços. Deixe vazio para não exibir.</p>
          <textarea className="input-field resize-none" rows={6}
            placeholder="Ex: Os tempos exibidos são estimativas..."
            value={avisoServicos} onChange={e => setAvisoServicos(e.target.value)} />
          <button onClick={salvarAviso} disabled={salvandoAviso}
            className="w-full py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>
            {salvandoAviso ? 'Salvando...' : 'Salvar aviso'}
          </button>
        </div>

        {/* Links de clientes */}
        <div className="card flex flex-col gap-3">
          <p className="font-bold text-gray-900 flex items-center gap-2"><Link size={18} />Links para Clientes</p>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-500 font-semibold mb-1">Criar conta (novas clientes)</p>
              <div className="bg-gray-50 rounded-xl px-3 py-2 mb-1.5">
                <p className="text-xs text-gray-500 break-all">{origem}/cadastro?salao={salao?.slug}</p>
              </div>
              <button onClick={() => copiarTexto(`${origem}/cadastro?salao=${salao?.slug}`, 'cadastro')}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium w-full"
                style={{ backgroundColor: cor }}>
                {copiado === 'cadastro' ? <><Check size={16} />Copiado!</> : <><Copy size={16} />Copiar link de cadastro</>}
              </button>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold mb-1">Entrar (clientes já cadastradas)</p>
              <div className="bg-gray-50 rounded-xl px-3 py-2 mb-1.5">
                <p className="text-xs text-gray-500 break-all">{origem}/login?salao={salao?.slug}</p>
              </div>
              <button onClick={() => copiarTexto(`${origem}/login?salao=${salao?.slug}`, 'login')}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium w-full"
                style={{ borderColor: cor, color: cor }}>
                {copiado === 'login' ? <><Check size={16} />Copiado!</> : <><Copy size={16} />Copiar link de entrar</>}
              </button>
            </div>
          </div>
        </div>

        {/* Push notifications */}
        <div className="card flex flex-col gap-3">
          <p className="font-bold text-gray-900 flex items-center gap-2"><Bell size={18} />Notificações Push</p>

          {resultadoPush && (
            <div className={`rounded-xl px-4 py-3 text-sm ${resultadoPush.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              {resultadoPush.msg}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Status neste dispositivo</p>
              <p className={`text-xs mt-0.5 font-medium ${pushAtivo ? 'text-green-500' : 'text-gray-400'}`}>
                {pushAtivo ? '● Ativo' : '○ Não ativado'}
              </p>
            </div>
            {!pushAtivo && (
              <button onClick={ativarPush} disabled={ativandoPush}
                className="px-4 py-2 rounded-xl text-white text-sm font-medium"
                style={{ backgroundColor: cor }}>
                {ativandoPush ? 'Ativando...' : 'Ativar agora'}
              </button>
            )}
          </div>

          {pushAtivo && (
            <button onClick={testarPush} disabled={testandoPush}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium"
              style={{ borderColor: cor, color: cor }}>
              <Bell size={16} />{testandoPush ? 'Enviando...' : 'Testar notificação push'}
            </button>
          )}

          {!pushAtivo && (
            <p className="text-xs text-gray-400 leading-relaxed">
              Ative para receber avisos mesmo com o app fechado. O navegador vai pedir sua permissão.
            </p>
          )}
        </div>

        <button onClick={logout} className="flex items-center justify-center gap-2 text-gray-400 text-sm py-4">
          <LogOut size={16} />Sair da conta
        </button>
      </div>
    </div>
  )
}
