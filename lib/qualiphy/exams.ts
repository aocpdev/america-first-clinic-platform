export type QualiphyExam = {
  id: number;
  title: string;
  rxType: number | null;
  price: string | null;
  attachmentsRequired: number | null;
  attachments: string[];
};

type QualiphyExamResponseItem = {
  id?: unknown;
  title?: unknown;
  rx_type?: unknown;
  price?: unknown;
  attachments_required?: unknown;
  attachments?: unknown;
};

function normalizeExam(item: QualiphyExamResponseItem): QualiphyExam | null {
  if (typeof item.id !== "number" || typeof item.title !== "string") return null;

  return {
    id: item.id,
    title: item.title,
    rxType: typeof item.rx_type === "number" ? item.rx_type : null,
    price: typeof item.price === "string" ? item.price : null,
    attachmentsRequired: typeof item.attachments_required === "number" ? item.attachments_required : null,
    attachments: Array.isArray(item.attachments) ? item.attachments.filter((attachment): attachment is string => typeof attachment === "string") : []
  };
}

export async function getQualiphyExamList(): Promise<{ exams: QualiphyExam[]; error: string | null }> {
  const apiKey = process.env.QUALIPHY_API_KEY?.trim();

  if (!apiKey) {
    return { exams: [], error: "Qualiphy API key is not configured." };
  }

  try {
    const response = await fetch("https://api.qualiphy.me/api/exam_list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
      cache: "no-store"
    });

    if (!response.ok) {
      return { exams: [], error: `Qualiphy exam list failed with ${response.status}.` };
    }

    const payload = await response.json();
    const rawExams = Array.isArray(payload) ? payload : Array.isArray(payload?.exams) ? payload.exams : [];
    const exams = rawExams
      .map((item: QualiphyExamResponseItem) => normalizeExam(item))
      .filter((exam: QualiphyExam | null): exam is QualiphyExam => Boolean(exam))
      .sort((a: QualiphyExam, b: QualiphyExam) => a.title.localeCompare(b.title));

    return { exams, error: null };
  } catch (error) {
    return { exams: [], error: error instanceof Error ? error.message : "Unable to load Qualiphy exams." };
  }
}
