export type QualiphyExamInviteInput = {
  examId: number;
  firstName: string;
  lastName: string;
  email: string;
  dob: string;
  phoneNumber: string;
  state: string;
  teleState: string;
  webhookUrl: string;
  additionalData: Record<string, unknown>;
  gender?: number;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  zipCode?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string | null;
  shippingCity?: string;
  shippingState?: string;
  shippingZipCode?: string;
};

export type QualiphyPatientExam = {
  patientExamId: number | string;
  examId: number | string | null;
  examTitle: string | null;
};

export type QualiphyExamInviteResult = {
  meetingUrl: string | null;
  meetingUuid: string | null;
  patientExams: QualiphyPatientExam[];
  raw: unknown;
};

type QualiphyInviteResponse = {
  meeting_url?: unknown;
  meeting_uuid?: unknown;
  patient_exams?: unknown;
};

function normalizePatientExam(item: unknown): QualiphyPatientExam | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const patientExamId = record.patient_exam_id;
  if (typeof patientExamId !== "number" && typeof patientExamId !== "string") return null;

  return {
    patientExamId,
    examId: typeof record.exam_id === "number" || typeof record.exam_id === "string" ? record.exam_id : null,
    examTitle: typeof record.exam_title === "string" ? record.exam_title : null
  };
}

export async function sendQualiphyExamInvite(input: QualiphyExamInviteInput): Promise<QualiphyExamInviteResult> {
  const apiKey = process.env.QUALIPHY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Qualiphy API key is not configured.");
  }

  const body = {
    api_key: apiKey,
    exams: [input.examId],
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    dob: input.dob,
    phone_number: input.phoneNumber,
    state: input.state,
    tele_state: input.teleState,
    webhook_url: input.webhookUrl,
    additional_data: JSON.stringify(input.additionalData),
    ...(input.gender ? { gender: input.gender } : {}),
    ...(input.addressLine1
      ? {
          address_line_1: input.addressLine1,
          address_line_2: input.addressLine2 || undefined,
          city: input.city,
          zip_code: input.zipCode
        }
      : {}),
    ...(input.shippingAddressLine1
      ? {
          shipping_address_line_1: input.shippingAddressLine1,
          shipping_address_line_2: input.shippingAddressLine2 || undefined,
          shipping_city: input.shippingCity,
          shipping_state: input.shippingState,
          shipping_zip_code: input.shippingZipCode
        }
      : {})
  };

  const response = await fetch("https://api.qualiphy.me/api/exam_invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as QualiphyInviteResponse | null;

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload ? String((payload as { message?: unknown }).message) : null;
    throw new Error(message || `Qualiphy exam invite failed with ${response.status}.`);
  }

  const patientExams = Array.isArray(payload?.patient_exams)
    ? payload.patient_exams.map((item) => normalizePatientExam(item)).filter((item): item is QualiphyPatientExam => Boolean(item))
    : [];

  return {
    meetingUrl: typeof payload?.meeting_url === "string" ? payload.meeting_url : null,
    meetingUuid: typeof payload?.meeting_uuid === "string" ? payload.meeting_uuid : null,
    patientExams,
    raw: payload
  };
}
