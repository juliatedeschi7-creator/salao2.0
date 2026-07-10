// Renderiza [[texto do link|conteúdo explicativo]] como links clicáveis
import React from 'react'

interface Props {
  texto: string
  cor: string
  onAbrirExplicacao: (titulo: string, conteudo: string) => void
}

export function TextoComLinks({ texto, cor, onAbrirExplicacao }: Props) {
  const partes: React.ReactNode[] = []
  // IMPORTANTE: regex criada dentro da função para resetar o lastIndex a cada render
  const regex = /\[\[(.+?)\|(.+?)\]\]/g
  let ultimo = 0
  let chave = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(texto)) !== null) {
    // Texto antes do link
    if (match.index > ultimo) {
      partes.push(<span key={chave++}>{texto.slice(ultimo, match.index)}</span>)
    }
    const titulo = match[1]
    const conteudo = match[2]
    partes.push(
      <button
        key={chave++}
        type="button"
        onClick={e => { e.stopPropagation(); onAbrirExplicacao(titulo, conteudo) }}
        className="font-semibold underline underline-offset-2 decoration-2 inline"
        style={{ color: cor }}>
        {titulo}
      </button>
    )
    ultimo = regex.lastIndex
  }

  // Texto restante depois do último link
  if (ultimo < texto.length) {
    partes.push(<span key={chave++}>{texto.slice(ultimo)}</span>)
  }

  return <>{partes}</>
}