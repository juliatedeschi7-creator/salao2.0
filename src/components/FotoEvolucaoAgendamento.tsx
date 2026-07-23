'use client'

import { useState } from 'react'
import { Camera, CheckCircle2, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ComponenteFotoEvolucaoProps {
  clienteId: string
  agendamentoId: string
  corPrimaria?: string
}

export function FotoEvolucaoAgendamento({ 
  clienteId, 
  agendamentoId, 
  corPrimaria = '#E91E8C' 
}: ComponenteFotoEvolucaoProps) {
  const [enviandoAntes, setEnviandoAntes] = useState(false)
  const [enviandoDepois, setEnviandoDepois] = useState(false)
  const [fotoAntesUrl, setFotoAntesUrl] = useState<string | null>(null)
  const [fotoDepoisUrl, setFotoDepoisUrl] = useState<string | null>(null)

  // Função para fazer upload e salvar na tabela de evoluções automaticamente
  async function handleCapturarFoto(e: React.ChangeEvent<HTMLInputElement>, tipo: 'antes' | 'depois') {
    const file = e.target.files?.[0]
    if (!file) return

    const setEnviando = tipo === 'antes' ? setEnviandoAntes : setEnviandoDepois
    const setUrl = tipo === 'antes' ? setFotoAntesUrl : setFotoDepoisUrl

    try {
      setEnviando(true)

      // 1. Upload da imagem para o Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${clienteId}_${tipo}_${Date.now()}.${fileExt}`
      const filePath = `evolucoes/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('evolucoes')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage
        .from('evolucoes')
        .getPublicUrl(filePath)

      const urlFinal = publicData.publicUrl

      // 2. Salva o registro diretamente na tabela 'evolucoes'
      const { error: dbError } = await supabase.from('evolucoes').insert({
        cliente_id: clienteId,
        agendamento_id: agendamentoId,
        [`foto_${tipo}_url`]: urlFinal,
        tipo: tipo,
        created_at: new Date().toISOString(),
      })

      if (dbError) throw dbError

      // 3. Atualiza estado para mostrar o Check de Sucesso!
      setUrl(urlFinal)
    } catch (err) {
      console.error(`Erro ao salvar foto de ${tipo}:`, err)
      alert('Não foi possível salvar a foto. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="bg-pink-50/50 border border-pink-100 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Camera size={18} style={{ color: corPrimaria }} />
        <span className="font-bold text-gray-900 text-sm">Fotos de Evolução</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* BUTTON / CARD FOTO ANTES */}
        <label className="relative border-2 border-dashed border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer bg-white hover:bg-gray-50 transition-colors h-28 overflow-hidden">
          {fotoAntesUrl ? (
            <>
              <img src={fotoAntesUrl} alt="Antes" className="w-full h-full object-cover rounded-lg" />
              {/* Check de Foto Guardada com Sucesso */}
              <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-0.5 shadow">
                <CheckCircle2 size={18} />
              </div>
            </>
          ) : enviandoAntes ? (
            <div className="flex flex-col items-center gap-1 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-[11px]">Guardando...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-gray-500">
              <Camera size={22} className="text-gray-400" />
              <span className="text-xs font-semibold">Tirar Foto ANTES</span>
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            capture="environment" // Abre a câmera direto no celular
            className="hidden"
            onChange={(e) => handleCapturarFoto(e, 'antes')}
            disabled={enviandoAntes}
          />
        </label>

        {/* BUTTON / CARD FOTO DEPOIS */}
        <label className="relative border-2 border-dashed border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer bg-white hover:bg-gray-50 transition-colors h-28 overflow-hidden">
          {fotoDepoisUrl ? (
            <>
              <img src={fotoDepoisUrl} alt="Depois" className="w-full h-full object-cover rounded-lg" />
              {/* Check de Foto Guardada com Sucesso */}
              <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-0.5 shadow">
                <CheckCircle2 size={18} />
              </div>
            </>
          ) : enviandoDepois ? (
            <div className="flex flex-col items-center gap-1 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-[11px]">Guardando...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-gray-500">
              <Camera size={22} className="text-gray-400" />
              <span className="text-xs font-semibold">Tirar Foto DEPOIS</span>
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            capture="environment" // Abre a câmera direto no celular
            className="hidden"
            onChange={(e) => handleCapturarFoto(e, 'depois')}
            disabled={enviandoDepois}
          />
        </label>
      </div>
    </div>
  )
}
