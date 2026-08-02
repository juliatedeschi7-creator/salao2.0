import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('As variáveis de ambiente do Supabase (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY) não foram configuradas.');
}

// Cria a instância do cliente do Supabase
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Exporta das duas formas para evitar qualquer erro de importação nas suas páginas
export { supabase };
export default supabase;
