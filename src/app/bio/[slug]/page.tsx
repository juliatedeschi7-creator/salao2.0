// src/app/bio/[slug]/page.tsx
// Página pública de bio link — acessível em /bio/maria-magnolia
import { createClient } from '@supabase/supabase-js'
import BioLinkClient from './BioLinkClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function BioLinkPage({ params }: { params: { slug: string } }) {
  const { data: salao } = await supabase
    .from('saloes')
    .select('id, nome, slug, cor_primaria, cor_secundaria, descricao, logo_url, instagram, telefone')
    .eq('slug', params.slug)
    .single()

  if (!salao) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Salão não encontrado.</p>
      </div>
    )
  }

  return <BioLinkClient salao={salao} />
}
