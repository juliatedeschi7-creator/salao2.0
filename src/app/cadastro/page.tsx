'use client'
import { useState, Suspense, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

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
  const [senha, setSenha] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const isCliente = !!salaoSlug
  const isFuncionario = !!token
  const isNovoSalao = tipo === 'salao'

  useEffect(() => {
    async function buscarDados() {
      if (salaoSlug) {
        const { data } = await supabase.from('saloes')
          .select('nome, cor_primaria, cor_secundaria, aprovacao_automatica_clientes')
          .eq('slug', salaoSlug).maybeSingle()
        if (data) setSalaoInfo(data)
      }
      if (token) {
        const { data: conv } = await supabase.from('convites')
          .select('*, saloes(nome, cor_primaria, cor_secundaria)')
          .eq('token', token).eq('usado', false).maybeSingle()
        if (conv) { setConvite(conv); if (conv.saloes) setSalaoInfo(conv.saloes) }
      }
      setCarregandoSalao(false)
    }
    buscarDados()
  }, [salaoSlug, token])

  async function handleCadastro() {
    if (!nome || !email || !senha) { setErro('Preencha todos os campos.'); return }
    if (senha.length < 6) { setErro('Senha deve ter pelo menos 6 caracteres.'); return }
    if (isCliente && !dataNascimento) { setErro('Informe sua data de nascimento.'); return }
    setLoading(true); setErro('')

    const roleInicial = isCliente ? 'cliente' : isFuncionario ? (convite?.role || 'funcionario') : 'dono_salao'

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password: senha,
        options: { data: { nome: nome.trim(), role: roleInicial } }
      })
      if (error) {
        setErro(error.message.includes('already') ? 'Email já cadastrado.' : 'Erro: ' + error.message)
        setLoading(false); return
      }
      if (!data.user) { setErro('Erro ao criar usuário.'); setLoading(false); return }

      if (isFuncionario && convite) {
        await supabase.from('profiles').upsert({
          id: data.user.id, email: email.trim().toLowerCase(), nome: nome.trim(),
          role: convite.role, salao_id: convite.salao_id,
          acesso_total: convite.acesso_total || false, aprovado: false, ativo: true
        }, { onConflict: 'id' })
        await supabase.from('convites').update({ usado: true }).eq('id', convite.id)
        window.location.href = '/aguardando'; return
      }

      if (isCliente && salaoSlug) {
        const { data: salao } = await supabase.from('saloes')
          .select('id, aprovacao_automatica_clientes').eq('slug', salaoSlug).single()
        if (!salao) { setErro('Salão não encontrado.'); setLoading(false); return }
        const aprovadoAuto = salao.aprovacao_automatica_clientes === true
        const { data: clienteExistente } = await supabase.from('clientes')
          .select('id').eq('salao_id', salao.id).eq('email', email.trim().toLowerCase()).maybeSingle()
        await supabase.from('profiles').upsert({
          id: data.user.id, email: email.trim().toLowerCase(), nome: nome.trim(),
          role: 'cliente', salao_id: salao.id, aprovado: aprovadoAuto, ativo: true
        }, { onConflict: 'id' })
        if (clienteExistente) {
          await supabase.from('clientes').update({ profile_id: data.user.id }).eq('id', clienteExistente.id)
        } else {
          await supabase.from('clientes').insert({
            salao_id: salao.id, profile_id: data.user.id,
            nome: nome.trim(), email: email.trim().toLowerCase(),
            data_nascimento: dataNascimento || null
          })
        }
        window.location.href = aprovadoAuto ? '/cliente' : '/aguardando'; return
      }

      await supabase.from('profiles').upsert({
        id: data.user.id, email: email.trim().toLowerCase(), nome: nome.trim(),
        role: roleInicial, aprovado: false, ativo: true
      }, { onConflict: 'id' })
      window.location.href = isNovoSalao ? '/aguardando' : '/login'
    } catch (e: any) {
      setErro('Erro: ' + (e.message || 'Tente novamente.'))
    }
    setLoading(false)
  }

  const cor = (isCliente || isFuncionario) && salaoInfo?.cor_primaria ? salaoInfo.cor_primaria : '#111827'
  const corSec = (isCliente || isFuncionario) && salaoInfo?.cor_secundaria ? salaoInfo.cor_secundaria : '#f3f4f6'
  const partes = salaoInfo?.nome?.split(' - ')
  const nomePrincipal = partes?.[0]
  const nomeSecundario = partes?.[1]

  if (carregandoSalao) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-10"
      style={{ background: (isCliente || isFuncionario) ? `linear-gradient(to bottom, ${corSec} 0%, #ffffff 340px)` : '#ffffff' }}>

      <div className="w-full max-w-sm flex flex-col items-center gap-1 mb-6 mt-6">
        {isCliente ? (
          <div className="text-center mt-4">
            <div
              className="w-20 h-20 mb-4 mx-auto"
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
            <h1 className="text-2xl font-bold leading-tight" style={{ color: cor }}>
              {nomePrincipal}
            </h1>
            {nomeSecundario && (
              <p className="text-sm font-normal mt-1 text-gray-500">{nomeSecundario}</p>
            )}
            <p className="text-gray-500 text-sm mt-3 text-center leading-relaxed">
              Crie sua conta para acessar nosso catálogo, agendar serviços e acompanhar seus pacotes
            </p>
          </div>
        ) : isFuncionario ? (
          <div className="text-center">
            <div
              className="w-16 h-16 mb-4 mx-auto"
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
            <h1 className="text-xl font-bold" style={{ color: cor }}>
              {nomePrincipal || 'Convite para funcionário'}
            </h1>
            {nomeSecundario && <p className="text-sm text-gray-500 mt-0.5">{nomeSecundario}</p>}
            <p className="text-gray-500 text-sm mt-3 leading-relaxed">
              {convite?.acesso_total ? 'Crie sua conta como co-gestora do salão.' : 'Crie sua conta para colaborar na gestão do salão.'}
            </p>
          </div>
        ) : (
          <div className="text-center">
            <div
              className="w-20 h-20 mb-4 mx-auto"
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
              Crie uma conta para começar a ter controle do seu salão na palma da mão.
            </h1>
            <p className="text-gray-500 text-sm mt-3 leading-relaxed">
              Visualize agenda, catálogo de serviços, envie lembretes e controle pacotes. Facilite sua gestão!
            </p>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4 mt-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-900">Nome completo</label>
          <input className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 text-base outline-none placeholder-gray-400"
            placeholder="Seu nome completo" value={nome} onChange={e => setNome(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-900">Email</label>
          <input className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 text-base outline-none placeholder-gray-400"
            type="email" placeholder="seuemail@exemplo.com"
            value={email} onChange={e => setEmail(e.target.value)} />
        </div>

        {isCliente && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-900">Data de nascimento</label>
            <input className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 text-base outline-none"
              type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)}
              style={{ colorScheme: 'light' }} />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-900">Senha</label>
          <div className="relative">
            <input className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 pr-12 text-base outline-none placeholder-gray-400"
              type={mostrarSenha ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
              value={senha} onChange={e => setSenha(e.target.value)} />
            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              onClick={() => setMostrarSenha(!mostrarSenha)}>
              {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-red-600 text-sm text-center">{erro}</p>
          </div>
        )}

        <button className="w-full text-white rounded-2xl py-4 font-semibold text-base flex items-center justify-center active:scale-95 transition-all mt-1"
          style={{ backgroundColor: cor }} onClick={handleCadastro} disabled={loading}>
          {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Criar conta'}
        </button>

        <p className="text-center text-gray-900 text-sm mb-6">
          Já tem conta?{' '}
          <a href={isCliente ? '/login?salao=' + salaoSlug : '/login'} className="font-bold" style={{ color: cor }}>Entrar</a>
        </p>
      </div>
    </div>
  )
}

export default function CadastroPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CadastroForm />
    </Suspense>
  )
}
