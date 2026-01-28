
import { createClient } from '@supabase/supabase-js';

// NOTA: Cuando subas esto a Vercel, estas variables se tomarán de las "Environment Variables".
// Por ahora, para que funcione en desarrollo local si no usas .env, el sistema intentará buscarlas,
// pero la forma correcta en Vercel es process.env.VITE_SUPABASE_URL

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Faltan las credenciales de Supabase. Asegúrate de configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Vercel.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
