'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MessageCircle, Send, RefreshCw } from 'lucide-react'

interface Props {
  solicitacaoId: string
  profileId: string
  remetenteTipo: 'cliente' | 'salao'
  cor?: string
}

export default function ConversaSolicitacaoAgendamento({
  solicitacaoId,
  profileId,
  remetenteTipo,
  cor = '#E91E8C'
}: Props) {
  const [mensagens, setMensagens] = useState<any[]>([])
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function carregarMensagens() {
    const { data, error } = await supabase
      .from('solicitacoes_agendamento_mensagens')
      .select('*')
      .eq('solicitacao_id', solicitacaoId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Erro ao carregar conversa:', error)
      setErro('Não foi possível carregar as mensagens.')
    } else {
      setMensagens(data || [])
      setErro('')
    }

    setCarregando(false)
  }

  useEffect(() => {
    carregarMensagens()
  }, [solicitacaoId])

  async function enviarMensagem() {
    const texto = mensagem.trim()

    if (!texto || enviando) return

    setEnviando(true)
    setErro('')

    const { error } = await supabase
      .from('solicitacoes_agendamento_mensagens')
      .insert({
        solicitacao_id: solicitacaoId,
        remetente_id: profileId,
        remetente_tipo: remetenteTipo,
        tipo: 'mensagem',
        mensagem: texto,
        horarios_propostos: null
      })

    if (error) {
      console.error('Erro ao enviar mensagem:', error)
      setErro('Não foi possível enviar. Tente novamente.')
    } else {
      setMensagem('')
      await carregarMensagens()
    }

    setEnviando(false)
  }

  function formatarData(valor: string) {
    if (!valor) return ''

    return new Date(valor).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} style={{ color: cor }} />
          <p className="font-semibold text-sm text-gray-800">
            Conversa sobre o agendamento
          </p>
        </div>

        <button
          type="button"
          onClick={carregarMensagens}
          className="p-2 text-gray-400"
          aria-label="Atualizar conversa"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto p-3 space-y-3 bg-gray-50">
        {carregando ? (
          <p className="text-center text-xs text-gray-400 py-4">
            Carregando conversa...
          </p>
        ) : mensagens.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-4">
            Ainda não há mensagens. Você pode conversar por aqui para combinar o melhor horário.
          </p>
        ) : (
          mensagens.map(item => {
            const minhaMensagem =
              item.remetente_id === profileId

            return (
              <div
                key={item.id}
                className={`flex ${
                  minhaMensagem ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className="max-w-[88%] rounded-2xl px-3 py-2 shadow-sm"
                  style={{
                    backgroundColor: minhaMensagem ? cor : '#ffffff',
                    color: minhaMensagem ? '#ffffff' : '#374151'
                  }}
                >
                  <p className="text-[10px] font-semibold opacity-80 mb-1">
                    {item.remetente_tipo === 'cliente'
                      ? 'Cliente'
                      : 'Salão'}
                  </p>

                  <p className="text-sm whitespace-pre-wrap break-words">
                    {item.mensagem}
                  </p>

                  <p className="text-[10px] opacity-70 text-right mt-1">
                    {formatarData(item.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="p-3">
        <textarea
          value={mensagem}
          onChange={e => setMensagem(e.target.value)}
          placeholder={
            remetenteTipo === 'cliente'
              ? 'Responda ou sugira outro dia e horário...'
              : 'Responda à cliente ou combine outro horário...'
          }
          rows={2}
          maxLength={1500}
          className="w-full resize-none rounded-xl border border-gray-200 p-3 text-sm outline-none focus:ring-2"
        />

        {erro && (
          <p className="text-xs text-red-600 mt-2">{erro}</p>
        )}

        <button
          type="button"
          onClick={enviarMensagem}
          disabled={!mensagem.trim() || enviando}
          className="mt-2 w-full min-h-11 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ backgroundColor: cor }}
        >
          <Send size={15} />
          {enviando ? 'Enviando...' : 'Enviar mensagem'}
        </button>
      </div>
    </div>
  )
}