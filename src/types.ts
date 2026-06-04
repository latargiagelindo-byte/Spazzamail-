export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromName: string;
  fromEmail: string;
  date: string;
  snippet: string;
  sizeEstimate: number; // in bytes
  labelIds: string[];
  isUnread: boolean;
  hasUnsubscribe: boolean;
}

export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  query: string;
  icon: string;
}

export interface InboxStats {
  totalAnalyzed: number;
  totalUnread: number;
  totalNewsletters: number;
  totalLarge: number; // > 5MB
  totalOld: number; // > 1 year
  totalSize: number; // total size in bytes
}

export interface SenderGroup {
  senderEmail: string;
  senderName: string;
  count: number;
  totalSize: number;
  messages: GmailMessage[];
}
