import { GmailMessage } from '../types';

/**
 * Parses email headers to extract Subject, From, Date, and unsubscribe headers.
 */
function parseHeaders(headers: { name: string; value: string }[]) {
  let subject = '(Senza oggetto)';
  let from = '(Sconosciuto)';
  let date = '';
  let hasUnsubscribe = false;

  for (const header of headers) {
    const name = header.name.toLowerCase();
    const val = header.value;

    if (name === 'subject') {
      subject = val;
    } else if (name === 'from') {
      from = val;
    } else if (name === 'date') {
      date = val;
    } else if (name === 'list-unsubscribe') {
      hasUnsubscribe = true;
    }
  }

  // Parse sender name and email
  // Format: "John Doe <john@example.com>" or "john@example.com"
  let fromName = from;
  let fromEmail = from;

  const emailRegex = /<([^>]+)>/;
  const match = from.match(emailRegex);
  if (match) {
    fromEmail = match[1].trim();
    fromName = from.replace(emailRegex, '').replace(/"/g, '').trim();
    if (!fromName) {
      fromName = fromEmail;
    }
  }

  return { subject, from, fromName, fromEmail, date, hasUnsubscribe };
}

/**
 * Fetches message list from Gmail API with an optional dynamic search query `q`.
 */
export async function listGmailMessages(
  accessToken: string,
  query: string = 'label:INBOX',
  maxResults: number = 80
): Promise<{ id: string; threadId: string }[]> {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', maxResults.toString());

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Gmail API error listing messages: ${response.statusText}`);
  }

  const data = await response.json();
  return data.messages || [];
}

/**
 * Fetches individual message details.
 */
export async function getGmailMessageDetails(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date&metadataHeaders=List-Unsubscribe`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Gmail API error getting message details: ${response.statusText}`);
  }

  const data = await response.json();
  const headers = data.payload?.headers || [];
  const parsed = parseHeaders(headers);

  // Fallback check for unsubscribe in snippet
  const snippet = data.snippet || '';
  const hasUnsubscribe = 
    parsed.hasUnsubscribe || 
    snippet.toLowerCase().includes('unsubscribe') || 
    snippet.toLowerCase().includes('disiscriviti') ||
    snippet.toLowerCase().includes('cancellati');

  return {
    id: data.id,
    threadId: data.threadId,
    subject: parsed.subject,
    from: parsed.from,
    fromName: parsed.fromName,
    fromEmail: parsed.fromEmail,
    date: parsed.date,
    snippet: snippet,
    sizeEstimate: data.sizeEstimate || 0,
    labelIds: data.labelIds || [],
    isUnread: data.labelIds?.includes('UNREAD') || false,
    hasUnsubscribe: hasUnsubscribe,
  };
}

/**
 * Batch fetches message details in parallel with a limited batch size to avoid overwhelming client/network.
 */
export async function batchGetGmailMessages(
  accessToken: string,
  messageSummaries: { id: string; threadId: string }[],
  onProgress?: (loaded: number, total: number) => void
): Promise<GmailMessage[]> {
  const total = messageSummaries.length;
  const results: GmailMessage[] = [];
  const batchSize = 10; // Load 10 at a time to keep it concurrent but stable

  for (let i = 0; i < total; i += batchSize) {
    const chunk = messageSummaries.slice(i, i + batchSize);
    const promises = chunk.map((summary) =>
      getGmailMessageDetails(accessToken, summary.id).catch((err) => {
        console.warn(`Error loading message ${summary.id}:`, err);
        return null;
      })
    );

    const chunkResults = await Promise.all(promises);
    for (const res of chunkResults) {
      if (res) results.push(res);
    }

    if (onProgress) {
      onProgress(Math.min(i + batchSize, total), total);
    }
  }

  return results;
}

/**
 * Batch modifies labels of messages (e.g., mark as read, move to trash, archive).
 */
export async function batchModifyGmailMessages(
  accessToken: string,
  messageIds: string[],
  addLabelIds: string[] = [],
  removeLabelIds: string[] = []
): Promise<void> {
  if (messageIds.length === 0) return;

  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify';
  
  // Gmail API batch size limit is 1000 messages
  const chunkSize = 1000;
  for (let i = 0; i < messageIds.length; i += chunkSize) {
    const chunk = messageIds.slice(i, i + chunkSize);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids: chunk,
        addLabelIds,
        removeLabelIds,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to batch modify messages: ${response.statusText}. ${
          errorData.error?.message || ''
        }`
      );
    }
  }
}

/**
 * Fetches the raw user profile to get total messages and email addresses.
 */
export async function getGmailUserProfile(accessToken: string): Promise<{
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
}> {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Gmail API error getting profile: ${response.statusText}`);
  }

  return response.json();
}
