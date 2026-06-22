export type EventPriceRule = {
  id?: string;
  sort_order: number;
  label: string;
  label_en?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  amount_czk: number;
  is_active: boolean;
};

export type EventRegistrationFieldOption = {
  value: string;
  label: string;
  label_en?: string | null;
};

export type EventRegistrationField = {
  id?: string;
  sort_order: number;
  field_key: string;
  field_type: 'text' | 'textarea' | 'checkbox' | 'select' | 'date';
  label: string;
  label_en?: string | null;
  placeholder?: string | null;
  placeholder_en?: string | null;
  helper_text?: string | null;
  helper_text_en?: string | null;
  options: EventRegistrationFieldOption[];
  is_required: boolean;
  is_active: boolean;
};

const FIELD_TYPES = new Set(['text', 'textarea', 'checkbox', 'select', 'date']);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function slugifyFieldKey(input: string) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

export function normalizePriceRules(input: unknown): EventPriceRule[] {
  if (!Array.isArray(input)) return [];

  return input.map((item, index) => {
    const row = asRecord(item);
    const amountRaw = Number(row.amount_czk ?? row.amountCzk ?? 0);
    return {
      id: row.id ? String(row.id) : undefined,
      sort_order: Number.isFinite(Number(row.sort_order ?? row.sortOrder))
        ? Math.max(0, Math.floor(Number(row.sort_order ?? row.sortOrder)))
        : index,
      label: String(row.label || '').trim(),
      label_en: row.label_en ? String(row.label_en).trim() : row.labelEn ? String(row.labelEn).trim() : '',
      starts_at: row.starts_at ? String(row.starts_at) : row.startsAt ? String(row.startsAt) : null,
      ends_at: row.ends_at ? String(row.ends_at) : row.endsAt ? String(row.endsAt) : null,
      amount_czk: Number.isFinite(amountRaw) ? Math.max(0, Math.round(amountRaw * 100) / 100) : 0,
      is_active: row.is_active !== false && row.isActive !== false,
    };
  }).filter((rule) => rule.label);
}

export function normalizeRegistrationFields(input: unknown): EventRegistrationField[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item, index) => {
      const row = asRecord(item);
      const rawType = String(row.field_type ?? row.fieldType ?? 'text');
      const field_type = FIELD_TYPES.has(rawType) ? (rawType as EventRegistrationField['field_type']) : 'text';
      const optionsInput = Array.isArray(row.options) ? row.options : [];

      return {
        id: row.id ? String(row.id) : undefined,
        sort_order: Number.isFinite(Number(row.sort_order ?? row.sortOrder))
          ? Math.max(0, Math.floor(Number(row.sort_order ?? row.sortOrder)))
          : index,
        field_key: slugifyFieldKey(String(row.field_key ?? row.fieldKey ?? row.label ?? '')),
        field_type,
        label: String(row.label || '').trim(),
        label_en: row.label_en ? String(row.label_en).trim() : row.labelEn ? String(row.labelEn).trim() : '',
        placeholder: row.placeholder ? String(row.placeholder).trim() : '',
        placeholder_en: row.placeholder_en ? String(row.placeholder_en).trim() : row.placeholderEn ? String(row.placeholderEn).trim() : '',
        helper_text: row.helper_text ? String(row.helper_text).trim() : row.helperText ? String(row.helperText).trim() : '',
        helper_text_en: row.helper_text_en ? String(row.helper_text_en).trim() : row.helperTextEn ? String(row.helperTextEn).trim() : '',
        options: optionsInput
          .map((option) => {
            const optionRow = asRecord(option);
            return {
              value: String(optionRow.value || '').trim(),
              label: String(optionRow.label || '').trim(),
              label_en: optionRow.label_en ? String(optionRow.label_en).trim() : optionRow.labelEn ? String(optionRow.labelEn).trim() : '',
            };
          })
          .filter((option) => option.value && option.label),
        is_required: row.is_required === true || row.isRequired === true,
        is_active: row.is_active !== false && row.isActive !== false,
      };
    })
    .filter((field) => field.field_key && field.label);
}

export function pickActivePriceRule(rules: EventPriceRule[], now = new Date()) {
  const timestamp = now.getTime();

  return rules
    .filter((rule) => {
      if (!rule.is_active) return false;
      const startsAt = rule.starts_at ? new Date(rule.starts_at).getTime() : null;
      const endsAt = rule.ends_at ? new Date(rule.ends_at).getTime() : null;
      if (startsAt != null && Number.isFinite(startsAt) && timestamp < startsAt) return false;
      if (endsAt != null && Number.isFinite(endsAt) && timestamp > endsAt) return false;
      return true;
    })
    .sort((left, right) => {
      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
      return String(left.starts_at || '').localeCompare(String(right.starts_at || ''));
    })[0] || null;
}
