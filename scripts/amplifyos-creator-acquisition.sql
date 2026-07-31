WITH native AS (
  SELECT
    LOWER(REGEXP_REPLACE(BTRIM(tiktok_handle), '^@+', '')) AS handle,
    criado_em,
    origem,
    fase_atual,
    convite_status,
    agenciado_em
  FROM criadores
  WHERE NULLIF(BTRIM(tiktok_handle), '') IS NOT NULL
    AND origem IN ('Ads Meta', 'WhatsApp / Direto', 'Programa Indique e Ganhe')
), payload AS (
  SELECT json_agg(
    json_build_object(
      'h', handle,
      'createdAt', criado_em,
      'origin', origem,
      'phase', fase_atual,
      'status', convite_status,
      'convertedAt', agenciado_em
    ) ORDER BY criado_em ASC
  ) AS rows
  FROM native
)
SELECT json_build_object(
  'generatedAt', NOW(),
  'source', 'AmplifyOS.criadores native cutover',
  'coverage', json_build_object(
    'from', (SELECT MIN(criado_em) FROM native),
    'to', (SELECT MAX(criado_em) FROM native),
    'rows', (SELECT COUNT(*) FROM native),
    'uniqueHandles', (SELECT COUNT(DISTINCT handle) FROM native)
  ),
  'rows', COALESCE(payload.rows, '[]'::json)
)
FROM payload;
