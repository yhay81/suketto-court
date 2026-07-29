# Metrics

Events are deduplicated per browser, event, context, and JST day and retained for 45 days.

| Event                  | Meaning                                     |
| ---------------------- | ------------------------------------------- |
| `visited`              | Public directory loaded                     |
| `listing_created`      | Organizer created one event listing         |
| `listing_opened`       | A browser opened a public listing           |
| `application_saved`    | Applicant submitted an application          |
| `application_accepted` | Organizer accepted an applicant             |
| `listing_filled`       | Accepted helpers filled all requested slots |
| `returned`             | Browser returned on another JST date        |

Telemetry does not contain listing text, venue, applicant note, position, experience, join instructions, URLs, or capability tokens.
