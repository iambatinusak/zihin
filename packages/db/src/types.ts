/**
 * OTOMATİK ÜRETİLDİ — elle düzenlemeyin.
 *
 * Üretim komutu:  pnpm --filter @zihin/db db:types
 * Kaynak:         supabase/migrations/*.sql
 *
 * Şema değiştiğinde bu dosyayı yeniden üretin; aksi hâlde uygulama
 * kodu var olmayan kolonlara tip güvenliğiyle erişiyormuş gibi görünür.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      attempts: {
        Row: {
          id: string
          user_id: string
          question_id: string
          topic_id: string
          test_session_id: string | null
          source:
            | 'topic_test'
            | 'unit_test'
            | 'quick_practice'
            | 'mock_exam'
            | 'video_checkpoint'
            | 'flashcard'
          selected_option: string | null
          is_correct: boolean
          time_spent_ms: number
          answered_at: string
          repeat_index: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          question_id: string
          topic_id: string
          test_session_id?: string | null
          source:
            | 'topic_test'
            | 'unit_test'
            | 'quick_practice'
            | 'mock_exam'
            | 'video_checkpoint'
            | 'flashcard'
          selected_option?: string | null
          is_correct?: boolean
          time_spent_ms?: number
          answered_at?: string
          repeat_index?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          question_id?: string
          topic_id?: string
          test_session_id?: string | null
          source?:
            | 'topic_test'
            | 'unit_test'
            | 'quick_practice'
            | 'mock_exam'
            | 'video_checkpoint'
            | 'flashcard'
          selected_option?: string | null
          is_correct?: boolean
          time_spent_ms?: number
          answered_at?: string
          repeat_index?: number
          created_at?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          id: string
          code: string
          name: string
          description: string | null
          icon: string | null
          rule: Json
          order_index: number
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          description?: string | null
          icon?: string | null
          rule?: Json
          order_index?: number
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          description?: string | null
          icon?: string | null
          rule?: Json
          order_index?: number
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookmarked_questions: {
        Row: {
          user_id: string
          question_id: string
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          question_id: string
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          question_id?: string
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      card_reviews: {
        Row: {
          user_id: string
          flashcard_id: string
          ease_factor: number
          interval_days: number
          repetitions: number
          next_review_at: string
          last_grade: number | null
          last_reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          flashcard_id: string
          ease_factor?: number
          interval_days?: number
          repetitions?: number
          next_review_at?: string
          last_grade?: number | null
          last_reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          flashcard_id?: string
          ease_factor?: number
          interval_days?: number
          repetitions?: number
          next_review_at?: string
          last_grade?: number | null
          last_reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_activity: {
        Row: {
          user_id: string
          date: string
          study_seconds: number
          videos_completed: number
          questions_answered: number
          cards_reviewed: number
          blocks_completed: number
          xp_earned: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          date: string
          study_seconds?: number
          videos_completed?: number
          questions_answered?: number
          cards_reviewed?: number
          blocks_completed?: number
          xp_earned?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          date?: string
          study_seconds?: number
          videos_completed?: number
          questions_answered?: number
          cards_reviewed?: number
          blocks_completed?: number
          xp_earned?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      exams: {
        Row: {
          id: string
          code: string
          name: string
          description: string | null
          wrong_penalty_divisor: number
          default_exam_date: string | null
          total_questions: number | null
          duration_minutes: number | null
          order_index: number
          is_active: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          description?: string | null
          wrong_penalty_divisor?: number
          default_exam_date?: string | null
          total_questions?: number | null
          duration_minutes?: number | null
          order_index?: number
          is_active?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          description?: string | null
          wrong_penalty_divisor?: number
          default_exam_date?: string | null
          total_questions?: number | null
          duration_minutes?: number | null
          order_index?: number
          is_active?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          id: string
          topic_id: string
          front: string
          back: string
          image_url: string | null
          auto_generated: boolean
          source_question_id: string | null
          created_by: string | null
          is_published: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          topic_id: string
          front: string
          back: string
          image_url?: string | null
          auto_generated?: boolean
          source_question_id?: string | null
          created_by?: string | null
          is_published?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          topic_id?: string
          front?: string
          back?: string
          image_url?: string | null
          auto_generated?: boolean
          source_question_id?: string | null
          created_by?: string | null
          is_published?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      help_messages: {
        Row: {
          id: string
          request_id: string
          sender_id: string
          body: string | null
          image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          request_id: string
          sender_id: string
          body?: string | null
          image_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          sender_id?: string
          body?: string | null
          image_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      help_requests: {
        Row: {
          id: string
          student_id: string
          subject_id: string | null
          topic_id: string | null
          body: string | null
          image_url: string | null
          status: 'open' | 'answered' | 'closed'
          assigned_teacher_id: string | null
          matched_question_ids: string[]
          answered_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          subject_id?: string | null
          topic_id?: string | null
          body?: string | null
          image_url?: string | null
          status?: 'open' | 'answered' | 'closed'
          assigned_teacher_id?: string | null
          matched_question_ids?: string[]
          answered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          subject_id?: string | null
          topic_id?: string | null
          body?: string | null
          image_url?: string | null
          status?: 'open' | 'answered' | 'closed'
          assigned_teacher_id?: string | null
          matched_question_ids?: string[]
          answered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          id: string
          job_name: string
          started_at: string
          finished_at: string | null
          status: 'running' | 'success' | 'error'
          affected_rows: number | null
          error_message: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          job_name: string
          started_at?: string
          finished_at?: string | null
          status?: 'running' | 'success' | 'error'
          affected_rows?: number | null
          error_message?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          job_name?: string
          started_at?: string
          finished_at?: string | null
          status?: 'running' | 'success' | 'error'
          affected_rows?: number | null
          error_message?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
      mastery_history: {
        Row: {
          id: string
          user_id: string
          topic_id: string
          mastery: number
          recorded_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          topic_id: string
          mastery: number
          recorded_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          topic_id?: string
          mastery?: number
          recorded_at?: string
          created_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type:
            | 'review_due'
            | 'plan_reminder'
            | 'help_answered'
            | 'weekly_summary'
            | 'subscription_ending'
            | 'badge_earned'
            | 'mock_published'
          title: string
          body: string | null
          link: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type:
            | 'review_due'
            | 'plan_reminder'
            | 'help_answered'
            | 'weekly_summary'
            | 'subscription_ending'
            | 'badge_earned'
            | 'mock_published'
          title: string
          body?: string | null
          link?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?:
            | 'review_due'
            | 'plan_reminder'
            | 'help_answered'
            | 'weekly_summary'
            | 'subscription_ending'
            | 'badge_earned'
            | 'mock_published'
          title?: string
          body?: string | null
          link?: string | null
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      outcomes: {
        Row: {
          id: string
          topic_id: string
          code: string
          description: string
          order_index: number
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          topic_id: string
          code: string
          description: string
          order_index?: number
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          topic_id?: string
          code?: string
          description?: string
          order_index?: number
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          id: string
          exam_id: string | null
          name: string
          description: string | null
          duration_days: number
          price_try: number
          features: Json
          order_index: number
          is_active: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          exam_id?: string | null
          name: string
          description?: string | null
          duration_days: number
          price_try: number
          features?: Json
          order_index?: number
          is_active?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          exam_id?: string | null
          name?: string
          description?: string | null
          duration_days?: number
          price_try?: number
          features?: Json
          order_index?: number
          is_active?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      parent_links: {
        Row: {
          parent_id: string
          student_id: string
          status: 'active' | 'revoked'
          created_at: string
          updated_at: string
        }
        Insert: {
          parent_id: string
          student_id: string
          status?: 'active' | 'revoked'
          created_at?: string
          updated_at?: string
        }
        Update: {
          parent_id?: string
          student_id?: string
          status?: 'active' | 'revoked'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          user_id: string
          package_id: string | null
          amount: number
          currency: string
          provider: 'iyzico' | 'manual' | 'mock'
          provider_ref: string | null
          status: 'pending' | 'success' | 'failed' | 'refunded'
          raw: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          package_id?: string | null
          amount: number
          currency?: string
          provider?: 'iyzico' | 'manual' | 'mock'
          provider_ref?: string | null
          status?: 'pending' | 'success' | 'failed' | 'refunded'
          raw?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          package_id?: string | null
          amount?: number
          currency?: string
          provider?: 'iyzico' | 'manual' | 'mock'
          provider_ref?: string | null
          status?: 'pending' | 'success' | 'failed' | 'refunded'
          raw?: Json
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          role: 'student' | 'parent' | 'teacher' | 'editor' | 'admin'
          full_name: string | null
          display_name: string | null
          avatar_url: string | null
          grade: '8' | '9' | '10' | '11' | '12' | 'mezun' | 'yetiskin' | null
          exam_id: string | null
          target_exam_date: string | null
          daily_minutes: number
          study_days: number[]
          invite_code: string | null
          onboarding_completed: boolean
          onboarding_step: number
          leaderboard_opt_in: boolean
          notification_prefs: Json
          xp: number
          level: number
          current_streak: number
          longest_streak: number
          last_study_date: string | null
          suspended_at: string | null
          kvkk_consent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: 'student' | 'parent' | 'teacher' | 'editor' | 'admin'
          full_name?: string | null
          display_name?: string | null
          avatar_url?: string | null
          grade?: '8' | '9' | '10' | '11' | '12' | 'mezun' | 'yetiskin' | null
          exam_id?: string | null
          target_exam_date?: string | null
          daily_minutes?: number
          study_days?: number[]
          invite_code?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          leaderboard_opt_in?: boolean
          notification_prefs?: Json
          xp?: number
          level?: number
          current_streak?: number
          longest_streak?: number
          last_study_date?: string | null
          suspended_at?: string | null
          kvkk_consent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: 'student' | 'parent' | 'teacher' | 'editor' | 'admin'
          full_name?: string | null
          display_name?: string | null
          avatar_url?: string | null
          grade?: '8' | '9' | '10' | '11' | '12' | 'mezun' | 'yetiskin' | null
          exam_id?: string | null
          target_exam_date?: string | null
          daily_minutes?: number
          study_days?: number[]
          invite_code?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          leaderboard_opt_in?: boolean
          notification_prefs?: Json
          xp?: number
          level?: number
          current_streak?: number
          longest_streak?: number
          last_study_date?: string | null
          suspended_at?: string | null
          kvkk_consent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          id: string
          topic_id: string
          outcome_id: string | null
          type: 'multiple_choice' | 'true_false' | 'fill_blank'
          stem: string
          options: Json
          correct_option: string
          explanation: string | null
          solution_video_url: string | null
          image_url: string | null
          difficulty: number
          expected_seconds: number | null
          tags: string[]
          source: 'original' | 'exam_style'
          is_published: boolean
          search_vector: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          topic_id: string
          outcome_id?: string | null
          type?: 'multiple_choice' | 'true_false' | 'fill_blank'
          stem: string
          options?: Json
          correct_option: string
          explanation?: string | null
          solution_video_url?: string | null
          image_url?: string | null
          difficulty?: number
          expected_seconds?: number | null
          tags?: string[]
          source?: 'original' | 'exam_style'
          is_published?: boolean
          search_vector?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          topic_id?: string
          outcome_id?: string | null
          type?: 'multiple_choice' | 'true_false' | 'fill_blank'
          stem?: string
          options?: Json
          correct_option?: string
          explanation?: string | null
          solution_video_url?: string | null
          image_url?: string | null
          difficulty?: number
          expected_seconds?: number | null
          tags?: string[]
          source?: 'original' | 'exam_style'
          is_published?: boolean
          search_vector?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      study_blocks: {
        Row: {
          id: string
          plan_id: string
          user_id: string
          scheduled_date: string
          order_index: number
          type: 'watch' | 'solve' | 'review' | 'mock'
          topic_id: string | null
          video_id: string | null
          test_id: string | null
          title: string
          estimated_minutes: number
          completed_at: string | null
          moved_from_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          user_id: string
          scheduled_date: string
          order_index?: number
          type: 'watch' | 'solve' | 'review' | 'mock'
          topic_id?: string | null
          video_id?: string | null
          test_id?: string | null
          title: string
          estimated_minutes?: number
          completed_at?: string | null
          moved_from_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          user_id?: string
          scheduled_date?: string
          order_index?: number
          type?: 'watch' | 'solve' | 'review' | 'mock'
          topic_id?: string | null
          video_id?: string | null
          test_id?: string | null
          title?: string
          estimated_minutes?: number
          completed_at?: string | null
          moved_from_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      study_plans: {
        Row: {
          id: string
          user_id: string
          generated_at: string
          week_start: string
          is_active: boolean
          template: 'balanced' | 'video_only' | 'test_only' | 'last_30_days'
          warnings: string[]
          stats: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          generated_at?: string
          week_start: string
          is_active?: boolean
          template?: 'balanced' | 'video_only' | 'test_only' | 'last_30_days'
          warnings?: string[]
          stats?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          generated_at?: string
          week_start?: string
          is_active?: boolean
          template?: 'balanced' | 'video_only' | 'test_only' | 'last_30_days'
          warnings?: string[]
          stats?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          id: string
          exam_id: string
          name: string
          slug: string
          order_index: number
          color: string | null
          question_count: number | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          exam_id: string
          name: string
          slug: string
          order_index?: number
          color?: string | null
          question_count?: number | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          exam_id?: string
          name?: string
          slug?: string
          order_index?: number
          color?: string | null
          question_count?: number | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          package_id: string
          starts_at: string
          ends_at: string
          status: 'active' | 'expired' | 'cancelled' | 'pending'
          source: 'iyzico' | 'manual'
          payment_ref: string | null
          cancelled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          package_id: string
          starts_at?: string
          ends_at: string
          status?: 'active' | 'expired' | 'cancelled' | 'pending'
          source?: 'iyzico' | 'manual'
          payment_ref?: string | null
          cancelled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          package_id?: string
          starts_at?: string
          ends_at?: string
          status?: 'active' | 'expired' | 'cancelled' | 'pending'
          source?: 'iyzico' | 'manual'
          payment_ref?: string | null
          cancelled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_assignments: {
        Row: {
          teacher_id: string
          student_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          teacher_id: string
          student_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          teacher_id?: string
          student_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      test_questions: {
        Row: {
          test_id: string
          question_id: string
          order_index: number
          section: string | null
          created_at: string
        }
        Insert: {
          test_id: string
          question_id: string
          order_index?: number
          section?: string | null
          created_at?: string
        }
        Update: {
          test_id?: string
          question_id?: string
          order_index?: number
          section?: string | null
          created_at?: string
        }
        Relationships: []
      }
      test_sessions: {
        Row: {
          id: string
          user_id: string
          test_id: string
          started_at: string
          finished_at: string | null
          question_order: string[]
          summary: Json | null
          percentile: number | null
          expires_at: string
          is_placement: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          test_id: string
          started_at?: string
          finished_at?: string | null
          question_order?: string[]
          summary?: Json | null
          percentile?: number | null
          expires_at?: string
          is_placement?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          test_id?: string
          started_at?: string
          finished_at?: string | null
          question_order?: string[]
          summary?: Json | null
          percentile?: number | null
          expires_at?: string
          is_placement?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tests: {
        Row: {
          id: string
          type: 'topic_test' | 'unit_test' | 'quick_practice' | 'mock_exam'
          title: string
          exam_id: string | null
          subject_id: string | null
          unit_id: string | null
          topic_id: string | null
          duration_seconds: number | null
          is_published: boolean
          publish_at: string | null
          live_window_start: string | null
          live_window_end: string | null
          config: Json
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: 'topic_test' | 'unit_test' | 'quick_practice' | 'mock_exam'
          title: string
          exam_id?: string | null
          subject_id?: string | null
          unit_id?: string | null
          topic_id?: string | null
          duration_seconds?: number | null
          is_published?: boolean
          publish_at?: string | null
          live_window_start?: string | null
          live_window_end?: string | null
          config?: Json
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: 'topic_test' | 'unit_test' | 'quick_practice' | 'mock_exam'
          title?: string
          exam_id?: string | null
          subject_id?: string | null
          unit_id?: string | null
          topic_id?: string | null
          duration_seconds?: number | null
          is_published?: boolean
          publish_at?: string | null
          live_window_start?: string | null
          live_window_end?: string | null
          config?: Json
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      topic_mastery: {
        Row: {
          user_id: string
          topic_id: string
          mastery: number
          status: 'unknown' | 'weak' | 'medium' | 'strong'
          attempts_count: number
          last_calculated_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          topic_id: string
          mastery?: number
          status?: 'unknown' | 'weak' | 'medium' | 'strong'
          attempts_count?: number
          last_calculated_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          topic_id?: string
          mastery?: number
          status?: 'unknown' | 'weak' | 'medium' | 'strong'
          attempts_count?: number
          last_calculated_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          id: string
          unit_id: string
          title: string
          slug: string
          order_index: number
          estimated_minutes: number
          difficulty: number
          exam_weight: number
          memory_note: string | null
          memory_image_url: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          unit_id: string
          title: string
          slug: string
          order_index?: number
          estimated_minutes?: number
          difficulty?: number
          exam_weight?: number
          memory_note?: string | null
          memory_image_url?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          unit_id?: string
          title?: string
          slug?: string
          order_index?: number
          estimated_minutes?: number
          difficulty?: number
          exam_weight?: number
          memory_note?: string | null
          memory_image_url?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          id: string
          subject_id: string
          name: string
          slug: string
          order_index: number
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          subject_id: string
          name: string
          slug: string
          order_index?: number
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          subject_id?: string
          name?: string
          slug?: string
          order_index?: number
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          user_id: string
          badge_id: string
          earned_at: string
          created_at: string
        }
        Insert: {
          user_id: string
          badge_id: string
          earned_at?: string
          created_at?: string
        }
        Update: {
          user_id?: string
          badge_id?: string
          earned_at?: string
          created_at?: string
        }
        Relationships: []
      }
      video_checkpoints: {
        Row: {
          id: string
          video_id: string
          question_id: string
          timestamp_seconds: number
          order_index: number
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          video_id: string
          question_id: string
          timestamp_seconds: number
          order_index?: number
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          video_id?: string
          question_id?: string
          timestamp_seconds?: number
          order_index?: number
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      video_notes: {
        Row: {
          id: string
          user_id: string
          video_id: string
          timestamp_seconds: number
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          video_id: string
          timestamp_seconds: number
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          video_id?: string
          timestamp_seconds?: number
          body?: string
          created_at?: string
        }
        Relationships: []
      }
      video_progress: {
        Row: {
          user_id: string
          video_id: string
          last_position_seconds: number
          watch_time_seconds: number
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          video_id: string
          last_position_seconds?: number
          watch_time_seconds?: number
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          video_id?: string
          last_position_seconds?: number
          watch_time_seconds?: number
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          id: string
          topic_id: string
          title: string
          type: 'lecture' | 'solution' | 'summary'
          provider: 'supabase' | 'bunny'
          provider_video_id: string | null
          storage_path: string | null
          duration_seconds: number
          thumbnail_url: string | null
          order_index: number
          is_free_preview: boolean
          is_published: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          topic_id: string
          title: string
          type?: 'lecture' | 'solution' | 'summary'
          provider?: 'supabase' | 'bunny'
          provider_video_id?: string | null
          storage_path?: string | null
          duration_seconds?: number
          thumbnail_url?: string | null
          order_index?: number
          is_free_preview?: boolean
          is_published?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          topic_id?: string
          title?: string
          type?: 'lecture' | 'solution' | 'summary'
          provider?: 'supabase' | 'bunny'
          provider_video_id?: string | null
          storage_path?: string | null
          duration_seconds?: number
          thumbnail_url?: string | null
          order_index?: number
          is_free_preview?: boolean
          is_published?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          id: string
          user_id: string
          amount: number
          reason:
            | 'video_completed'
            | 'test_completed'
            | 'correct_answer'
            | 'card_reviewed'
            | 'block_completed'
            | 'mock_completed'
            | 'placement_completed'
          ref_type: string | null
          ref_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          reason:
            | 'video_completed'
            | 'test_completed'
            | 'correct_answer'
            | 'card_reviewed'
            | 'block_completed'
            | 'mock_completed'
            | 'placement_completed'
          ref_type?: string | null
          ref_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          reason?:
            | 'video_completed'
            | 'test_completed'
            | 'correct_answer'
            | 'card_reviewed'
            | 'block_completed'
            | 'mock_completed'
            | 'placement_completed'
          ref_type?: string | null
          ref_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      questions_public: {
        Row: {
          id: string | null
          topic_id: string | null
          outcome_id: string | null
          type: string | null
          stem: string | null
          options: Json | null
          image_url: string | null
          difficulty: number | null
          expected_seconds: number | null
          tags: string[] | null
          source: string | null
          is_published: boolean | null
          created_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auth_role: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      can_read_student_data: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      enforce_help_message_limit: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      enforce_parent_link_limit: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      generate_invite_code: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      handle_new_user: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      has_active_subscription: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      is_admin: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      is_assigned_teacher: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      is_editor: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      is_linked_parent: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      is_student: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      is_teacher: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      owns_test_session: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      protect_profile_fields: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      questions_search_vector_update: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      set_updated_at: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      tr_today: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      validate_question_options: {
        Args: Record<string, unknown>
        Returns: unknown
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

/** Tablo satır tipi kısayolu:  Tables<'profiles'> */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
/** Ekleme tipi kısayolu. */
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
/** Güncelleme tipi kısayolu. */
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
/** Görünüm satır tipi kısayolu. */
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']
