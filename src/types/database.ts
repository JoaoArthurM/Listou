// Gerado a partir do projeto Supabase (supabase gen types). Não editar à mão:
// depois de mudar o esquema, gere de novo e substitua o arquivo.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      convites: {
        Row: {
          codigo: string
          criado_em: string
          criado_por: string
          expira_em: string
          lista_id: string
        }
        Insert: {
          codigo: string
          criado_em?: string
          criado_por: string
          expira_em?: string
          lista_id: string
        }
        Update: {
          codigo?: string
          criado_em?: string
          criado_por?: string
          expira_em?: string
          lista_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "convites_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "listas"
            referencedColumns: ["id"]
          },
        ]
      }
      itens: {
        Row: {
          adicionado_por: string | null
          comprado: boolean
          comprado_em: string | null
          comprado_por: string | null
          criado_em: string
          faixa_aplicada: string | null
          faixas_preco: Json | null
          foto_path: string | null
          id: string
          lista_id: string
          nome: string
          origem_preco: string | null
          preco_unit_centavos: number | null
          qtd_comprada: number | null
          qtd_planejada: number | null
          total_centavos: number | null
          unidade: string
        }
        Insert: {
          adicionado_por?: string | null
          comprado?: boolean
          comprado_em?: string | null
          comprado_por?: string | null
          criado_em?: string
          faixa_aplicada?: string | null
          faixas_preco?: Json | null
          foto_path?: string | null
          id?: string
          lista_id: string
          nome: string
          origem_preco?: string | null
          preco_unit_centavos?: number | null
          qtd_comprada?: number | null
          qtd_planejada?: number | null
          total_centavos?: number | null
          unidade?: string
        }
        Update: {
          adicionado_por?: string | null
          comprado?: boolean
          comprado_em?: string | null
          comprado_por?: string | null
          criado_em?: string
          faixa_aplicada?: string | null
          faixas_preco?: Json | null
          foto_path?: string | null
          id?: string
          lista_id?: string
          nome?: string
          origem_preco?: string | null
          preco_unit_centavos?: number | null
          qtd_comprada?: number | null
          qtd_planejada?: number | null
          total_centavos?: number | null
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_adicionado_por_fkey"
            columns: ["adicionado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_comprado_por_fkey"
            columns: ["comprado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "listas"
            referencedColumns: ["id"]
          },
        ]
      }
      lista_membros: {
        Row: {
          lista_id: string
          papel: string
          perfil_id: string
        }
        Insert: {
          lista_id: string
          papel?: string
          perfil_id: string
        }
        Update: {
          lista_id?: string
          papel?: string
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lista_membros_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "listas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_membros_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      listas: {
        Row: {
          cartoes: string[]
          cartoes_recusados: string[]
          criado_em: string
          criado_por: string
          finalizada_em: string | null
          id: string
          mercado: string | null
          nome: string
          orcamento_centavos: number | null
          status: string
        }
        Insert: {
          cartoes?: string[]
          cartoes_recusados?: string[]
          criado_em?: string
          criado_por?: string
          finalizada_em?: string | null
          id?: string
          mercado?: string | null
          nome: string
          orcamento_centavos?: number | null
          status?: string
        }
        Update: {
          cartoes?: string[]
          cartoes_recusados?: string[]
          criado_em?: string
          criado_por?: string
          finalizada_em?: string | null
          id?: string
          mercado?: string | null
          nome?: string
          orcamento_centavos?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "listas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          autor_id: string | null
          conteudo: string
          criado_em: string
          dados: Json | null
          id: string
          item_id: string | null
          lista_id: string
          papel: string
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          conteudo: string
          criado_em?: string
          dados?: Json | null
          id?: string
          item_id?: string | null
          lista_id: string
          papel: string
          tipo?: string
        }
        Update: {
          autor_id?: string | null
          conteudo?: string
          criado_em?: string
          dados?: Json | null
          id?: string
          item_id?: string | null
          lista_id?: string
          papel?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "listas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          criado_em?: string
          id: string
          nome: string
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      uso_ia: {
        Row: {
          criado_em: string
          funcao: string
          id: number
          lista_id: string | null
          modelo: string | null
          tokens_entrada: number
          tokens_saida: number
        }
        Insert: {
          criado_em?: string
          funcao: string
          id?: never
          lista_id?: string | null
          modelo?: string | null
          tokens_entrada?: number
          tokens_saida?: number
        }
        Update: {
          criado_em?: string
          funcao?: string
          id?: never
          lista_id?: string | null
          modelo?: string | null
          tokens_entrada?: number
          tokens_saida?: number
        }
        Relationships: [
          {
            foreignKeyName: "uso_ia_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "listas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      lista_totais: {
        Row: {
          itens_comprados: number | null
          itens_total: number | null
          lista_id: string | null
          total_centavos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "itens_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "listas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aceitar_convite: { Args: { p_codigo: string }; Returns: string }
      criar_convite: { Args: { p_lista_id: string }; Returns: string }
      responder_cartao: {
        Args: { p_cartao: string; p_lista_id: string; p_tem: boolean }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
