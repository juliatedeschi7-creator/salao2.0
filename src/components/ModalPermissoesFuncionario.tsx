'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X } from 'lucide-react'

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

  async function salvarPermissoes() {
    try {
      setSalvando(true)

      if (!funcionario?.id || !funcionario?.salao_id) {
        alert('Erro: ID do funcionário ou ID do salão está vazio!')
        setSalvando(false)
        return
      }

      // 1. Declaração explícita do payload no escopo correto
      const payload = Object.entries(permissoes).map(([pagina_key, dados]) => ({
        salao_id: funcionario.salao_id,
        user_id: funcionario.id,
        role: funcionario.role || 'profissional',
        pagina_key,
        permitido: dados.acesso
      }))

      // 2. Salva no perfil (formato JSON)
      await supabase
        .from('profiles')
        .update({ permissoes })
        .eq('id', funcionario.id)

      // 3. Salva na tabela 'permissoes_cargos' usando a variável payload declarada acima
      const { error } = await supabase
        .from('permissoes_cargos')
        .upsert(payload, { onConflict: 'salao_id,user_id,pagina_key' })

      if (error) {
        console.error('Erro ao salvar cargos:', error)
        alert('Erro ao salvar na tabela: ' + error.message)
      } else {
        onSalvo()
        onClose()
      }
    } catch (err: any) {
      console.error('Erro inesperado:', err)
      alert('Ocorreu um erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
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
              </div>
            )
          })}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm">
            Cancelar
          </button>
          <button
            onClick={salvarPermissoes}
            disabled={salvando}
            className="flex-1 py-3 rounded-2xl text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center"
            style={{ backgroundColor: cor }}>
            {salvando ? 'Salvando...' : 'Salvar Permissões'}
          </button>
        </div>
      </div>
    </div>
  )
}
