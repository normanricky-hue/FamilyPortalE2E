import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env' }); // Load environment variables

export async function sendEmail(subject: string, body: string, attachments: string[] = [], html?: string) {
  // Only include attachments if they exist
  const attachmentList = attachments
    .filter(file => fs.existsSync(file))
    .map(file => ({ filename: path.basename(file), path: file }));

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_RECEIVER,
    subject,
    text: body,
    html,
    attachments: attachmentList,
  });

  console.log(`✅ Email sent successfully: ${subject}`);
}
