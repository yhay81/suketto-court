SELECT
  COUNT(DISTINCT CASE WHEN name = 'visited' THEN session_id END) AS users,
  COUNT(DISTINCT CASE WHEN name = 'listing_created' THEN session_id END) AS creators,
  COUNT(DISTINCT CASE WHEN name = 'listing_opened' THEN session_id END) AS openers,
  COUNT(DISTINCT CASE WHEN name = 'application_saved' THEN session_id END) AS applicants,
  COUNT(DISTINCT CASE WHEN name = 'application_accepted' THEN session_id END) AS accepted,
  COUNT(DISTINCT CASE WHEN name = 'listing_filled' THEN session_id END) AS filled_organizers,
  COUNT(DISTINCT CASE WHEN name = 'returned' THEN session_id END) AS returned,
  COUNT(DISTINCT CASE WHEN name = 'visited' AND created_at >= unixepoch() - (7 * 86400) THEN session_id END) AS users_7d,
  COUNT(DISTINCT CASE WHEN name = 'listing_created' AND created_at >= unixepoch() - (7 * 86400) THEN session_id END) AS creators_7d,
  COUNT(DISTINCT CASE WHEN name = 'application_saved' AND created_at >= unixepoch() - (7 * 86400) THEN session_id END) AS applicants_7d,
  (SELECT COUNT(*) FROM listings WHERE status IN ('open', 'full') AND starts_at > unixepoch()) AS future_listings,
  (SELECT COUNT(*) FROM applications WHERE status = 'pending') AS pending_applications,
  (SELECT COUNT(*) FROM applications WHERE status = 'accepted') AS accepted_applications
FROM product_events;
