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
      marks: {
        Row: {
          academic_year: string
          grade: number
          id: string
          score: number
          semester: number
          student_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          academic_year?: string
          grade: number
          id?: string
          score: number
          semester: number
          student_id: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          grade?: number
          id?: string
          score?: number
          semester?: number
          student_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      result_submissions: {
        Row: {
          academic_year: string
          admin_note: string
          grade: number
          id: string
          note: string
          reviewed_at: string | null
          section: string
          semester: number
          status: string
          submitted_at: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          academic_year: string
          admin_note?: string
          grade: number
          id?: string
          note?: string
          reviewed_at?: string | null
          section: string
          semester: number
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string
          admin_note?: string
          grade?: number
          id?: string
          note?: string
          reviewed_at?: string | null
          section?: string
          semester?: number
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      school_settings: {
        Row: {
          current_academic_year: string
          id: number
          pass_mark: number
          principal_name: string
          registrar_name: string
          school_name: string
          school_name_local: string
          updated_at: string
        }
        Insert: {
          current_academic_year?: string
          id?: number
          pass_mark?: number
          principal_name?: string
          registrar_name?: string
          school_name?: string
          school_name_local?: string
          updated_at?: string
        }
        Update: {
          current_academic_year?: string
          id?: number
          pass_mark?: number
          principal_name?: string
          registrar_name?: string
          school_name?: string
          school_name_local?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_logins: {
        Row: {
          password: string
          student_id: string
          updated_at: string
        }
        Insert: {
          password?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          password?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_logins_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          academic_year: string
          admission_date: string | null
          admission_number: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string
          gender: string
          grade: number
          id: string
          photo_path: string | null
          section: string
          status: string
          stream: string | null
          student_code: string
          updated_at: string
          verification_token: string
        }
        Insert: {
          academic_year?: string
          admission_date?: string | null
          admission_number?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          gender: string
          grade: number
          id?: string
          photo_path?: string | null
          section?: string
          status?: string
          stream?: string | null
          student_code: string
          updated_at?: string
          verification_token?: string
        }
        Update: {
          academic_year?: string
          admission_date?: string | null
          admission_number?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          gender?: string
          grade?: number
          id?: string
          photo_path?: string | null
          section?: string
          status?: string
          stream?: string | null
          student_code?: string
          updated_at?: string
          verification_token?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          grades: number[]
          id: string
          name: string
          sort_order: number
          streams: string[]
        }
        Insert: {
          code: string
          created_at?: string
          grades?: number[]
          id?: string
          name: string
          sort_order?: number
          streams?: string[]
        }
        Update: {
          code?: string
          created_at?: string
          grades?: number[]
          id?: string
          name?: string
          sort_order?: number
          streams?: string[]
        }
        Relationships: []
      }
      teacher_classes: {
        Row: {
          created_at: string
          grade: number
          id: string
          section: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          grade: number
          id?: string
          section: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          grade?: number
          id?: string
          section?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          phone?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cumulative_averages: {
        Args: never
        Returns: {
          cumulative_average: number
          student_id: string
          years_count: number
        }[]
      }
      gen_student_password: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_teacher_of: {
        Args: { _grade: number; _section: string; _user_id: string }
        Returns: boolean
      }
      teacher_can_mark: {
        Args: {
          _grade: number
          _semester: number
          _student_id: string
          _user_id: string
        }
        Returns: boolean
      }
      teacher_reads_marks: {
        Args: { _grade: number; _student_id: string; _user_id: string }
        Returns: boolean
      }
      verify_transcript: {
        Args: { _token: string }
        Returns: {
          cumulative_average: number
          full_name: string
          gender: string
          grades_covered: number[]
          school_name: string
          status: string
          stream: string
          student_code: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "registrar" | "teacher"
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
    Enums: {
      app_role: ["admin", "registrar", "teacher"],
    },
  },
} as const
