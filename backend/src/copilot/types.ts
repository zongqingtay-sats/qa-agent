/** A text content part in a multimodal message. */
export interface TextContentPart {
  type: 'text';
  text: string;
}

/** An image URL content part in a multimodal message. */
export interface ImageContentPart {
  type: 'image_url';
  image_url: { url: string };
}

/** Content that can be a plain string or an array of multimodal parts. */
export type MessageContent = string | (TextContentPart | ImageContentPart)[];

/** A single message in a chat completion conversation. */
export interface ChatMessage {
  /** The message sender: 'system', 'user', or 'assistant'. */
  role: 'system' | 'user' | 'assistant';
  /** The text content of the message, or multimodal content parts. */
  content: MessageContent;
}

/** Options for the AI chat completion request. */
export interface ChatOptions {
  /** Sampling temperature (0 = deterministic, higher = more creative). */
  temperature?: number;
  /** Maximum number of tokens in the response. */
  maxTokens?: number;
}
