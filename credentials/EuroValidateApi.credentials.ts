import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class EuroValidateApi implements ICredentialType {
	name = 'euroValidateApi';

	displayName = 'EuroValidate API';

	icon: Icon = { light: 'file:eurovalidate.svg', dark: 'file:eurovalidate.svg' };

	documentationUrl = 'https://eurovalidate.com/n8n-vat-validation.html';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your EuroValidate API key (starts with ev_live_). Get a free one at https://api.eurovalidate.com/v1/auth/signup — use a dedicated key for n8n so you can rotate it independently.',
		},
	];

	// Sent as the X-API-Key header on every request.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	// Cheap, side-effect-free call that answers 401 on a bad key.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.eurovalidate.com',
			url: '/v1/auth/account',
		},
	};
}
