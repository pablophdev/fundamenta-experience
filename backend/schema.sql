-- Execute once on the dedicated fundamenta-shared-visits project.
-- Expired ephemeral room data is purged when a new room is created.
CREATE TABLE IF NOT EXISTS shared_visits (
  id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{32}$'),
  state jsonb NOT NULL,
  author text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  CHECK (octet_length(state::text) <= 16384)
);

CREATE INDEX IF NOT EXISTS shared_visits_expiration ON shared_visits (expires_at);

CREATE TABLE IF NOT EXISTS visit_participants (
  visit_id text NOT NULL REFERENCES shared_visits (id) ON DELETE CASCADE,
  client_id text NOT NULL,
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_id, client_id)
);

CREATE OR REPLACE FUNCTION create_shared_visit(room_id text, client text, initial_state jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  result jsonb;
BEGIN
  -- Serialize room creation so simultaneous requests cannot exceed the global cap.
  PERFORM pg_advisory_xact_lock(483064120);
  DELETE FROM shared_visits WHERE expires_at <= now();
  IF (SELECT count(*) FROM shared_visits) >= 500 THEN
    RAISE EXCEPTION 'VISIT_CAPACITY';
  END IF;
  IF (SELECT count(*) FROM shared_visits WHERE created_at > now() - interval '1 minute') >= 30 THEN
    RAISE EXCEPTION 'VISIT_RATE_LIMIT';
  END IF;
  INSERT INTO shared_visits (id, state, author) VALUES (room_id, initial_state, client);
  INSERT INTO visit_participants (visit_id, client_id) VALUES (room_id, client);
  SELECT jsonb_build_object(
    'visitId', id, 'version', version, 'state', state, 'author', author,
    'participantCount', 1, 'expiresAt', expires_at
  ) INTO result FROM shared_visits WHERE id = room_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION sync_shared_visit(room_id text, client text, next_state jsonb, has_state boolean)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  visit shared_visits%ROWTYPE;
  active_count integer;
BEGIN
  SELECT * INTO visit FROM shared_visits WHERE id = room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VISIT_NOT_FOUND'; END IF;
  IF visit.expires_at <= now() THEN RAISE EXCEPTION 'VISIT_EXPIRED'; END IF;

  DELETE FROM visit_participants WHERE visit_id = room_id AND last_seen < now() - interval '2 minutes';
  SELECT count(*) INTO active_count FROM visit_participants
    WHERE visit_id = room_id AND last_seen > now() - interval '20 seconds' AND client_id <> client;
  IF active_count >= 6 THEN RAISE EXCEPTION 'VISIT_FULL'; END IF;
  INSERT INTO visit_participants (visit_id, client_id, last_seen) VALUES (room_id, client, now())
    ON CONFLICT (visit_id, client_id) DO UPDATE SET last_seen = excluded.last_seen;

  -- Last committed edit wins. Heartbeats do not replace or increment the state.
  IF has_state AND (visit.state IS DISTINCT FROM next_state) THEN
    UPDATE shared_visits SET state = next_state, author = client, version = version + 1
      WHERE id = room_id RETURNING * INTO visit;
  END IF;
  RETURN jsonb_build_object(
    'visitId', visit.id, 'version', visit.version, 'state', visit.state,
    'author', visit.author, 'participantCount', active_count + 1, 'expiresAt', visit.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION leave_shared_visit(room_id text, client text)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM visit_participants WHERE visit_id = room_id AND client_id = client;
  RETURN jsonb_build_object('ok', true);
END;
$$;
