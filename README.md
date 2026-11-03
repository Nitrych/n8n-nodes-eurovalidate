# n8n-nodes-eurovalidate

n8n community node for the [EuroValidate API](https://eurovalidate.com): validate EU/UK/NO/CH/AU VAT numbers (with the registered name and address), IBANs and EORI numbers, and look up company records by LEI or VAT number — with cached answers when VIES is down.

[n8n](https://n8n.io/) is a fair-code licensed workflow automation platform.

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/): **Settings → Community Nodes → Install** → `n8n-nodes-eurovalidate`.

Self-hosted via npm: `npm install n8n-nodes-eurovalidate` in your n8n install directory (or `~/.n8n/nodes`), then restart n8n.

## Credentials

One API key, sent as `X-API-Key`. Get a free key (100 validations/month) at <https://api.eurovalidate.com/v1/auth/signup?utm_source=n8n&utm_medium=readme>; paid plans from €19/month (500,000/month). The credential test calls `GET /v1/auth/account`.

## Operations

| Resource | Operation | API call | Notes |
|---|---|---|---|
| VAT Number | Validate | `GET /v1/vat/{number}` | 27 EU states (VIES), UK (HMRC, paid plans), NO, CH, AU from their registers; format check for CL, TR, IL, MX, CA, PH. Option **Requester VAT** returns the official VIES `consultation_number`. |
| IBAN | Validate | `GET /v1/iban/{iban}` | MOD-97 + bank name and BIC |
| EORI Number | Validate | `GET /v1/eori/{number}` | EU (EC), XI, GB (HMRC) |
| Company | Get by LEI | `GET /v1/company/lei/{lei}` | GLEIF record |
| Company | Get by VAT Number | `GET /v1/company/vat/{number}` | best-effort; 404 when GLEIF has no record — enable *Continue on Fail* to branch |

Every item returns the API's JSON unchanged: the data fields plus `meta` (`confidence`, `source`, `cached`, `last_verified`, `upstream_status`) and `request_id`.

### Branch on `status`, not on `is_valid`

| `status` | Meaning | Typical next step |
|---|---|---|
| `valid` | the registry confirmed the number | continue |
| `invalid` | the registry says no | stop / notify |
| `unavailable` | registry down **and** no cached answer | *pending* — Wait node, retry |
| `unverified` | no queryable registry for that country; only the format/check digit was tested (`format_valid`) | by policy |
| `error` | malformed input | fix the mapping |

During a VIES outage the node still succeeds, with `meta.confidence = "medium"`, `meta.source = "vies_cached"` and `meta.upstream_status = "degraded"`; `meta.last_verified` tells you how old the answer is.

## Errors

| HTTP | Cause |
|---|---|
| 401 | invalid API key |
| 403 | feature needs a paid plan (e.g. UK VAT via HMRC) |
| 429 | monthly quota or per-minute burst exceeded — `Retry-After` header; upgrade from the [dashboard](https://api.eurovalidate.com/v1/auth/dashboard) |
| 400 / 422 | malformed input (message in `detail`) |

## Example workflow

**Webhook (new customer) → EuroValidate (VAT: Validate) → IF `{{$json.status}}` = `valid` → CRM** — the false branch posts `{{$json.company_name}}` / `{{$json.status}}` to Slack.

More recipes, status reference and the Zapier/Odoo alternatives: <https://eurovalidate.com/n8n-vat-validation.html>.

## Compatibility

Tested with n8n 1.x (nodes API version 1). Node.js ≥ 20.15.

## Resources

- [EuroValidate API docs](https://api.eurovalidate.com/docs)
- [VIES status page](https://eurovalidate.com/vies-status.html)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## License

[MIT](LICENSE.md)
