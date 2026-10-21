export type ConnectorKind =
  | 'ssh'
  | 'aws'
  | 'azure'
  | 'gcp'
  | 'kubernetes'
  | 'database'
  | 'rest-api'
  | 'git'
  | 'registry';

export type FieldType =
  | 'text'
  | 'url'
  | 'number'
  | 'select'
  | 'textarea';

export type FieldCondition = {
  key: string;
  equals: string | string[];
};

export type FieldSpec = {
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  requiredWhen?: FieldCondition;
  visibleWhen?: FieldCondition;
  type?: FieldType;
  options?: string[];
  secretRef?: boolean;
  min?: number;
  max?: number;
};

export type ConnectorSpec = {
  id: ConnectorKind;
  title: string;
  category: string;
  description: string;
  icon: string;
  maturity: string;
  fields: FieldSpec[];
};

export type ConnectorValues = Record<string, string>;
export type ConnectorErrors = Record<string, string>;

const refHint =
  'Vault reference only (vault://…). Never paste a secret value into this field.';

const secret = (
  key: string,
  label: string,
  placeholder: string,
  extra: Partial<FieldSpec> = {},
): FieldSpec => ({
  key,
  label,
  placeholder,
  type: 'text',
  secretRef: true,
  hint: refHint,
  ...extra,
});

const auth = (options: string[]): FieldSpec => ({
  key: 'authMethod',
  label: 'Authentication method',
  type: 'select',
  options,
  required: true,
});

const number = (
  key: string,
  label: string,
  defaultValue: string,
  min = 1,
  max = 65535,
): FieldSpec => ({
  key,
  label,
  type: 'number',
  placeholder: defaultValue,
  min,
  max,
  required: true,
});

export const DATABASE_DEFAULT_PORTS: Record<string, number> = {
  PostgreSQL: 5432,
  MySQL: 3306,
  'Microsoft SQL Server': 1433,
  Oracle: 1521,
  MongoDB: 27017,
  Redis: 6379,
};

export const CONNECTORS: ConnectorSpec[] = [
  {
    id: 'ssh',
    title: 'SSH server',
    category: 'Infrastructure',
    description:
      'Manage real SSH connections in the dedicated SSH Connections workflow.',
    icon: 'SSH',
    maturity: 'Dedicated workflow',
    fields: [],
  },
  {
    id: 'aws',
    title: 'Amazon Web Services',
    category: 'Cloud',
    description:
      'Account and region context, with credentials selected for the chosen authentication method.',
    icon: 'AWS',
    maturity: 'UI draft',
    fields: [
      {
        key: 'accountId',
        label: 'AWS account ID',
        placeholder: '123456789012',
        required: true,
        hint: 'Exactly 12 digits.',
      },
      {
        key: 'region',
        label: 'Default region',
        placeholder: 'ap-southeast-1',
        required: true,
      },
      auth([
        'Assume role',
        'Workload identity / OIDC',
        'Named profile',
      ]),
      {
        key: 'roleArn',
        label: 'Role ARN',
        placeholder:
          'arn:aws:iam::123456789012:role/AtlasReadOnly',
        visibleWhen: {
          key: 'authMethod',
          equals: [
            'Assume role',
            'Workload identity / OIDC',
          ],
        },
        requiredWhen: {
          key: 'authMethod',
          equals: [
            'Assume role',
            'Workload identity / OIDC',
          ],
        },
        hint:
          'Required when the connector assumes a role, including via web identity.',
      },
      secret(
        'externalIdRef',
        'External ID secret reference (optional)',
        'vault://cloud/aws/external-id',
        {
          visibleWhen: {
            key: 'authMethod',
            equals: 'Assume role',
          },
        },
      ),
      {
        key: 'oidcAudience',
        label: 'OIDC audience',
        placeholder: 'sts.amazonaws.com',
        visibleWhen: {
          key: 'authMethod',
          equals: 'Workload identity / OIDC',
        },
        requiredWhen: {
          key: 'authMethod',
          equals: 'Workload identity / OIDC',
        },
      },
      {
        key: 'profile',
        label: 'Named profile',
        placeholder: 'production',
        visibleWhen: {
          key: 'authMethod',
          equals: 'Named profile',
        },
        requiredWhen: {
          key: 'authMethod',
          equals: 'Named profile',
        },
        hint:
          'The profile must exist in the Agent runtime; the form does not upload a local ~/.aws directory.',
      },
    ],
  },
  {
    id: 'azure',
    title: 'Microsoft Azure',
    category: 'Cloud',
    description:
      'Subscription-scoped access using managed identity, federation, or a service principal.',
    icon: 'AZ',
    maturity: 'UI draft',
    fields: [
      {
        key: 'tenantId',
        label: 'Tenant ID',
        placeholder:
          '00000000-0000-0000-0000-000000000000',
        required: true,
      },
      {
        key: 'subscriptionId',
        label: 'Subscription ID',
        placeholder:
          '00000000-0000-0000-0000-000000000000',
        required: true,
      },
      auth([
        'Managed identity',
        'Workload identity / federated credential',
        'Service principal (client secret)',
        'Service principal (certificate)',
      ]),
      {
        key: 'clientId',
        label: 'Application / managed identity client ID',
        placeholder:
          '00000000-0000-0000-0000-000000000000',
        visibleWhen: {
          key: 'authMethod',
          equals: [
            'Managed identity',
            'Workload identity / federated credential',
            'Service principal (client secret)',
            'Service principal (certificate)',
          ],
        },
        requiredWhen: {
          key: 'authMethod',
          equals: [
            'Workload identity / federated credential',
            'Service principal (client secret)',
            'Service principal (certificate)',
          ],
        },
        hint:
          'For managed identity, leave blank for system-assigned identity or set the client ID for user-assigned identity.',
      },
      secret(
        'clientSecretRef',
        'Client secret reference',
        'vault://cloud/azure/client-secret',
        {
          visibleWhen: {
            key: 'authMethod',
            equals: 'Service principal (client secret)',
          },
          requiredWhen: {
            key: 'authMethod',
            equals: 'Service principal (client secret)',
          },
        },
      ),
      secret(
        'certificateRef',
        'Service principal certificate reference',
        'vault://cloud/azure/certificate',
        {
          visibleWhen: {
            key: 'authMethod',
            equals: 'Service principal (certificate)',
          },
          requiredWhen: {
            key: 'authMethod',
            equals: 'Service principal (certificate)',
          },
        },
      ),
    ],
  },
  {
    id: 'gcp',
    title: 'Google Cloud',
    category: 'Cloud',
    description:
      'Project-scoped access using workload identity federation or a service-account key.',
    icon: 'GCP',
    maturity: 'UI draft',
    fields: [
      {
        key: 'projectId',
        label: 'Project ID',
        placeholder: 'production-platform',
        required: true,
      },
      auth([
        'Workload identity federation',
        'Service account key',
      ]),
      {
        key: 'workloadIdentityProvider',
        label: 'Workload identity provider resource',
        placeholder:
          'projects/123456789/locations/global/workloadIdentityPools/pool/providers/provider',
        visibleWhen: {
          key: 'authMethod',
          equals: 'Workload identity federation',
        },
        requiredWhen: {
          key: 'authMethod',
          equals: 'Workload identity federation',
        },
        hint:
          'Use the full provider resource name. The workload identity pool must be configured in Google Cloud.',
      },
      {
        key: 'serviceAccount',
        label: 'Service account email',
        placeholder:
          'atlas-reader@project.iam.gserviceaccount.com',
        visibleWhen: {
          key: 'authMethod',
          equals: [
            'Workload identity federation',
            'Service account key',
          ],
        },
        requiredWhen: {
          key: 'authMethod',
          equals: 'Service account key',
        },
      },
      secret(
        'credentialRef',
        'Service account key reference',
        'vault://cloud/gcp/service-account-key',
        {
          visibleWhen: {
            key: 'authMethod',
            equals: 'Service account key',
          },
          requiredWhen: {
            key: 'authMethod',
            equals: 'Service account key',
          },
        },
      ),
      {
        key: 'scopes',
        label: 'Requested scopes (one per line)',
        type: 'textarea',
        placeholder:
          'https://www.googleapis.com/auth/cloud-platform',
        hint:
          'Request only the scopes the Agent needs.',
      },
    ],
  },
  {
    id: 'kubernetes',
    title: 'Kubernetes cluster',
    category: 'Infrastructure',
    description:
      'Cluster API access with explicit credential source and verified TLS.',
    icon: 'K8s',
    maturity: 'UI draft',
    fields: [
      {
        key: 'apiServer',
        label: 'API server URL',
        type: 'url',
        placeholder: 'https://cluster.example.com:6443',
        required: true,
      },
      {
        key: 'clusterName',
        label: 'Cluster name',
        placeholder: 'prod-asia',
        required: true,
      },
      {
        key: 'namespace',
        label: 'Default namespace',
        placeholder: 'default',
        hint:
          'Use the narrowest namespace scope supported by the integration.',
      },
      auth([
        'Kubeconfig reference',
        'Service account token',
        'Client certificate and key',
        'OIDC token reference',
      ]),
      secret(
        'kubeconfigRef',
        'Kubeconfig secret reference',
        'vault://k8s/prod/kubeconfig',
        {
          visibleWhen: {
            key: 'authMethod',
            equals: 'Kubeconfig reference',
          },
          requiredWhen: {
            key: 'authMethod',
            equals: 'Kubeconfig reference',
          },
        },
      ),
      secret(
        'credentialRef',
        'Service account / OIDC token reference',
        'vault://k8s/prod/token',
        {
          visibleWhen: {
            key: 'authMethod',
            equals: [
              'Service account token',
              'OIDC token reference',
            ],
          },
          requiredWhen: {
            key: 'authMethod',
            equals: [
              'Service account token',
              'OIDC token reference',
            ],
          },
        },
      ),
      secret(
        'clientCertificateRef',
        'Client certificate reference',
        'vault://k8s/prod/client-cert',
        {
          visibleWhen: {
            key: 'authMethod',
            equals: 'Client certificate and key',
          },
          requiredWhen: {
            key: 'authMethod',
            equals: 'Client certificate and key',
          },
        },
      ),
      secret(
        'clientKeyRef',
        'Client private key reference',
        'vault://k8s/prod/client-key',
        {
          visibleWhen: {
            key: 'authMethod',
            equals: 'Client certificate and key',
          },
          requiredWhen: {
            key: 'authMethod',
            equals: 'Client certificate and key',
          },
        },
      ),
      {
        key: 'tlsMode',
        label: 'TLS verification',
        type: 'select',
        options: [
          'Verify system CA (recommended)',
          'Verify custom CA',
        ],
        required: true,
      },
      secret(
        'caRef',
        'Custom CA reference',
        'vault://k8s/prod/cluster-ca',
        {
          visibleWhen: {
            key: 'tlsMode',
            equals: 'Verify custom CA',
          },
          requiredWhen: {
            key: 'tlsMode',
            equals: 'Verify custom CA',
          },
        },
      ),
    ],
  },
  {
    id: 'database',
    title: 'Database',
    category: 'Data',
    description:
      'Database endpoint and authentication settings, with an engine-specific default port.',
    icon: 'DB',
    maturity: 'UI draft',
    fields: [
      {
        key: 'engine',
        label: 'Database engine',
        type: 'select',
        options: Object.keys(DATABASE_DEFAULT_PORTS),
        required: true,
      },
      {
        key: 'host',
        label: 'Host',
        placeholder: 'db.internal.example',
        required: true,
      },
      number('port', 'Port', '5432'),
      {
        key: 'database',
        label: 'Database / service name',
        placeholder: 'application',
        required: true,
      },
      auth(['Username and password']),
      {
        key: 'username',
        label: 'Username',
        placeholder: 'app_reader',
        required: true,
      },
      secret(
        'credentialRef',
        'Password secret reference',
        'vault://data/prod/readonly-password',
        {
          required: true,
          hint:
            'Reference to the password secret only; username is entered above.',
        },
      ),
      {
        key: 'tlsMode',
        label: 'TLS mode',
        type: 'select',
        options: [
          'Verify full certificate and hostname',
          'Verify CA',
          'Require TLS',
        ],
        required: true,
      },
      secret(
        'caRef',
        'CA certificate reference (if required)',
        'vault://data/prod/ca',
        {
          hint:
            'Required by your environment when custom CA trust is not already installed in the Agent runtime.',
        },
      ),
    ],
  },
  {
    id: 'rest-api',
    title: 'REST API / SaaS',
    category: 'Third-party',
    description:
      'HTTP API access with explicit authentication details and hostname restrictions.',
    icon: 'API',
    maturity: 'UI draft',
    fields: [
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'url',
        placeholder: 'https://api.vendor.com/v1',
        required: true,
      },
      auth([
        'API key',
        'OAuth 2.0 client credentials',
        'Bearer token',
        'Mutual TLS',
      ]),
      {
        key: 'apiKeyLocation',
        label: 'API key location',
        type: 'select',
        options: ['Header', 'Query parameter'],
        visibleWhen: {
          key: 'authMethod',
          equals: 'API key',
        },
        requiredWhen: {
          key: 'authMethod',
          equals: 'API key',
        },
        hint:
          'Prefer a header unless the provider requires query parameters; URLs may be logged.',
      },
      {
        key: 'apiKeyName',
        label: 'API key header / parameter name',
        placeholder: 'X-API-Key',
        visibleWhen: {
          key: 'authMethod',
          equals: 'API key',
        },
        requiredWhen: {
          key: 'authMethod',
          equals: 'API key',
        },
      },
      secret(
        'credentialRef',
        'API key / bearer token reference',
        'vault://vendors/example/api-token',
        {
          visibleWhen: {
            key: 'authMethod',
            equals: ['API key', 'Bearer token'],
          },
          requiredWhen: {
            key: 'authMethod',
            equals: ['API key', 'Bearer token'],
          },
        },
      ),
      {
        key: 'tokenUrl',
        label: 'OAuth token endpoint URL',
        type: 'url',
        placeholder: 'https://auth.vendor.com/oauth/token',
        visibleWhen: {
          key: 'authMethod',
          equals: 'OAuth 2.0 client credentials',
        },
        requiredWhen: {
          key: 'authMethod',
          equals: 'OAuth 2.0 client credentials',
        },
      },
      {
        key: 'clientId',
        label: 'OAuth client ID',
        placeholder: 'client-id',
        visibleWhen: {
          key: 'authMethod',
          equals: 'OAuth 2.0 client credentials',
        },
        requiredWhen: {
          key: 'authMethod',
          equals: 'OAuth 2.0 client credentials',
        },
      },
      secret(
        'clientSecretRef',
        'OAuth client secret reference',
        'vault://vendors/example/oauth-client-secret',
        {
          visibleWhen: {
            key: 'authMethod',
            equals: 'OAuth 2.0 client credentials',
          },
          requiredWhen: {
            key: 'authMethod',
            equals: 'OAuth 2.0 client credentials',
          },
        },
      ),
      {
        key: 'scopes',
        label: 'OAuth scopes',
        placeholder: 'read:resources',
        visibleWhen: {
          key: 'authMethod',
          equals: 'OAuth 2.0 client credentials',
        },
      },
      secret(
        'clientCertificateRef',
        'mTLS client certificate reference',
        'vault://vendors/example/client-cert',
        {
          visibleWhen: {
            key: 'authMethod',
            equals: 'Mutual TLS',
          },
          requiredWhen: {
            key: 'authMethod',
            equals: 'Mutual TLS',
          },
        },
      ),
      secret(
        'clientKeyRef',
        'mTLS client private key reference',
        'vault://vendors/example/client-key',
        {
          visibleWhen: {
            key: 'authMethod',
            equals: 'Mutual TLS',
          },
          requiredWhen: {
            key: 'authMethod',
            equals: 'Mutual TLS',
          },
        },
      ),
      number('timeout', 'Request timeout (seconds)', '30', 1, 300),
      {
        key: 'allowedHosts',
        label: 'Allowed hostnames (one per line)',
        type: 'textarea',
        placeholder: 'api.vendor.com\nstatus.vendor.com',
        required: true,
        hint:
          'Allow only hosts the Agent is expected to contact. Backend must enforce this allowlist too.',
      },
    ],
  },
  {
    id: 'git',
    title: 'Git provider',
    category: 'Third-party',
    description:
      'Connect a Git provider using a token, App installation, OAuth or SSH key.',
    icon: 'GIT',
    maturity: 'UI draft',
    fields: [
      {
        key: 'provider',
        label: 'Provider',
        type: 'select',
        options: [
          'GitHub',
          'GitLab',
          'Bitbucket',
          'Self-hosted Git',
        ],
        required: true,
      },
      {
        key: 'baseUrl',
        label: 'Provider URL',
        type: 'url',
        placeholder: 'https://github.com',
        required: true,
      },
      {
        key: 'organization',
        label: 'Organization / workspace',
        placeholder: 'platform-team',
      },
      auth([
        'Personal access token',
        'OAuth token',
        'App installation',
        'SSH key',
      ]),
      secret(
        'credentialRef',
        'Access token reference',
        'vault://git/platform/token',
        {
          visibleWhen: {
            key: 'authMethod',
            equals: ['Personal access token', 'OAuth token'],
          },
          requiredWhen: {
            key: 'authMethod',
            equals: ['Personal access token', 'OAuth token'],
          },
        },
      ),
      {
        key: 'appId',
        label: 'App ID',
        placeholder: '12345',
        visibleWhen: {
          key: 'authMethod',
          equals: 'App installation',
        },
        requiredWhen: {
          key: 'authMethod',
          equals: 'App installation',
        },
      },
      {
        key: 'installationId',
        label: 'App installation ID',
        placeholder: '12345678',
        visibleWhen: {
          key: 'authMethod',
          equals: 'App installation',
        },
        requiredWhen: {
          key: 'authMethod',
          equals: 'App installation',
        },
      },
      secret(
        'appPrivateKeyRef',
        'App private key reference',
        'vault://git/platform/app-private-key',
        {
          visibleWhen: {
            key: 'authMethod',
            equals: 'App installation',
          },
          requiredWhen: {
            key: 'authMethod',
            equals: 'App installation',
          },
        },
      ),
      secret(
        'sshPrivateKeyRef',
        'Git SSH private key reference',
        'vault://git/platform/deploy-key',
        {
          visibleWhen: {
            key: 'authMethod',
            equals: 'SSH key',
          },
          requiredWhen: {
            key: 'authMethod',
            equals: 'SSH key',
          },
        },
      ),
      {
        key: 'repositoryAllowlist',
        label: 'Allowed repositories (one owner/repo per line)',
        type: 'textarea',
        placeholder: 'team/repository-a\nteam/repository-b',
        required: true,
        hint:
          'Use an explicit allowlist; the backend/runtime must enforce it.',
      },
    ],
  },
  {
    id: 'registry',
    title: 'Container registry',
    category: 'Infrastructure',
    description:
      'Docker/OCI registry access with scoped credentials or a runtime-provided workload identity.',
    icon: 'OCI',
    maturity: 'UI draft',
    fields: [
      {
        key: 'registryUrl',
        label: 'Registry URL',
        type: 'url',
        placeholder: 'https://registry.example.com',
        required: true,
      },
      {
        key: 'namespace',
        label: 'Namespace / project',
        placeholder: 'platform',
        required: true,
      },
      auth([
        'Robot account',
        'OIDC / workload identity',
        'Username and password',
      ]),
      secret(
        'credentialRef',
        'Robot account / username-password bundle reference',
        'vault://registry/prod/robot',
        {
          visibleWhen: {
            key: 'authMethod',
            equals: [
              'Robot account',
              'Username and password',
            ],
          },
          requiredWhen: {
            key: 'authMethod',
            equals: [
              'Robot account',
              'Username and password',
            ],
          },
          hint:
            'Reference a secret bundle accepted by the backend/runtime; do not enter credentials directly.',
        },
      ),
      {
        key: 'oidcAudience',
        label: 'OIDC audience',
        placeholder: 'registry.example.com',
        visibleWhen: {
          key: 'authMethod',
          equals: 'OIDC / workload identity',
        },
        requiredWhen: {
          key: 'authMethod',
          equals: 'OIDC / workload identity',
        },
        hint:
          'Must match the identity trust configuration on the registry side.',
      },
      {
        key: 'permissions',
        label: 'Requested permissions',
        type: 'select',
        options: ['Pull only', 'Pull and push'],
        required: true,
        hint:
          'Prefer Pull only unless the Agent must publish images.',
      },
    ],
  },
];

export const CATEGORIES = [
  'All',
  'Infrastructure',
  'Cloud',
  'Data',
  'Third-party',
];

export function conditionMatches(
  values: ConnectorValues,
  condition?: FieldCondition,
): boolean {
  if (!condition) return true;

  const actual = values[condition.key] ?? '';

  return Array.isArray(condition.equals)
    ? condition.equals.includes(actual)
    : actual === condition.equals;
}

export function visibleFields(
  spec: ConnectorSpec,
  values: ConnectorValues,
): FieldSpec[] {
  return spec.fields.filter((field) =>
    conditionMatches(values, field.visibleWhen),
  );
}

export function isFieldRequired(
  field: FieldSpec,
  values: ConnectorValues,
): boolean {
  return Boolean(
    field.required ||
      (field.requiredWhen &&
        conditionMatches(values, field.requiredWhen)),
  );
}

/**
 * UI draft validation only.
 * The backend must validate again and execute the actual
 * provider connection test.
 */
export function validateConnector(
  spec: ConnectorSpec,
  values: ConnectorValues,
): ConnectorErrors {
  const errors: ConnectorErrors = {};

  // SSH must use the dedicated SSH Connections workflow.
  if (spec.id === 'ssh') return errors;

  for (const field of visibleFields(spec, values)) {
    const value = (values[field.key] ?? '').trim();

    if (isFieldRequired(field, values) && !value) {
      errors[field.key] =
        'This field is required for the selected authentication method.';
      continue;
    }

    if (!value) continue;

    if (
      field.secretRef &&
      !/^vault:\/\/[A-Za-z0-9][A-Za-z0-9._~-]*(?:\/[A-Za-z0-9][A-Za-z0-9._~-]*)+$/.test(
        value,
      )
    ) {
      errors[field.key] =
        'Use a scoped vault:// reference. Do not enter the secret value or use secret://.';
      continue;
    }

    if (field.type === 'url') {
      try {
        const url = new URL(value);

        if (
          url.protocol !== 'https:' &&
          url.protocol !== 'http:'
        ) {
          errors[field.key] = 'Use an HTTP(S) URL.';
        } else if (url.username || url.password) {
          errors[field.key] =
            'Do not put usernames or passwords into a URL.';
        }
      } catch {
        errors[field.key] =
          'Enter a valid URL, including https://.';
      }
    }

    if (field.type === 'number') {
      const numberValue = Number(value);

      if (
        !Number.isInteger(numberValue) ||
        numberValue < (field.min ?? 1) ||
        numberValue > (field.max ?? 65535)
      ) {
        errors[field.key] =
          `Enter a whole number from ${field.min ?? 1} to ${field.max ?? 65535}.`;
      }
    }
  }

  if (
    spec.id === 'aws' &&
    values.accountId?.trim() &&
    !/^\d{12}$/.test(values.accountId.trim())
  ) {
    errors.accountId =
      'AWS account ID must contain exactly 12 digits.';
  }

  if (spec.id === 'azure') {
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    for (const key of ['tenantId', 'subscriptionId']) {
      if (
        values[key]?.trim() &&
        !uuid.test(values[key].trim())
      ) {
        errors[key] = 'Enter a valid UUID.';
      }
    }
  }

  if (spec.id === 'rest-api' && values.allowedHosts?.trim()) {
    const hosts = values.allowedHosts
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (
      !hosts.length ||
      hosts.some(
        (host) =>
          host.includes('/') ||
          host.includes('://') ||
          /\s/.test(host),
      )
    ) {
      errors.allowedHosts =
        'Enter hostnames only, one per line (no scheme, path or spaces).';
    }
  }

  if (spec.id === 'git' && values.repositoryAllowlist?.trim()) {
    const repos = values.repositoryAllowlist
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (
      !repos.length ||
      repos.some(
        (repo) =>
          !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo),
      )
    ) {
      errors.repositoryAllowlist =
        'Use one owner/repository pair per line, such as team/service-api.';
    }
  }

  return errors;
}

export function blankConnectorValues(
  spec: ConnectorSpec,
): ConnectorValues {
  const values: ConnectorValues = {};

  for (const field of spec.fields) {
    values[field.key] =
      field.type === 'select'
        ? (field.options?.[0] ?? '')
        : '';
  }

  if (spec.id === 'database') {
    values.port = String(
      DATABASE_DEFAULT_PORTS[values.engine] ?? 5432,
    );
  }

  if (spec.id === 'rest-api') {
    values.timeout = '30';
  }

  return values;
}

export function getDatabasePort(engine: string): number {
  return DATABASE_DEFAULT_PORTS[engine] ?? 5432;
}