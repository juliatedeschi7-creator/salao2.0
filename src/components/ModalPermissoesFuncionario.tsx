'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, ShieldCheck, Check, Lock, ShieldAlert } from 'lucide-react'

// Lista de todas as páginas do sistema
export const PAGINAS_SISTEMA = [
  { key: 'agenda', label: 'Agenda & Atendimentos', descricao: 'Ver horários e agendar' },
  { key: 'clientes', label: 'Clientes & Evoluções', descricao: 'Acessar cadastro e fotos de antes/depois' },
  { key: 'financeiro', label: 'Financeiro & Caixa', descricao: 'Faturamento, entradas e saídas' },
  { key: 'servicos', label: 'Serviços & Catálogo', descricao: 'Cadastrar e editar preços de serviços' },
  { key: 'pacotes', label: 'Pacotes & Promoções', descricao: 'Vender e gerenciar pacotes' },
  { key: 'anamnese', label: 'Fichas de Anamnese', descricao: 'Visualizar e preencher fichas' },
  { key: 'relatorios', label: 'Relatórios & Métricas', descricao: 'Desempenho e gráficos do salão' },
  { key: 'configuracoes', label: 'Configurações do Salão', descricao: 'Dados do salão e horários de funcionamento' },
]

type ModalPermissoesProps = {
  funcionario: any
  cor: string
  onClose: () => void
  onSalvo: () => void
}

export default function ModalPermissoesFuncionario({
  funcionario,
  cor,
  onClose,
  onSalvo
}: ModalPermissoesProps) {
  // Inicializa o estado com o JSON atual do funcionário ou padrão
  const [permissoes, setPermissoes] = useState<Record<string, { acesso: boolean; modo: 'dono' | 'funcionario' }>>(() => {
    const permAtual = funcionario?.permissoes || {}
    const inicial: Record<string, { acesso: boolean; modo: 'dono' | 'funcionario' }> = {}

    PAGINAS_SISTEMA.forEach(p => {
      inicial[p.key] = {
        acesso: permAtual[p.key]?.acesso ?? (funcionario?.role === 'admin' || funcionario?.role === 'dono'),
        modo: permAtual[p.key]?.modo || (funcionario?.role === 'admin' || funcionario?.role === 'dono' ? 'dono' : 'funcionario')
      }
    })
    return inicial
  })

  const [salvando, setSalvando] = useState(false)

  function alternarAcesso(key: string) {
    setPermissoes(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        acesso: !prev[key]?.acesso
      }
    }))
  }

  function alterarModo(key: string, modo: 'dono' | 'funcionario') {
    setPermissoes(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        modo
      }
    }))
  }

  async function salvarPermissoes() {
    setSalvando(true)
    const { error } = await supabase
      .from('profiles')
      .update({ permissoes })
      .eq('id', funcionario.id)

    setSalvando(false)
    if (!error) {
      onSalvo()
      onClose()
    } else {
      alert('Erro ao salvar permissões. Tente novamente.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: cor }}>
              {funcionario?.nome?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{funcionario?.nome}</h3>
              <p className="text-xs text-gray-400">Permissões de acesso individuais</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* LISTA DE PÁGINAS E PERMISSÕES */}
        <div className="space-y-3">
          {PAGINAS_SISTEMA.map(pag => {
            const conf = permissoes[pag.key] || { acesso: false, modo: 'funcionario' }
            return (
              <div key={pag.key} className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{pag.label}</p>
                    <p className="text-xs text-gray-400">{pag.descricao}</p>
                  </div>

                  {/* TOGGLE ACESSO (SIM / NÃO) */}
                  <button
                    onClick={() => alternarAcesso(pag.key)}
                    className="w-12 h-6 rounded-full transition-all relative shrink-0"
                    style={{ backgroundColor: conf.acesso ? cor : '#d1d5db' }}>
                    <div
                      className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm"
                      style={{ left: conf.acesso ? '26px' : '2px' }}
                    />
                  </button>
                </div>

                {/* TIPO DE ACESSO (SE PERMITIDO): DONO OU FUNCIONÁRIO */}
                {conf.acesso && (
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-200/60">
                    <span className="text-xs text-gray-500 font-medium mr-1">Nível:</span>
                    <button
                      onClick={() => alterarModo(pag.key, 'funcionario')}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                        conf.modo === 'funcionario'
                          ? 'bg-gray-900 text-white shadow-xs'
                          : 'bg-white text-gray-500 border border-gray-200'
                      }`}>
                      👤 Como Funcionário
                    </button>

                    <button
                      onClick={() => alterarModo(pag.key, 'dono')}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                        conf.modo === 'dono'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-white text-gray-500 border border-gray-200'
                      }`}>
                      👑 Como Dono (Total)
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* BOTOES DE AÇÃO */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm">
            Cancelar
          </button>
          <button
            onClick={salvarPermissoes}
            disabled={salvando}
            className="flex-1 py-3 rounded-2xl text-white font-medium text-sm disabled:opacity-50"
            style={{ backgroundColor: cor }}>
            {salvando ? 'Salvando...' : 'Salvar Permissões'}
          </button>
        </div>
      </div>
    </div>
  )
}
