import { describe, expect, it } from 'vitest';

import {
  CONNECTORS,
  blankConnectorValues,
  getDatabasePort,
  validateConnector,
  visibleFields,
  type ConnectorValues,
} from './connectorCatalog';

const connector = (
  id: (typeof CONNECTORS)[number]['id'],
) => CONNECTORS.find((item) => item.id === id)!;

describe('connector auth-dependent schema', () => {
  it('requires an AWS role ARN only for role-based authentication', () => {
    const aws = connector('aws');

    const values: ConnectorValues = {
      ...blankConnectorValues(aws),
      accountId: '123456789012',
      region: 'ap-southeast-1',
      roleArn: '',
    };

    expect(
      validateConnector(aws, values).roleArn,
    ).toBeTruthy();

    values.authMethod = 'Named profile';
    values.profile = 'production';

    expect(
      visibleFields(aws, values).some(
        (field) => field.key === 'roleArn',
      ),
    ).toBe(false);

    expect(
      validateConnector(aws, values).roleArn,
    ).toBeUndefined();

    expect(
      validateConnector(aws, values).profile,
    ).toBeUndefined();
  });

  it('requires method-specific Azure credentials for a service principal', () => {
    const azure = connector('azure');

    const values: ConnectorValues = {
      ...blankConnectorValues(azure),
      tenantId: '00000000-0000-4000-8000-000000000001',
      subscriptionId: '00000000-0000-4000-8000-000000000002',
      clientId: '00000000-0000-4000-8000-000000000003',
    };

    values.authMethod = 'Service principal (client secret)';

    expect(
      validateConnector(azure, values).clientSecretRef,
    ).toBeTruthy();

    values.clientSecretRef = 'vault://cloud/azure/client-secret';

    expect(
      validateConnector(azure, values).clientSecretRef,
    ).toBeUndefined();
  });

  it('rejects non-vault secret URL schemes', () => {
    const registry = connector('registry');

    const values: ConnectorValues = {
      ...blankConnectorValues(registry),
      registryUrl: 'https://registry.example.com',
      namespace: 'platform',
      credentialRef: 'secret://registry/prod/robot',
    };

    expect(
      validateConnector(registry, values).credentialRef,
    ).toMatch(/vault:\/\//);

    values.credentialRef = 'vault://registry/prod/robot';

    expect(
      validateConnector(registry, values).credentialRef,
    ).toBeUndefined();
  });

  it('sets engine-specific database ports', () => {
    expect(getDatabasePort('PostgreSQL')).toBe(5432);
    expect(getDatabasePort('MySQL')).toBe(3306);
    expect(getDatabasePort('Microsoft SQL Server')).toBe(1433);
    expect(getDatabasePort('Oracle')).toBe(1521);
    expect(getDatabasePort('MongoDB')).toBe(27017);
    expect(getDatabasePort('Redis')).toBe(6379);

    const values = blankConnectorValues(connector('database'));

    expect(values.port).toBe('5432');
  });

  it('requires OAuth client ID, token endpoint and secret for REST client-credentials auth', () => {
    const api = connector('rest-api');

    const values: ConnectorValues = {
      ...blankConnectorValues(api),
      baseUrl: 'https://api.vendor.com/v1',
      allowedHosts: 'api.vendor.com',
      authMethod: 'OAuth 2.0 client credentials',
      tokenUrl: 'https://auth.vendor.com/oauth/token',
      clientId: 'atlas-client',
      clientSecretRef: '',
    };

    expect(
      validateConnector(api, values).clientSecretRef,
    ).toBeTruthy();

    values.clientSecretRef =
      'vault://vendors/example/oauth-secret';

    expect(
      validateConnector(api, values).clientSecretRef,
    ).toBeUndefined();
  });

  it('does not expose direct SSH configuration in the generic catalog', () => {
    const ssh = connector('ssh');

    expect(ssh.fields).toHaveLength(0);
    expect(validateConnector(ssh, {})).toEqual({});
  });
});