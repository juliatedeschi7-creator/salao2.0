'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X } from 'lucide-react'

export const PAGINAS_SISTEMA = [
  { key: 'avisos', label: 'Avisos', descricao: 'Visualizar avisos' },
  { key: 'pacotes', label: 'Pacotes', descricao: 'Gerenciar pacotes' },
  { key: 'servicos', label: 'Serviços', descricao: 'Gerenciar serviços' },
  { key: 'dashboard', label: 'Dashboard', descricao: 'Visão geral' },
  { key: 'financeiro', label: 'Financeiro', descricao: 'Controle financeiro' },
  { key: 'agenda', label: 'Agenda Total', descricao: 'Visualizar agenda' },
  { key: 'funcionarios', label: 'Funcionários', descricao: 'Gerenciar equipe' },
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
  const [permissoes, setPermissoes] = useState<Record<string, boolean>>(() => {
    const permAtual = funcionario?.permissoes || {}
    const inicial: Record<string, boolean> = {}

    PAGINAS_SISTEMA.forEach(p => {
      inicial[p.key] = permAtual[p.key]?.acesso ?? permAtual[p.key] ?? false
    })
    return inicial
  })

  const [salvando, setSalvando] = useState(false)

  function alternarAcesso(key: string) {
    setPermissoes(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  async function salvarPermissoesDireto() {
    try {
      setSalvando(true)

      if (!funcionario?.id || !funcionario?.salao_id) {
        alert('Erro: ID do funcionário ou salão não encontrado.')
        setSalvando(false)
        return
      }

      // Prepara o payload para a tabela permissoes_cargos
      const payload = PAGINAS_SISTEMA.map(pag => ({
        salao_id: funcionario.salao_id,
        user_id: funcionario.id,
        role: funcionario.role || 'profissional',
        pagina_key: pag.key,
        permitido: !!permissoes[pag.key]
      }))

      // Insere/Atualiza na tabela do banco
      const { error } = await supabase
        .from('permissoes_cargos')
        .upsert(payload, { onConflict: 'salao_id,user_id,pagina_key' })

      if (error) {
        alert('Erro ao salvar no banco: ' + error.message)
        setSalvando(false)
        return
      }

      // Salva também no perfil para retrocompatibilidade
      await supabase
        .from('profiles')
        .update({ permissoes })
        .eq('id', funcionario.id)

      alert('Permissões salvas com sucesso no banco!')
      onSalvo()
      onClose()
    } catch (err: any) {
      alert('Erro inesperado: ' + (err.message || err))
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
            const ativo = permissoes[pag.key] || false
            return (
              <div key={pag.key} className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{pag.label}</p>
                  <p className="text-xs text-gray-400">{pag.descricao}</p>
                </div>
                <button
                  onClick={() => alternarAcesso(pag.key)}
                  className="w-12 h-6 rounded-full transition-all relative shrink-0"
                  style={{ backgroundColor: ativo ? cor : '#d1d5db' }}>
                  <div
                    className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm"
                    style={{ left: ativo ? '26px' : '2px' }}
                  />
                </button>
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
            onClick={salvarPermissoesDireto}
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
