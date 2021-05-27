import {
	IExecuteFunctions,
} from 'n8n-core';
import {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import {
	configFields,
	configOperations,
} from './ConfigDescription';

import {
	serviceFields,
	serviceOperations,
} from './ServiceDescription';

import {
	stateFields,
	stateOperations,
} from './StateDescription';

import {
	eventFields,
	eventOperations,
} from './EventDescription';

import {
	logFields,
	logOperations,
} from './LogDescription';

import {
	templateFields,
	templateOperations,
} from './TemplateDescription';

import {
	historyFields,
	historyOperations,
} from './HistoryDescription';

import {
	cameraProxyFields,
	cameraProxyOperations,
} from './CameraProxyDescription';

import {
	homeAssistantApiRequest,
	validateJSON,
} from './GenericFunctions';
export class HomeAssistant implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Home Assistant',
		name: 'homeAssistant',
		icon: 'file:homeAssistant.svg',
		group: [ 'output' ],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume Home Assistant Io API',
		defaults: {
			name: 'Home Assistant',
			color: '#3578e5',
		},
		inputs: [ 'main' ],
		outputs: [ 'main' ],
		credentials: [
			{
				name: 'homeAssistantApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				options: [
					{
						name: 'Camera Proxy',
						value: 'cameraProxy',
					},
					{
						name: 'Config',
						value: 'config',
					},
					{
						name: 'Event',
						value: 'event',
					},
					{
						name: 'History',
						value: 'history',
					},
					{
						name: 'Log',
						value: 'log',
					},
					{
						name: 'Service',
						value: 'service',
					},
					{
						name: 'State',
						value: 'state',
					},
					{
						name: 'Template',
						value: 'template',
					},
				],
				default: 'config',
				description: 'Resource to consume.',
			},
			// Camera proxy
			...cameraProxyOperations,
			...cameraProxyFields,
			// Configuration
			...configOperations,
			...configFields,
			// Event
			...eventOperations,
			...eventFields,
			// History
			...historyOperations,
			...historyFields,
			// Log
			...logOperations,
			...logFields,
			// Service
			...serviceOperations,
			...serviceFields,
			// State
			...stateOperations,
			...stateFields,
			// Template
			...templateOperations,
			...templateFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const length = items.length as unknown as number;
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		const qs: IDataObject = {};
		let responseData;
		for (let i = 0; i < length; i++) {
			try {
				if (resource === 'config') {
					if (operation === 'get') {
						responseData = await homeAssistantApiRequest.call(this, 'GET', '/config');
					} else if (operation === 'check') {
						responseData = await homeAssistantApiRequest.call(this, 'POST', '/config/core/check_config');
					}
				} else if (resource === 'service') {
					if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						responseData = await homeAssistantApiRequest.call(this, 'GET', '/services');
						if (!returnAll) {
							const limit = this.getNodeParameter('limit', i) as number;
							responseData = (responseData as IDataObject[]).slice(0, limit);
						}
					} else if (operation === 'call') {
						const domain = this.getNodeParameter('domain', i) as string;
						const service = this.getNodeParameter('service', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						let body = {};

						if (additionalFields) {
							const isJson = (additionalFields!.field as IDataObject).jsonParameters as boolean;
							if (isJson) {
								const parseResult = validateJSON((additionalFields!.field as IDataObject).bodyParametersJson as string);
								if (parseResult === undefined) {
									throw new NodeOperationError(this.getNode(), 'Body Parameters: Invalid JSON');
								}
								body = { ...parseResult };
							} else {
								const serviceDataUi = ((additionalFields!.field as IDataObject).serviceDataUi as IDataObject);
								if (serviceDataUi.field !== undefined) {
									(serviceDataUi.field as IDataObject[]).map(
										param => {
											// @ts-ignore
											body[ param.name as string ] = param.value;
										},
									);
								}
							}
						}

						responseData = await homeAssistantApiRequest.call(this, 'POST', `/services/${domain}/${service}`, body);
						if (Array.isArray(responseData) && responseData.length === 0) {
							responseData = { sucess: true };
						}
					}
				} else if (resource === 'state') {
					if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						responseData = await homeAssistantApiRequest.call(this, 'GET', '/states');
						if (!returnAll) {
							const limit = this.getNodeParameter('limit', i) as number;
							responseData = (responseData as IDataObject[]).slice(0, limit);
						}
					} else if (operation === 'get') {
						const entityId = this.getNodeParameter('entityId', i) as string;
						responseData = await homeAssistantApiRequest.call(this, 'GET', `/states/${entityId}`);
					} else if (operation === 'upsert') {
						const entityId = this.getNodeParameter('entityId', i) as string;
						const state = this.getNodeParameter('state', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						const body = {
							state,
							attributes: {},
						};

						if (Object.entries(additionalFields).length !== 0) {
							const stateAttributesUi = ((additionalFields!.attributes as IDataObject).stateAttributesUi as IDataObject);
							if (stateAttributesUi.attribute !== undefined) {
								(stateAttributesUi.attribute as IDataObject[]).map(
									attribute => {
										// @ts-ignore
										body.attributes[ attribute.name as string ] = attribute.value;
									},
								);
							}
						}

						responseData = await homeAssistantApiRequest.call(this, 'POST', `/states/${entityId}`, body);
					}
				} else if (resource === 'event') {
					if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						responseData = await homeAssistantApiRequest.call(this, 'GET', '/events');
						if (!returnAll) {
							const limit = this.getNodeParameter('limit', i) as number;
							responseData = (responseData as IDataObject[]).slice(0, limit);
						}
					} else if (operation === 'post') {
						const eventType = this.getNodeParameter('eventType', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						const body = {
						};

						if (Object.entries(additionalFields).length !== 0) {
							const eventAttributesUi = ((additionalFields!.attributes as IDataObject).eventAttributesUi as IDataObject);
							if (eventAttributesUi.attribute !== undefined) {
								(eventAttributesUi.attribute as IDataObject[]).map(
									attribute => {
										// @ts-ignore
										body[ attribute.name as string ] = attribute.value;
									},
								);
							}
						}

						responseData = await homeAssistantApiRequest.call(this, 'POST', `/events/${eventType}`, body);

					}
				} else if (resource === 'log') {
					if (operation === 'getErroLogs') {
						responseData = await homeAssistantApiRequest.call(this, 'GET', '/error_log');
						if (responseData) {
							responseData = {
								errorLog: responseData,
							};
						}
					} else if (operation === 'getLogbookEntries') {
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						let endpoint = '/logbook';

						if (Object.entries(additionalFields).length !== 0) {
							if (additionalFields.startTime) {
								endpoint = `/logbook/${additionalFields.startTime}`;
							}
							if (additionalFields.endTime) {
								qs.end_time = additionalFields.endTime;
							}
							if (additionalFields.entityId) {
								qs.entity = additionalFields.entityId;
							}
						}

						responseData = await homeAssistantApiRequest.call(this, 'GET', endpoint, {}, qs);

					}
				} else if (resource === 'template') {
					if (operation === 'create') {
						const body = {
							template: this.getNodeParameter('template', i) as string,
						};
						responseData = await homeAssistantApiRequest.call(this, 'POST', '/template', body);
						if (responseData) {
							responseData = { renderedTemplate: responseData };
						}
					}
				} else if (resource === 'history') {
					if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						let endpoint = '/history/period';

						if (Object.entries(additionalFields).length !== 0) {
							if (additionalFields.startTime) {
								endpoint = `/history/period/${additionalFields.startTime}`;
							}
							if (additionalFields.endTime) {
								qs.end_time = additionalFields.endTime;
							}
							if (additionalFields.entityIds) {
								qs.filter_entity_id = additionalFields.entityIds;
							}
							if (additionalFields.minimalResponse === true) {
								qs.minimal_response = additionalFields.minimalResponse;
							}
							if (additionalFields.significantChangesOnly === true) {
								qs.significant_changes_only = additionalFields.significantChangesOnly;
							}
						}

						responseData = await homeAssistantApiRequest.call(this, 'GET', endpoint, {}, qs);
						if (!returnAll) {
							const limit = this.getNodeParameter('limit', i) as number;
							responseData = (responseData as IDataObject[]).slice(0, limit);
						}
					}
				} else if (resource === 'cameraProxy') {
					if (operation === 'get') {
						const cameraEntityId = this.getNodeParameter('cameraEntityId', i) as string;
						const dataPropertyNameDownload = this.getNodeParameter('binaryPropertyName', i) as string;
						const endpoint = `/camera_proxy/${cameraEntityId}`;

						let mimeType: string | undefined;

						responseData = await homeAssistantApiRequest.call(this, 'GET', endpoint, {}, {}, undefined, {
							encoding: null,
							resolveWithFullResponse: true,
						});

						const newItem: INodeExecutionData = {
							json: items[i].json,
							binary: {},
						};

						if (mimeType === undefined && responseData.headers['content-type']) {
							mimeType = responseData.headers['content-type'];
						}

						if (items[i].binary !== undefined) {
							// Create a shallow copy of the binary data so that the old
							// data references which do not get changed still stay behind
							// but the incoming data does not get changed.
							Object.assign(newItem.binary, items[i].binary);
						}

						items[i] = newItem;

						const data = Buffer.from(responseData.body as string);

						items[i].binary![dataPropertyNameDownload] = await this.helpers.prepareBinaryData(data as unknown as Buffer, `screenshot.jpg`, mimeType);
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					if (resource === 'cameraProxy' && operation === 'get') {
						items[i].json = { error: error.message };
					} else {
						returnData.push({ error: error.message });
					}
					continue;
				}
				throw error;
			}

			if (Array.isArray(responseData)) {
				returnData.push.apply(returnData, responseData as IDataObject[]);
			} else {
				returnData.push(responseData as IDataObject);
			}
		}

		if (resource === 'cameraProxy' && operation === 'get') {
			return this.prepareOutputData(items);
		} else {
			return [ this.helpers.returnJsonArray(returnData) ];
		}
	}
}
