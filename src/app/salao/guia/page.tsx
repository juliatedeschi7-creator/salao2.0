'use client'

import { Notebook, ListChecks, Sparkles } from 'lucide-react'

export default function GuiaPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Notebook className="text-pink-600" size={28} />
            Guia de Procedimentos e Tarefas
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Caderno de orientações, rotinas e rotas de execução das tarefas do salão.
          </p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center space-y-4">
        <div className="w-16 h-16 bg-pink-50 text-pink-600 rounded-full flex items-center justify-center mx-auto">
          <Notebook size={32} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Seu Caderno de Guia</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-1">
            Espaço reservado para organizar o passo a passo de tratamentos, manuais operacionais e rotinas da equipe.
          </p>
        </div>
      </div>
    </div>
  )
}
