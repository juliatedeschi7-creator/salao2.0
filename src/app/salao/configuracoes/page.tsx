'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Bell, Link, Copy, Check, LogOut, Palette, 
  Smartphone, Clock, ChevronRight, UserCheck, Edit3, Save, 
  X, ShieldCheck, Users, AlertCircle, FileText
} from 'lucide-react'
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
  const { profile, loading, logout } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  
  // Informações
  const [editandoInfo, setEditandoInfo] = useState(false)
  const [formInfo, setFormInfo] = useState({ nome: '', telefone: '', instagram: '', cidade: '', descricao: '' })
  const [salvandoInfo, setSalvandoInfo] = useState(false)
  const [infoSalva, setInfoSalva] = useState(false)
  const [erroInfo, setErroInfo] = useState('')

  // Cores
  const [salvandoCor, setSalvandoCor] = useState(false)
  const [corSelecionada, setCorSelecionada] = useState('')

  // Aprovação Automática
  const [aprovacaoAutomatica, setAprovacaoAutomatica] = useState(false)
  const [salvandoAprovacao, setSalvandoAprovacao] = useState(false)

  // Módulos do Cliente
  const [modulos, setModulos] = useState<Record<string, boolean>>({
    agendamentos: true, pacotes: true, anamnese: true, avaliacoes: true, combos: true,
  })
  const [salvandoModulos, setSalvandoModulos] = useState(false)
  const [modulosSalvos, setModulosSalvos] = useState(false)

  // Permissões Rápidas de Funcionários
  const [permissoesFunc, setPermissoesFunc] = useState({
    ver_faturamento: false,
    ver_clientes: true,
    ver_servicos: true,
    ver_financeiro: false,
    ver_agenda_todos: false,
  })
  const [salvandoPermissoesFunc, setSalvandoPermissoesFunc] = useState(false)
  const [permissoesFuncSalvas, setPermissoesFuncSalvas] = useState(false)

  // Aviso de Serviços
  const [avisoServicos, setAvisoServicos] = useState('')
  const [salvandoAviso, setSalvandoAviso] = useState(false)

  // Push Notifications
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
    if (sal?.permissoes_funcionario) setPermissoesFunc(prev => ({ ...prev, ...sal.permissoes_funcionario }))
    
    setFormInfo({
      nome: sal?.nome || '', 
      telefone: sal?.telefone || '',
      instagram: sal?.instagram || '', 
      cidade: sal?.cidade || '', 
      descricao: sal?.descricao || '',
    })

    const ativo = await verificarPushAtivo()
    setPushAtivo(ativo)
  }

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

  async function salvarAviso() {
    setSalvandoAviso(true)
    await supabase.from('saloes').update({ aviso_servicos: avisoServicos }).eq('id', profile!.salao_id!)
    setSalvandoAviso(false)
  }

  async function salvarModulos() {
    setSalvandoModulos(true)
    await supabase.from('saloes').update({ modulos_cliente: modulos }).eq('id', profile!.salao_id!)
    setSalvandoModulos(false)
    setModulosSalvos(true)
    setTimeout(() => setModulosSalvos(false), 2500)
  }

  async function salvarPermissoesFunc() {
    setSalvandoPermissoesFunc(true)
    await supabase.from('saloes').update({ permissoes_funcionario: permissoesFunc }).eq('id', profile!.salao_id!)
    setSalvandoPermissoesFunc(false)
    setPermissoesFuncSalvas(true)
    setTimeout(() => setPermissoesFuncSalvas(false), 2500)
  }

  async function toggleAprovacaoAutomatica() {
    const novoValor = !aprovacaoAutomatica
    setSalvandoAprovacao(true)
    const { error } = await supabase.from('saloes').update({ aprovacao_automatica_clientes: novoValor }).eq('id', profile!.salao_id!)
    if (!error) setAprovacaoAutomatica(novoValor)
    setSalvandoAprovacao(false)
  }

  async function salvarCor() {
    const paleta = CORES.find(c => c.primaria === corSelecionada)
    if (!paleta) return
    setSalvandoCor(true)
    await supabase.from('saloes').update({ cor_primaria: paleta.primaria, cor_secundaria: paleta.secundaria }).eq('id', profile!.salao_id!)
    setSalvandoCor(false)
    carregarDados()
  }

  async function ativarPush() {
    setAtivandoPush(true)
    const ok = await registrarPush(profile!.id)
    setPushAtivo(ok)
    setAtivandoPush(false)
    setResultadoPush(ok
      ? { ok: true, msg: 'Push ativado! Agora clique em testar.' }
      : { ok: false, msg: 'Não foi possível ativar. Verifique as permissões do seu navegador.' }
    )
    setTimeout(() => setResultadoPush(null), 4000)
  }

  async function testarPush() {
    setTestandoPush(true)
    setResultadoPush(null)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const res = await fetch('/api/push/test/', {
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
          ? '✓ Push enviado! Aguarde a notificação.'
          : '✗ Erro: ' + (json.erro || JSON.stringify(json))
      })
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setResultadoPush({ ok: false, msg: 'Timeout — servidor demorou a responder.' })
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

  const cor = salao?.cor_primaria || '#E91E8C'
  const origem = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-12">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg">Configurações Gerais</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4 max-w-2xl mx-auto">

        {/* 1. Informações do Salão */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-gray-900">Informações do Salão</p>
            {!editandoInfo ? (
              <button onClick={() => setEditandoInfo(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-medium transition-transform active:scale-95"
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
              <p className="text-green-600 text-xs font-semibold text-center">✓ Informações atualizadas com sucesso!</p>
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
                  <span className="font-medium text-gray-900 text-right truncate">{value}</span>
                </div>
              ) : null)}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Nome do salão</label>
                <input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" value={formInfo.nome}
                  onChange={e => setFormInfo(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Espaço de Beleza" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Telefone / WhatsApp</label>
                <input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" value={formInfo.telefone}
                  onChange={e => setFormInfo(p => ({ ...p, telefone: e.target.value }))}
                  placeholder="Ex: 11999999999" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Instagram</label>
                <input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" value={formInfo.instagram}
                  onChange={e => setFormInfo(p => ({ ...p, instagram: e.target.value }))}
                  placeholder="Ex: @salao" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Cidade</label>
                <input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" value={formInfo.cidade}
                  onChange={e => setFormInfo(p => ({ ...p, cidade: e.target.value }))}
                  placeholder="Ex: São Paulo - SP" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Descrição curta</label>
                <textarea className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none" rows={2} value={formInfo.descricao}
                  onChange={e => setFormInfo(p => ({ ...p, descricao: e.target.value }))} />
              </div>
              {erroInfo && <p className="text-red-600 text-xs">{erroInfo}</p>}
              <button onClick={salvarInfo} disabled={salvandoInfo}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: cor }}>
                <Save size={16} />{salvandoInfo ? 'Salvando...' : 'Salvar Informações'}
              </button>
            </div>
          )}
        </div>

        {/* 2. Atalho: Horários Gerais de Funcionamento */}
        <button onClick={() => router.push('/salao/horarios')}
          className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 active:scale-98 transition-all text-left">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${cor}18` }}>
            <Clock size={20} style={{ color: cor }} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-sm">Horários de Funcionamento</p>
            <p className="text-xs text-gray-400 mt-0.5">Defina os dias e horários gerais de atendimento</p>
          </div>
          <ChevronRight size={18} className="text-gray-300 shrink-0" />
        </button>

        {/* 3. ATALHO NOVO: Matriz Completa de Permissões por Cargo (Sim / Não) */}
        <button onClick={() => router.push('/salao/funcionarios/permissoes')}
          className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 active:scale-98 transition-all text-left">
          <div className="w-11 h-11 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} className="text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-sm">Permissões Detalhadas por Cargo</p>
            <p className="text-xs text-gray-400 mt-0.5">Matriz completa de acesso Sim / Não para cada página</p>
          </div>
          <ChevronRight size={18} className="text-gray-300 shrink-0" />
        </button>

        {/* 4. Permissões Rápidas para Funcionários Simples */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
          <div>
            <p className="font-bold text-gray-900 flex items-center gap-2"><Users size={18} />Acessos Rápidos de Funcionários</p>
            <p className="text-xs text-gray-400 mt-0.5">Visibilidade padrão para membros da equipe</p>
          </div>
          {[
            { key: 'ver_faturamento', label: 'Resumo Financeiro do Dia', desc: 'Exibe o faturamento total na Home' },
            { key: 'ver_clientes', label: 'Lista de Clientes', desc: 'Permite visualizar perfis de clientes' },
            { key: 'ver_servicos', label: 'Lista de Serviços', desc: 'Permite visualizar serviços cadastrados' },
            { key: 'ver_financeiro', label: 'Módulo Financeiro', desc: 'Permite acesso ao fluxo de caixa' },
            { key: 'ver_agenda_todos', label: 'Agenda Geral', desc: 'Permite ver a agenda de outros colegas' },
          ].map(p => (
            <div key={p.key} className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-gray-800">{p.label}</p>
                <p className="text-xs text-gray-400">{p.desc}</p>
              </div>
              <button onClick={() => setPermissoesFunc(prev => ({ ...prev, [p.key]: !prev[p.key as keyof typeof permissoesFunc] }))}
                className="relative w-12 h-6 rounded-full transition-colors shrink-0"
                style={{ backgroundColor: permissoesFunc[p.key as keyof typeof permissoesFunc] ? cor : '#d1d5db' }}>
                <div className={'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ' + (permissoesFunc[p.key as keyof typeof permissoesFunc] ? 'left-6' : 'left-0.5')} />
              </button>
            </div>
          ))}
          <button onClick={salvarPermissoesFunc} disabled={salvandoPermissoesFunc}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ backgroundColor: cor }}>
            {permissoesFuncSalvas ? '✓ Salvo!' : salvandoPermissoesFunc ? 'Salvando...' : 'Salvar Acessos Rápidos'}
          </button>
        </div>

        {/* 5. Paleta de Cores do App */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
          <p className="font-bold text-gray-900 flex items-center gap-2"><Palette size={18} />Paleta de Cores do Salão</p>
          <div className="grid grid-cols-4 gap-3">
            {CORES.map(c => (
              <button key={c.primaria} onClick={() => setCorSelecionada(c.primaria)} className="flex flex-col items-center gap-1">
                <div className={'w-11 h-11 rounded-full border-4 transition-all ' + (corSelecionada === c.primaria ? 'border-gray-900 scale-105' : 'border-transparent')}
                  style={{ backgroundColor: c.primaria }} />
                <span className="text-xs text-gray-500">{c.nome}</span>
              </button>
            ))}
          </div>
          {corSelecionada !== salao?.cor_primaria && (
            <button onClick={salvarCor} disabled={salvandoCor}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm mt-1" style={{ backgroundColor: corSelecionada }}>
              {salvandoCor ? 'Salvando...' : 'Aplicar Nova Cor'}
            </button>
          )}
        </div>

        {/* 6. Aparência do App do Cliente */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
          <div>
            <p className="font-bold text-gray-900 flex items-center gap-2"><Smartphone size={18} />Módulos Visíveis no App do Cliente</p>
            <p className="text-xs text-gray-400 mt-0.5">Escolha o que os clientes podem visualizar</p>
          </div>
          {MODULOS.map(m => (
            <div key={m.key} className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-gray-800">{m.label}</p>
                <p className="text-xs text-gray-400">{m.desc}</p>
              </div>
              <button onClick={() => setModulos(prev => ({ ...prev, [m.key]: !prev[m.key] }))}
                className="relative w-12 h-6 rounded-full transition-colors shrink-0"
                style={{ backgroundColor: modulos[m.key] ? cor : '#d1d5db' }}>
                <div className={'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ' + (modulos[m.key] ? 'left-6' : 'left-0.5')} />
              </button>
            </div>
          ))}
          <button onClick={salvarModulos} disabled={salvandoModulos}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ backgroundColor: cor }}>
            {modulosSalvos ? '✓ Salvo!' : salvandoModulos ? 'Salvando...' : 'Salvar Módulos'}
          </button>
        </div>

        {/* 7. Aprovação de Clientes */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-gray-700" />
            <p className="font-bold text-gray-900">Aprovação de Novas Clientes</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-gray-800">Aprovar automaticamente</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {aprovacaoAutomatica ? 'Clientes entram direto ao se cadastrar.' : 'Você aprova manualmente cada nova cliente.'}
              </p>
            </div>
            <button onClick={toggleAprovacaoAutomatica} disabled={salvandoAprovacao}
              className={`relative w-12 h-6 rounded-full transition-all shrink-0 ${salvandoAprovacao ? 'opacity-60' : ''}`}
              style={{ backgroundColor: aprovacaoAutomatica ? cor : '#d1d5db' }}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${aprovacaoAutomatica ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        {/* 8. Aviso em Serviços */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
          <p className="font-bold text-gray-900 flex items-center gap-2"><FileText size={18} />Aviso na Página de Serviços</p>
          <textarea className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs resize-none" rows={4}
            placeholder="Ex: Os tempos exibidos são estimativas..."
            value={avisoServicos} onChange={e => setAvisoServicos(e.target.value)} />
          <button onClick={salvarAviso} disabled={salvandoAviso}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ backgroundColor: cor }}>
            {salvandoAviso ? 'Salvando...' : 'Salvar Aviso'}
          </button>
        </div>

        {/* 9. Links de Clientes */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
          <p className="font-bold text-gray-900 flex items-center gap-2"><Link size={18} />Links de Acesso para Clientes</p>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-500 font-semibold mb-1">Link de Cadastro</p>
              <button onClick={() => copiarTexto(`${origem}/cadastro?salao=${salao?.slug}`, 'cadastro')}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-xs font-semibold w-full"
                style={{ backgroundColor: cor }}>
                {copiado === 'cadastro' ? <><Check size={16} />Copiado!</> : <><Copy size={16} />Copiar Link de Cadastro</>}
              </button>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold mb-1">Link de Login</p>
              <button onClick={() => copiarTexto(`${origem}/login?salao=${salao?.slug}`, 'login')}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold w-full"
                style={{ borderColor: cor, color: cor }}>
                {copiado === 'login' ? <><Check size={16} />Copiado!</> : <><Copy size={16} />Copiar Link de Entrar</>}
              </button>
            </div>
          </div>
        </div>

        {/* 10. Notificações Push */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
          <p className="font-bold text-gray-900 flex items-center gap-2"><Bell size={18} />Notificações Push</p>

          {resultadoPush && (
            <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${resultadoPush.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {resultadoPush.msg}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-800">Status neste dispositivo</p>
              <p className={`text-xs mt-0.5 font-bold ${pushAtivo ? 'text-emerald-600' : 'text-gray-400'}`}>
                {pushAtivo ? '● Ativo' : '○ Não ativado'}
              </p>
            </div>
            {!pushAtivo ? (
              <button onClick={ativarPush} disabled={ativandoPush}
                className="px-4 py-2 rounded-xl text-white text-xs font-bold"
                style={{ backgroundColor: cor }}>
                {ativandoPush ? 'Ativando...' : 'Ativar Push'}
              </button>
            ) : (
              <button onClick={testarPush} disabled={testandoPush}
                className="px-3 py-1.5 rounded-xl border text-xs font-bold"
                style={{ borderColor: cor, color: cor }}>
                {testandoPush ? 'Enviando...' : 'Testar'}
              </button>
            )}
          </div>
        </div>

        {/* Botão Sair */}
        <button onClick={logout} className="flex items-center justify-center gap-2 text-gray-400 text-sm py-4 hover:text-red-500 transition-colors">
          <LogOut size={16} />Sair da conta
        </button>

      </div>
    </div>
  )
}
