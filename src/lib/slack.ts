// This helper sends messages to a Slack channel using an incoming webhook.
// You must create a Slack Incoming Webhook and put its URL into SLACK_WEBHOOK_URL in your .env file.

const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

if (!slackWebhookUrl) {
  // We do not throw here because we still want the app to run
  // even if Slack is not configured yet. Instead we will just skip sending.
  console.warn(
    "SLACK_WEBHOOK_URL is not set. Slack notifications will be skipped."
  );
}

export type SlackBlock = {
  type: string;
  [key: string]: unknown;
};

/**
 * Sends a message to Slack.
 * - `text` is the plain-text fallback and also appears in notifications.
 * - `blocks` lets us send rich Block Kit layouts.
 */
export async function sendSlackMessage(
  text: string,
  blocks?: SlackBlock[]
) {
  if (!slackWebhookUrl) {
    // If there is no webhook configured we log and return early.
    console.log("[Slack] Skipping send because SLACK_WEBHOOK_URL is missing");
    return;
  }

  await fetch(slackWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      blocks && blocks.length > 0 ? { text, blocks } : { text }
    ),
  });
}

