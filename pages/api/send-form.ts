import type { NextApiRequest, NextApiResponse } from "next"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb", // adjust if you need larger images
    },
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // --- CORS (fixes "Failed to fetch") ---
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept")

  if (req.method === "OPTIONS") return res.status(200).end()
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })

  try {
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: "Server misconfigured: RESEND_API_KEY missing." })
    }

    const { to, subject, trackingId, form, attachment, meta } = req.body || {}

    if (!to || typeof to !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'to' email." })
    }
    if (!form || typeof form !== "object") {
      return res.status(400).json({ error: "Missing form data." })
    }
    if (!form.email) {
      return res.status(400).json({ error: "Missing form.email." })
    }

    // attachment: { name, type, dataUrl } where dataUrl = "data:image/png;base64,...."
    let attachments: Array<{ filename: string; content: string }> = []
    if (attachment?.dataUrl && attachment?.name) {
      const dataUrl = String(attachment.dataUrl)
      const parts = dataUrl.split(",")
      if (parts.length < 2) {
        return res.status(400).json({ error: "Invalid attachment format." })
      }
      const base64 = parts[1]

      // Basic guard (prevents extreme payloads)
      if (base64.length > 12_000_000) {
        return res.status(413).json({ error: "Attachment too large." })
      }

      attachments.push({
        filename: String(attachment.name),
        content: base64,
      })
    }

    const safe = (v: any) => (v === undefined || v === null ? "" : String(v))

    const html = `
      <h2>New Submission</h2>
      <p><b>Tracking ID:</b> ${safe(trackingId) || "-"}</p>

      <p><b>First Name:</b> ${safe(form.firstName)}</p>
      <p><b>Last Name:</b> ${safe(form.lastName)}</p>
      <p><b>Email:</b> ${safe(form.email)}</p>
      <p><b>Phone:</b> ${safe(form.phone)}</p>
      <p><b>City:</b> ${safe(form.city)}</p>
      <p><b>Agreed:</b> ${form.agree ? "Yes" : "No"}</p>

      <hr />
      <p><b>Page URL:</b> ${safe(meta?.url)}</p>
      <p><b>User Agent:</b> ${safe(meta?.userAgent)}</p>
      <p><b>Time:</b> ${safe(meta?.timestamp)}</p>
    `

    const result = await resend.emails.send({
      // NOTE: For best deliverability verify domain in Resend and set your own from.
      from: "Forms <onboarding@resend.dev>",
      to: [to],
      subject: subject ? String(subject) : "New Submission",
      html,
      replyTo: safe(form.email),
      attachments,
    })

    return res.status(200).json({
      ok: true,
      message: "Email sent.",
      resend: result,
    })
  } catch (e: any) {
    // Always return JSON so frontend can show real error
    return res.status(500).json({
      error: e?.message || "Server error",
    })
  }
}
