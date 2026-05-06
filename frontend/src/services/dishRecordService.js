const DISHES_URL = "/api/v1/dishes";

/**
 * Build the POST body for creating a staff dish record.
 */
function buildDishRecordPayload({
  imageDataUrl,
  predictedFromAi,
  confirmed,
  quantityValue,
  sourceEntity,
  staffMe,
}) {
  return {
    image_url: imageDataUrl,
    predicted_label: predictedFromAi.slice(0, 255),
    confirmed_label: confirmed.slice(0, 255),
    quantity: quantityValue,
    source_entity: (sourceEntity.trim() || "غير محدد").slice(0, 100),
    employee_id: staffMe?.id ?? null,
    employee_name: staffMe?.full_name || staffMe?.username || staffMe?.email || null,
    employee_email: staffMe?.email || null,
    branch_id: staffMe?.branch_id ?? 1,
    branch_name: staffMe?.branch_name || "فرع تجريبي",
    // ISO UTC — satisfies strict APIs; current backend overwrites with server time.
    recorded_at: new Date().toISOString(),
  };
}

/**
 * Save one dish record via POST /api/v1/dishes.
 */
export async function saveDishRecord({
  token,
  imageDataUrl,
  predictedFromAi,
  confirmed,
  quantityValue,
  sourceEntity,
  staffMe,
}) {
  const payload = buildDishRecordPayload({
    imageDataUrl,
    predictedFromAi,
    confirmed,
    quantityValue,
    sourceEntity,
    staffMe,
  });
  const res = await fetch(DISHES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, body: data, payload };
  }
  return { ok: true, data };
}

/**
 * Fetch staff dish records list via GET /api/v1/dishes.
 */
export async function fetchDishRecords({ token }) {
  const res = await fetch(DISHES_URL, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(data)) {
    return { ok: false, status: res.status, body: data };
  }
  return { ok: true, data };
}
