-- ============================================================
-- Query di debug — flusso comande multi-corso (MySQL)
-- Sostituire :restaurant_id con il tenant reale (VARCHAR).
-- ============================================================

-- 1) Ultimi ordini creati (sostituire LIMIT)
SELECT
  id,
  table_num,
  status,
  created_at,
  updated_at,
  extra
FROM orders
WHERE restaurant_id = :restaurant_id
ORDER BY created_at DESC
LIMIT 30;

-- 2) Ordine specifico + extra (activeCourse, ecc.)
SELECT
  id,
  table_num,
  covers,
  area,
  waiter,
  status,
  created_at,
  updated_at,
  JSON_PRETTY(extra) AS extra_pretty
FROM orders
WHERE restaurant_id = :restaurant_id
  AND id = :order_id;

-- 3) Righe ordine con numero corso da extra JSON
-- (campo course serializzato in extra come da repository)
SELECT
  line_index,
  name,
  qty,
  JSON_UNQUOTE(JSON_EXTRACT(extra, '$.course')) AS course_from_extra,
  extra
FROM order_items
WHERE restaurant_id = :restaurant_id
  AND order_id = :order_id
ORDER BY line_index;

-- 4) activeCourse dall'extra ordine (se presente)
SELECT
  id,
  table_num,
  status,
  JSON_UNQUOTE(JSON_EXTRACT(extra, '$.activeCourse')) AS active_course_from_extra,
  extra
FROM orders
WHERE restaurant_id = :restaurant_id
  AND id = :order_id;

-- 5) max_course calcolato dalle righe (come getMaxCourseFromOrder)
SELECT
  COALESCE(MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(extra, '$.course')) AS UNSIGNED)), 1) AS max_course_computed
FROM order_items
WHERE restaurant_id = :restaurant_id
  AND order_id = :order_id;

-- 6) “Servito” chiude tutto? — confronta activeCourse con maxCourse
-- Se activeCourse >= max_course e status = 'servito', il backend ha considerato ultimo corso.
SELECT
  o.id,
  o.table_num,
  o.status,
  CAST(JSON_UNQUOTE(JSON_EXTRACT(o.extra, '$.activeCourse')) AS UNSIGNED) AS active_course,
  (
    SELECT COALESCE(MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.extra, '$.course')) AS UNSIGNED)), 1)
    FROM order_items oi
    WHERE oi.restaurant_id = o.restaurant_id AND oi.order_id = o.id
  ) AS max_course
FROM orders o
WHERE o.restaurant_id = :restaurant_id
  AND o.id = :order_id;

-- 7) Esiste prossimo corso? (activeCourse < max_course)
-- Risultato atteso: 1 righe se c'è ancora un corso dopo quello attivo
SELECT
  CASE
    WHEN CAST(JSON_UNQUOTE(JSON_EXTRACT(o.extra, '$.activeCourse')) AS UNSIGNED) <
         (
           SELECT COALESCE(MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.extra, '$.course')) AS UNSIGNED)), 1)
           FROM order_items oi
           WHERE oi.restaurant_id = o.restaurant_id AND oi.order_id = o.id
         )
    THEN 'yes_next_course_exists'
    ELSE 'no_last_or_equal'
  END AS next_course_hint
FROM orders o
WHERE o.restaurant_id = :restaurant_id
  AND o.id = :order_id;

-- 8) Verifica distribuzione corsi sulle righe (tutti corso 1?)
SELECT
  CAST(JSON_UNQUOTE(JSON_EXTRACT(extra, '$.course')) AS UNSIGNED) AS course_num,
  COUNT(*) AS line_count
FROM order_items
WHERE restaurant_id = :restaurant_id
  AND order_id = :order_id
GROUP BY course_num
ORDER BY course_num;

-- 9) Ordini recenti multi-corso (max_course > 1)
SELECT
  o.id,
  o.table_num,
  o.status,
  CAST(JSON_UNQUOTE(JSON_EXTRACT(o.extra, '$.activeCourse')) AS UNSIGNED) AS active_course,
  (
    SELECT COALESCE(MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.extra, '$.course')) AS UNSIGNED)), 1)
    FROM order_items oi
    WHERE oi.restaurant_id = o.restaurant_id AND oi.order_id = o.id
  ) AS max_course
FROM orders o
WHERE o.restaurant_id = :restaurant_id
  AND o.created_at >= NOW() - INTERVAL 2 DAY
  AND (
    SELECT COALESCE(MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi2.extra, '$.course')) AS UNSIGNED)), 1)
    FROM order_items oi2
    WHERE oi2.restaurant_id = o.restaurant_id AND oi2.order_id = o.id
  ) > 1
ORDER BY o.created_at DESC;

-- 10) Stato “cucina” — ordini attivi non serviti/chiusi (simile a listActiveOrders)
SELECT id, table_num, status, created_at
FROM orders
WHERE restaurant_id = :restaurant_id
  AND LOWER(status) NOT IN ('chiuso', 'annullato', 'closed', 'cancelled', 'archived', 'pagato', 'paid')
ORDER BY created_at DESC
LIMIT 50;
