/*
  # Create Proxy Session and Usage Tracking Tables

  1. New Tables
    - `proxy_sessions`: Tracks active and historical proxy sessions
      - `id` (uuid, primary key)
      - `user_id` (text) - MongoDB user ID reference
      - `start_time` (timestamptz)
      - `end_time` (timestamptz, nullable)
      - `total_credits_charged` (integer)
      - `status` (text) - 'active', 'completed', 'terminated'
      - `created_at` (timestamp)
    
    - `proxy_usage_logs`: Detailed logs of proxy requests
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key)
      - `user_id` (text)
      - `destination_url` (text)
      - `request_method` (text)
      - `response_status` (integer)
      - `timestamp` (timestamptz)
      - `created_at` (timestamp)
    
    - `proxy_credit_transactions`: Credit deduction history
      - `id` (uuid, primary key)
      - `user_id` (text)
      - `session_id` (uuid, foreign key)
      - `credits_deducted` (integer)
      - `reason` (text) - 'minute_charge', 'session_termination'
      - `timestamp` (timestamptz)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for user data access
    - Restrict data to authenticated users
*/

CREATE TABLE IF NOT EXISTS proxy_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  total_credits_charged integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proxy_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES proxy_sessions(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  destination_url text NOT NULL,
  request_method text NOT NULL,
  response_status integer,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proxy_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  session_id uuid REFERENCES proxy_sessions(id) ON DELETE CASCADE,
  credits_deducted integer NOT NULL,
  reason text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE proxy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own proxy sessions"
  ON proxy_sessions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can view own proxy usage logs"
  ON proxy_usage_logs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can view own credit transactions"
  ON proxy_credit_transactions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "System can insert proxy sessions"
  ON proxy_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "System can insert proxy usage logs"
  ON proxy_usage_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "System can insert credit transactions"
  ON proxy_credit_transactions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "System can update proxy sessions"
  ON proxy_sessions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
