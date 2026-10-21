import { useMemo, useState, type FormEvent } from 'react';
import {
  Badge,
  Banner,
  Button,
  ButtonLink,
  PageHeader,
  Panel,
} from '../../components/ui';
import {
  CONNECTORS,
  CATEGORIES,
  blankConnectorValues,
  conditionMatches,
  getDatabasePort,
  isFieldRequired,
  validateConnector,
  visibleFields,
  type ConnectorKind,
  type ConnectorSpec,
  type ConnectorValues,
} from '../../data/connectorCatalog';
import { usePageMeta } from '../../shell/page-meta';

function safeFileName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'connector'
  );
}

export default function ConnectorCatalogPage() {
  usePageMeta('Connector catalog', [
    { label: 'Resources', to: '/resources' },
    { label: 'Connector catalog' },
  ]);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedId, setSelectedId] =
    useState<ConnectorKind | null>(null);

  const [values, setValues] = useState<ConnectorValues>({});
  const [errors, setErrors] = useState<Record<string, string>>(
    {},
  );

  const [drafts, setDrafts] = useState<
    Array<{
      id: string;
      kind: ConnectorKind;
      title: string;
      values: ConnectorValues;
      updatedAt: string;
    }>
  >([]);

  const [notice, setNotice] = useState('');

  const selected =
    CONNECTORS.find((item) => item.id === selectedId) ?? null;

  const filtered = useMemo(
    () =>
      CONNECTORS.filter(
        (item) =>
          (category === 'All' || item.category === category) &&
          `${item.title} ${item.description} ${item.category}`
            .toLowerCase()
            .includes(query.toLowerCase().trim()),
      ),
    [category, query],
  );

  function choose(spec: ConnectorSpec) {
    setSelectedId(spec.id);
    setValues(blankConnectorValues(spec));
    setErrors({});
    setNotice('');
  }

  function update(key: string, value: string) {
    setValues((current) => {
      const next = {
        ...current,
        [key]: value,
      };

      // Update the database port when it is still using the
      // previous engine's default. Preserve a custom port.
      if (selected?.id === 'database' && key === 'engine') {
        const previousDefault = getDatabasePort(
          current.engine ?? '',
        );

        if (
          !current.port ||
          Number(current.port) === previousDefault
        ) {
          next.port = String(getDatabasePort(value));
        }
      }

      // When the auth/TLS mode changes, discard data from fields
      // that are no longer relevant to the selected method.
      if (
        selected &&
        (key === 'authMethod' || key === 'tlsMode')
      ) {
        for (const field of selected.fields) {
          if (
            field.visibleWhen &&
            !conditionMatches(next, field.visibleWhen)
          ) {
            next[field.key] = '';
          }
        }
      }

      return next;
    });

    setErrors({});
    setNotice('');
  }

  function saveDraft(event: FormEvent) {
    event.preventDefault();

    if (!selected || selected.id === 'ssh') return;

    const nextErrors = validateConnector(selected, values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setNotice(
        'Fix the highlighted fields before saving this local draft.',
      );
      return;
    }

    const label = (
      values.host ||
      values.baseUrl ||
      values.apiServer ||
      values.registryUrl ||
      values.projectId ||
      values.accountId ||
      values.tenantId ||
      values.clusterName ||
      values.database ||
      values.organization ||
      selected.title
    ).trim();

    // Store only the fields that apply to the selected auth/TLS
    // method, not values hidden by a previous selection.
    const visibleValues = Object.fromEntries(
      visibleFields(selected, values).map((field) => [
        field.key,
        values[field.key] ?? '',
      ]),
    );

    const draft = {
      id: `${selected.id}-${Date.now()}`,
      kind: selected.id,
      title: `${label} · ${selected.title}`,
      values: visibleValues,
      updatedAt: new Date().toISOString(),
    };

    setDrafts((current) => [draft, ...current]);

    setNotice(
      'Local draft saved for review only. No API call or live connection was made.',
    );
  }

  function exportDraft(draft: (typeof drafts)[number]) {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: 'atlas-connector-draft/v1',
            authority: 'DEVICE_DRAFT_ONLY',
            exportedAt: new Date().toISOString(),
            connector: draft,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `${safeFileName(draft.title)}.json`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="page connector-page">
      <PageHeader
        eyebrow="Resources"
        title="Connector catalog"
        purpose="Design connection profiles for infrastructure and third-party systems. This frontend currently creates local drafts only; it does not store secrets or prove a live connection."
        actions={
          <ButtonLink
            to="/resources/ssh-connections"
            icon="terminal"
          >
            Manage SSH connections
          </ButtonLink>
        }
      />

      <div className="connector-toolbar">
        <div className="field connector-search">
          <label
            className="field-label"
            htmlFor="connector-search"
          >
            Search connectors
          </label>

          <input
            id="connector-search"
            className="input"
            type="search"
            placeholder="Search AWS, Kubernetes, API…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="field connector-category">
          <span className="field-label">Category</span>

          <div className="connector-category-filters">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                className="connector-category-chip"
                data-selected={category === item}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="connector-layout">
        <Panel title={`Available connectors (${filtered.length})`}>
          <div className="connector-grid">
            {filtered.map((spec) => (
              <button
                type="button"
                key={spec.id}
                className="connector-card"
                data-selected={selectedId === spec.id}
                onClick={() => choose(spec)}
              >
                <span
                  className="connector-icon"
                  aria-hidden="true"
                >
                  {spec.icon}
                </span>

                <span className="connector-card-main">
                  <strong>{spec.title}</strong>
                  <small>
                    {spec.category} · {spec.maturity}
                  </small>
                  <span>{spec.description}</span>
                </span>

                <span
                  className="connector-arrow"
                  aria-hidden="true"
                >
                  ›
                </span>
              </button>
            ))}

            {filtered.length === 0 && (
              <p className="caption connector-empty">
                No connector matches this search.
              </p>
            )}
          </div>
        </Panel>

        <Panel
          title={
            selected
              ? `Configure ${selected.title}`
              : 'Configure a connector'
          }
        >
          {!selected ? (
            <div className="connector-placeholder">
              <button
                type="button"
                className="connector-icon connector-icon-large connector-add-button"
                aria-label="Choose a connector to configure"
                title="Choose a connector"
                onClick={() => {
                  const first = CONNECTORS[1];
                  if (first) choose(first);
                }}
              >
                ＋
              </button>

              <h3>Select a connector</h3>

              <p className="caption">
                Choose a connector to open its configuration draft.
              </p>

              <ul>
                <li>
                  Credential fields depend on the selected auth method
                </li>
                <li>Secret references only</li>
                <li>Draft validation and JSON export</li>
              </ul>
            </div>
          ) : selected.id === 'ssh' ? (
            <div className="connector-placeholder connector-ssh-handoff">
              <Badge tone="success">Dedicated workflow</Badge>

              <h3>Configure SSH in SSH Connections</h3>

              <p className="caption">
                This catalog does not create a duplicate SSH draft.
                Use the dedicated workflow to create the connection,
                run the backend test, verify host keys, and bind the
                connection to an Agent role.
              </p>

              <ButtonLink
                to="/resources/ssh-connections"
                icon="terminal"
              >
                Open SSH Connections
              </ButtonLink>
            </div>
          ) : (
            <form
              className="connector-form"
              onSubmit={saveDraft}
              noValidate
            >
              <div className="connector-form-intro">
                <Badge tone="warning">UI draft only</Badge>

                <p className="caption">
                  {selected.description} These fields are a frontend
                  draft schema, not a verified provider API contract.
                </p>
              </div>

              {visibleFields(selected, values).map((field) => {
                const id = `connector-${selected.id}-${field.key}`;
                const required = isFieldRequired(field, values);
                const error = errors[field.key];
                const hintId = `${id}-help`;

                return (
                  <div className="field" key={field.key}>
                    <label
                      className="field-label"
                      htmlFor={id}
                    >
                      {field.label}

                      {required && (
                        <span className="req" aria-hidden="true">
                          {' '}*
                        </span>
                      )}
                    </label>

                    {field.type === 'select' ? (
                      <select
                        id={id}
                        className="select"
                        value={values[field.key] ?? ''}
                        onChange={(event) =>
                          update(field.key, event.target.value)
                        }
                        aria-invalid={error ? true : undefined}
                        aria-describedby={hintId}
                      >
                        {(field.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        id={id}
                        className="input connector-textarea"
                        value={values[field.key] ?? ''}
                        placeholder={field.placeholder}
                        onChange={(event) =>
                          update(field.key, event.target.value)
                        }
                        aria-invalid={error ? true : undefined}
                        aria-describedby={hintId}
                        rows={3}
                      />
                    ) : (
                      <input
                        id={id}
                        className="input"
                        type={field.type ?? 'text'}
                        inputMode={
                          field.type === 'number'
                            ? 'numeric'
                            : undefined
                        }
                        min={
                          field.type === 'number'
                            ? (field.min ?? 1)
                            : undefined
                        }
                        max={
                          field.type === 'number'
                            ? (field.max ?? 65535)
                            : undefined
                        }
                        step={
                          field.type === 'number' ? 1 : undefined
                        }
                        value={values[field.key] ?? ''}
                        placeholder={field.placeholder}
                        onChange={(event) =>
                          update(field.key, event.target.value)
                        }
                        aria-invalid={error ? true : undefined}
                        aria-describedby={hintId}
                      />
                    )}

                    <small
                      id={hintId}
                      className={
                        error ? 'field-error' : 'field-hint'
                      }
                      role={error ? 'alert' : undefined}
                    >
                      {error ??
                        field.hint ??
                        (required
                          ? 'Required for this authentication method.'
                          : 'Optional field.')}
                    </small>
                  </div>
                );
              })}

              <div className="connector-form-actions">
                <Button
                  type="submit"
                  variant="primary"
                  icon="save"
                >
                  Save local draft
                </Button>

                <Button
                  type="button"
                  onClick={() => {
                    setValues(blankConnectorValues(selected));
                    setErrors({});
                    setNotice('');
                  }}
                >
                  Reset form
                </Button>
              </div>

              {notice && (
                <Banner
                  tone={
                    notice.startsWith('Fix')
                      ? 'warning'
                      : 'info'
                  }
                  role="status"
                >
                  {notice}
                </Banner>
              )}
            </form>
          )}
        </Panel>
      </div>

      <Panel
        title={`Local drafts (${drafts.length})`}
        actions={
          drafts.length ? (
            <Button
              onClick={() => setDrafts([])}
              icon="trash-2"
            >
              Clear drafts
            </Button>
          ) : undefined
        }
      >
        {drafts.length === 0 ? (
          <p className="caption connector-drafts-empty">
            No local drafts yet. Drafts are held in memory and
            disappear when this page is reloaded.
          </p>
        ) : (
          <div className="connector-draft-list">
            {drafts.map((draft) => (
              <div className="connector-draft" key={draft.id}>
                <div>
                  <strong>{draft.title}</strong>
                  <span className="caption">
                    {draft.kind} · Draft only ·{' '}
                    {new Date(draft.updatedAt).toLocaleString()}
                  </span>
                </div>

                <div className="row">
                  <Button
                    compact
                    onClick={() => exportDraft(draft)}
                    icon="download"
                  >
                    Export JSON
                  </Button>

                  <Button
                    compact
                    onClick={() => {
                      const spec = CONNECTORS.find(
                        (item) => item.id === draft.kind,
                      );

                      if (spec) {
                        setSelectedId(spec.id);
                        setValues({
                          ...blankConnectorValues(spec),
                          ...draft.values,
                        });
                        setErrors({});
                        setNotice('Draft loaded for editing.');
                      }
                    }}
                    icon="pencil"
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}