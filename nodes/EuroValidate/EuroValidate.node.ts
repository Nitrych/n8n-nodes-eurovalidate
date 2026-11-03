import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

/**
 * EuroValidate — declarative (routing-based) node.
 *
 * One credential (API key → X-API-Key), five operations that map 1:1 onto the
 * REST API. Every answer is returned as-is: the data fields plus `meta`
 * (confidence, source, cached, last_verified, upstream_status) and
 * `request_id`, so a workflow can branch on `status` and keep the audit trail.
 *
 * Status semantics (VAT / EORI): valid | invalid | unavailable (registry down,
 * no cached answer — treat as pending) | unverified (format check only) | error.
 */
export class EuroValidate implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'EuroValidate',
		name: 'euroValidate',
		icon: { light: 'file:eurovalidate.svg', dark: 'file:eurovalidate.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description:
			'Validate EU/UK/NO/CH/AU VAT numbers, IBANs and EORI numbers, look up companies by LEI or VAT — cached answers when VIES is down',
		defaults: {
			name: 'EuroValidate',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'euroValidateApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: 'https://api.eurovalidate.com',
			headers: {
				Accept: 'application/json',
				'User-Agent': 'n8n-nodes-eurovalidate/0.1.0',
			},
		},
		properties: [
			// ── Resource ───────────────────────────────────────────────────
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'VAT Number', value: 'vat' },
					{ name: 'IBAN', value: 'iban' },
					{ name: 'EORI Number', value: 'eori' },
					{ name: 'Company', value: 'company' },
				],
				default: 'vat',
			},

			// ── VAT ────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['vat'] } },
				options: [
					{
						name: 'Validate',
						value: 'validate',
						action: 'Validate a VAT number',
						description:
							'Check a VAT number against VIES (EU), HMRC (UK) or the national register (NO, CH, AU); returns status, registered name and address',
						routing: {
							request: {
								method: 'GET',
								url: '=/v1/vat/{{ encodeURIComponent($parameter["vatNumber"].replace(/[\\s.-]/g, "")) }}',
							},
						},
					},
				],
				default: 'validate',
			},
			{
				displayName: 'VAT Number',
				name: 'vatNumber',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'NL820646660B01',
				description:
					'With the two-letter country prefix (spaces, dots and dashes are removed). Numbers without a prefix need the Country option.',
				displayOptions: { show: { resource: ['vat'], operation: ['validate'] } },
			},
			{
				displayName: 'Options',
				name: 'vatOptions',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: { show: { resource: ['vat'], operation: ['validate'] } },
				options: [
					{
						displayName: 'Country Code',
						name: 'country',
						type: 'string',
						default: '',
						placeholder: 'NL',
						description:
							'ISO 3166-1 alpha-2 code, only needed when the number has no prefix (or starts with letters, e.g. Mexican RFCs)',
						routing: { send: { type: 'query', property: 'country' } },
					},
					{
						displayName: 'Requester VAT (Consultation Number)',
						name: 'requesterVat',
						type: 'string',
						default: '',
						placeholder: 'FR82542065479',
						description:
							'Your own EU VAT number. Forces a live, qualified VIES query and returns consultation_number — the official proof of validation (EU Reg. 904/2010, Art. 31). Cached answers are bypassed.',
						routing: { send: { type: 'query', property: 'requester_vat' } },
					},
				],
			},

			// ── IBAN ───────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['iban'] } },
				options: [
					{
						name: 'Validate',
						value: 'validate',
						action: 'Validate an IBAN',
						description: 'MOD-97 check plus bank name and BIC from the Bundesbank SCL directory',
						routing: {
							request: {
								method: 'GET',
								url: '=/v1/iban/{{ encodeURIComponent($parameter["iban"].replace(/\\s/g, "")) }}',
							},
						},
					},
				],
				default: 'validate',
			},
			{
				displayName: 'IBAN',
				name: 'iban',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'DE89 3704 0044 0532 0130 00',
				description: 'With or without spaces',
				displayOptions: { show: { resource: ['iban'], operation: ['validate'] } },
			},

			// ── EORI ───────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['eori'] } },
				options: [
					{
						name: 'Validate',
						value: 'validate',
						action: 'Validate an EORI number',
						description:
							'EU customs numbers via the European Commission, XI for Northern Ireland, GB via HMRC',
						routing: {
							request: {
								method: 'GET',
								url: '=/v1/eori/{{ encodeURIComponent($parameter["eoriNumber"].replace(/\\s/g, "")) }}',
							},
						},
					},
				],
				default: 'validate',
			},
			{
				displayName: 'EORI Number',
				name: 'eoriNumber',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'CZ00177041',
				description: 'E.g. CZ00177041, GB123456789000, XI123456789000.',
				displayOptions: { show: { resource: ['eori'], operation: ['validate'] } },
			},

			// ── Company ────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['company'] } },
				options: [
					{
						name: 'Get by LEI',
						value: 'getByLei',
						action: 'Look up a company by LEI',
						description:
							'Legal name, jurisdiction, registered address and entity status from GLEIF',
						routing: {
							request: {
								method: 'GET',
								url: '=/v1/company/lei/{{ encodeURIComponent($parameter["lei"].trim()) }}',
							},
						},
					},
					{
						name: 'Get by VAT Number',
						value: 'getByVat',
						action: 'Look up a company by VAT number',
						description:
							'Company record for a VAT number where GLEIF has one (best-effort; 404 when there is no match — enable "Continue on Fail" to branch)',
						routing: {
							request: {
								method: 'GET',
								url: '=/v1/company/vat/{{ encodeURIComponent($parameter["companyVatNumber"].replace(/[\\s.-]/g, "")) }}',
							},
						},
					},
				],
				default: 'getByLei',
			},
			{
				displayName: 'LEI',
				name: 'lei',
				type: 'string',
				required: true,
				default: '',
				placeholder: '724500PMK2A2M1SQQ228',
				description: '20-character Legal Entity Identifier',
				displayOptions: { show: { resource: ['company'], operation: ['getByLei'] } },
			},
			{
				displayName: 'VAT Number',
				name: 'companyVatNumber',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'CZ00177041',
				description: 'With country prefix',
				displayOptions: { show: { resource: ['company'], operation: ['getByVat'] } },
			},
		],
	};
}
