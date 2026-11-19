import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.AIKI_API_KEY, baseURL: process.env.AIKI_BASE_URL });

const PLANTNET_STATUS_MESSAGES: Record<number, string> = {
  400: "Some of the uploaded images or parameters were invalid.",
  401: "Plant identification API authentication failed.",
  404: "No matching plant species or disease could be identified.",
  413: "Your photos are too large to upload together. Try fewer or smaller images.",
  414: "The request URI was too long.",
  415: "Unsupported image format. Please upload only PNG or JPG/JPEG photos.",
  429: "Identification quota reached for now. Please try again later.",
  500: "Pl@ntNet is having trouble right now. Please try again shortly.",
};

function getStatusMessage(status: number, fallback: string): string {
  if (PLANTNET_STATUS_MESSAGES[status]) return PLANTNET_STATUS_MESSAGES[status];
  if (status >= 500) return "The identification service is temporarily unavailable.";
  return `${fallback} (HTTP ${status})`;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.PLANTNET_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing PLANTNET_API_KEY on server." }, { status: 500 });
    }
    if (!process.env.AIKI_API_KEY) {
      return NextResponse.json({ error: "Missing AIKI_API_KEY on server." }, { status: 500 });
    }

    const incomingForm = await req.formData();
    const files = incomingForm
      .getAll("images")
      .filter((item): item is File => item instanceof File && item.size > 0);

    if (files.length === 0) {
      return NextResponse.json({ error: "Please upload at least one PNG or JPG photo." }, { status: 400 });
    }

    const buildPlantNetFormData = () => {
      const fd = new FormData();
      for (const file of files) {
        fd.append("images", file, file.name);
        fd.append("organs", "auto");
      }
      return fd;
    };

    const speciesUrl = `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(apiKey)}&include-related-images=false&no-reject=false&nb-results=5`;
    const diseasesUrl = `https://my-api.plantnet.org/v2/diseases/identify?api-key=${encodeURIComponent(apiKey)}&no-reject=false&nb-results=5&lang=en`;

    const [speciesRes, diseasesRes] = await Promise.all([
      fetch(speciesUrl, { method: "POST", body: buildPlantNetFormData() }),
      fetch(diseasesUrl, { method: "POST", body: buildPlantNetFormData() }),
    ]);

    if (!speciesRes.ok) {
      const msg = getStatusMessage(speciesRes.status, "Species identification failed");
      return NextResponse.json({ error: msg }, { status: speciesRes.status });
    }

    if (!diseasesRes.ok) {
      const msg = getStatusMessage(diseasesRes.status, "Disease identification failed");
      return NextResponse.json({ error: msg }, { status: diseasesRes.status });
    }

    const speciesData = await speciesRes.json();
    const diseasesData = await diseasesRes.json();

    const topSpecies = (speciesData.results ?? []).slice(0, 3).map((r: any) => ({
      scientificName: r.species?.scientificNameWithoutAuthor ?? r.name ?? "Unknown",
      commonNames: r.species?.commonNames ?? [],
      score: r.score ?? 0,
    }));

    const topDiseases = (diseasesData.results ?? []).slice(0, 3).map((d: any) => ({
      name: d.name ?? "",
      label: d.label ?? d.description ?? "Unknown condition",
      score: d.score ?? 0,
    }));

    const botanicalSummary = JSON.stringify(
      { topSpecies, topDiseases },
      null,
      2
    );
    console.log(botanicalSummary);

    /* GIAN WOK ON THIS !!! */
    const completion = await openai.chat.completions.create({
      model: "gpt-6-luna",
      messages: [
        {
          role: "system",
          content:
            "You are Buotany, a helpful, practical plant care and plant pathology assistant. " +
            "You receive candidate species and disease/pest detections from Pl@ntNet (with confidence scores from 0 to 1). " +
            "Explain the most likely plant species and potential disease/issue clearly, note confidence levels and limitations " +
            "(e.g., if scores are low or no disease matched, consider environmental stress like over/underwatering, light, or nutrients), " +
            "and give actionable next steps for care.",
        },
        {
          role: "user",
          content: `Here are the Pl@ntNet identification results for the uploaded plant photos:\n\n${botanicalSummary}\n\nPlease provide a clear diagnosis and care recommendations.`,
        },
      ],
    });

    const diagnosis =
      completion.choices[0]?.message?.content?.trim() ||
      "I couldn't generate a diagnosis from those results.";

    return NextResponse.json({
      diagnosis,
      contextSummary: botanicalSummary,
    });
  } catch (err) {
    console.error("Diagnose route error:", err);
    return NextResponse.json(
      { error: "Something went wrong while analyzing your plant photos." },
      { status: 500 }
    );
  }
}