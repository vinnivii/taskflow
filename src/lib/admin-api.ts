import { supabase } from "@/utils/supabase";

export async function invokeAdmin<T>(name: string, body: object): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
      const response = error.context;
      if (response instanceof Response) {
        const result = await response.json().catch(() => null);
        if (typeof result?.error === "string") return { data: null, error: result.error };
      }
      return { data: null, error: "Não foi possível concluir a operação. Verifique a conexão e a configuração do servidor." };
    }
    return { data: data as T, error: null };
  } catch {
    return { data: null, error: "Não foi possível concluir a operação. Tente novamente." };
  }
}
