# Security

Report vulnerabilities privately through GitHub private vulnerability reporting.

- Organizer and applicant capabilities contain 256 random bits and are stored as SHA-256 hashes.
- Capabilities stay in URL fragments and are sent in dedicated request headers only.
- Public APIs never return browser session IDs, token hashes, applicant notes, or join instructions.
- Accepted join instructions are private and rendered as text, never executable HTML.
- Venue URLs must be public HTTPS URLs without credentials, private IP literals, or internal hostnames.
- Listings are limited per browser and day; applications are limited per listing and browser.
- Three independent reports hide a listing.
- Cross-site writes, oversized payloads, unknown enums, control characters, and explicit automation are rejected or excluded.
- CSP, frame denial, HSTS, no-sniff, referrer policy, and no-store/noindex headers protect private pages.
