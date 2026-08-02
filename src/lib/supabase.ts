import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('As variáveis de ambiente do Supabase (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY) não foram configuradas.');
}

// Cria a instância do cliente do Supabase
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Definição do tipo Profile para ser usado nos componentes (como o Header)
export type Profile = {
  id: string;
  nome?: string;
  email?: string;
  tipo?: string;
  created_at?: string;
  [key: string]: any; // Permite outras propriedades dinâmicas do banco se houverem
};

// Exporta das duas formas para evitar qualquer erro de importação nas páginas
export { supabase };
export default supabase;
