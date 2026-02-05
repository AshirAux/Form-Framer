import type { NextApiRequest, NextApiResponse } from "next"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS: allow your Framer site
  res.setHeader("Access-Control-Allow-Origin", "https://aichallenge.framer.website")
  res.setHeader("Vary", "Origin")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept")

  if (req.method === "OPTIONS") return res.status(200).end()
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })

  try {
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: "Missing RESEND_API_KEY on server." })
    }

    const { to, subject, trackingId, form, attachment, meta } = req.body || {}
    if (!to) return res.status(400).json({ error: "Missing 'to' email." })
    if (!form?.email) return res.status(400).json({ error: "Missing form data." })

    let attachments: any[] = []
    if (attachment?.dataUrl && attachment?.name) {
      const base64 = String(attachment.dataUrl).split(",")[1]
      attachments.push({ filename: attachment.name, content: base64 })
    }

    const html = `
      <h2>New Submission</h2>
      <p><b>Tracking ID:</b> ${trackingId || "-"}</p>
      <p><b>First Name:</b> ${form.firstName}</p>
      <p><b>Last Name:</b> ${form.lastName}</p>
      <p><b>Email:</b> ${form.email}</p>
      <p><b>Phone:</b> ${form.phone}</p>
      <p><b>City:</b> ${form.city}</p>
      <p><b>Agreed:</b> ${form.agree ? "Yes" : "No"}</p>
      <hr/>
      <p><b>Page URL:</b> ${meta?.url || "-"}</p>
      <p><b>Time:</b> ${meta?.timestamp || "-"}</p>
    `

    const result = await resend.emails.send({
      from: "Forms <onboarding@resend.dev>",
      to: [String(to)],
      subject: subject || "New Submission",
      html,
      replyTo: String(form.email),
      attachments,
    })

    return res.status(200).json({ ok: true, result })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Server error" })
  }
}
